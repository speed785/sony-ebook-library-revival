use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;

const READER_ROOT: &str = "/Volumes/READER";
const LAUNCHER_ROOT: &str = "/Volumes/LAUNCHER";

#[derive(Serialize)]
struct ReaderState {
    desktop: bool,
    reader_available: bool,
    launcher_available: bool,
    reader_path: Option<String>,
    launcher_path: Option<String>,
    model: Option<String>,
    total_space: Option<String>,
    free_space: Option<String>,
}

#[derive(Serialize)]
struct ReaderEntry {
    name: String,
    relative_path: String,
    absolute_path: String,
    is_dir: bool,
    size: u64,
}

#[tauri::command]
fn get_reader_state() -> Result<ReaderState, String> {
    let reader_path = Path::new(READER_ROOT);
    let launcher_path = Path::new(LAUNCHER_ROOT);

    let (model, total_space, free_space) = if reader_path.exists() {
        parse_diskutil_info(READER_ROOT)
    } else {
        (None, None, None)
    };

    Ok(ReaderState {
        desktop: true,
        reader_available: reader_path.exists(),
        launcher_available: launcher_path.exists(),
        reader_path: path_if_exists(reader_path),
        launcher_path: path_if_exists(launcher_path),
        model,
        total_space,
        free_space,
    })
}

#[tauri::command]
fn list_reader_entries(relative_path: String) -> Result<Vec<ReaderEntry>, String> {
    let target = resolve_reader_path(&relative_path)?;
    let mut entries = Vec::new();

    let read_dir = fs::read_dir(&target).map_err(|error| error.to_string())?;

    for result in read_dir {
        let entry = result.map_err(|error| error.to_string())?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        let absolute_path = path.to_string_lossy().to_string();
        let relative = path
            .strip_prefix(READER_ROOT)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .trim_start_matches('/')
            .to_string();

        entries.push(ReaderEntry {
            name,
            relative_path: relative,
            absolute_path,
            is_dir: metadata.is_dir(),
            size: metadata.len(),
        });
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
fn copy_files_to_reader(
    source_paths: Vec<String>,
    target_relative_dir: String,
) -> Result<(), String> {
    let target_dir = resolve_reader_path(&target_relative_dir)?;

    if !target_dir.is_dir() {
        return Err("Target folder does not exist on the Reader".to_string());
    }

    for source in source_paths {
        let source_path = PathBuf::from(&source);
        if !source_path.is_file() {
            continue;
        }

        let file_name = source_path
            .file_name()
            .ok_or_else(|| format!("Invalid source path: {source}"))?;
        let destination = target_dir.join(file_name);
        fs::copy(&source_path, destination).map_err(|error| error.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn export_reader_file(relative_path: String, destination_path: String) -> Result<(), String> {
    let source = resolve_reader_path(&relative_path)?;
    if !source.is_file() {
        return Err("Selected entry is not a file".to_string());
    }
    fs::copy(source, destination_path).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn reveal_in_finder(absolute_path: String) -> Result<(), String> {
    let status = Command::new("open")
        .args(["-R", &absolute_path])
        .status()
        .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("Finder could not reveal the selected item".to_string())
    }
}

fn resolve_reader_path(relative_path: &str) -> Result<PathBuf, String> {
    let mut path = PathBuf::from(READER_ROOT);

    for component in Path::new(relative_path).components() {
        match component {
            Component::Normal(part) => path.push(part),
            Component::CurDir => {}
            _ => return Err("Unsafe path requested".to_string()),
        }
    }

    Ok(path)
}

fn parse_diskutil_info(path: &str) -> (Option<String>, Option<String>, Option<String>) {
    let output = Command::new("diskutil").args(["info", path]).output();

    let Ok(output) = output else {
        return (None, None, None);
    };

    let text = String::from_utf8_lossy(&output.stdout);
    let model = parse_diskutil_value(&text, "Device / Media Name:");
    let total_space = parse_diskutil_value(&text, "Volume Total Space:");
    let free_space = parse_diskutil_value(&text, "Volume Free Space:");

    (model, total_space, free_space)
}

fn parse_diskutil_value(text: &str, key: &str) -> Option<String> {
    text.lines()
        .find_map(|line| {
            line.split_once(':')
                .filter(|(name, _)| name.trim() == key.trim())
        })
        .map(|(_, value)| value.trim().to_string())
}

fn path_if_exists(path: &Path) -> Option<String> {
    path.exists().then(|| path.to_string_lossy().to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_reader_state,
            list_reader_entries,
            copy_files_to_reader,
            export_reader_file,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use plist::Value;
use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

type DiskInfo = (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<u64>,
    Option<u64>,
);

#[derive(Clone)]
struct DetectedVolume {
    mount_point: String,
    volume_name: Option<String>,
    media_name: Option<String>,
    filesystem_type: Option<String>,
    filesystem_name: Option<String>,
    total_bytes: Option<u64>,
    free_bytes: Option<u64>,
    role: VolumeRole,
}

#[derive(Clone, PartialEq)]
enum VolumeRole {
    Reader,
    Launcher,
    Unknown,
}

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
    used_space: Option<String>,
    total_bytes: Option<u64>,
    free_bytes: Option<u64>,
    used_bytes: Option<u64>,
    volume_name: Option<String>,
    filesystem_type: Option<String>,
    filesystem_name: Option<String>,
    mounted_volumes: usize,
}

#[derive(Serialize)]
struct ReaderEntry {
    name: String,
    relative_path: String,
    absolute_path: String,
    is_dir: bool,
    size: u64,
    extension: Option<String>,
    modified_at: Option<u64>,
}

#[derive(Serialize)]
struct ReaderEntryDetails {
    name: String,
    relative_path: String,
    absolute_path: String,
    is_dir: bool,
    size: u64,
    extension: Option<String>,
    modified_at: Option<u64>,
    item_count: Option<usize>,
}

#[tauri::command]
fn get_reader_state() -> Result<ReaderState, String> {
    let volumes = discover_reader_volumes()?;
    let reader_volume = volumes
        .iter()
        .find(|volume| volume.role == VolumeRole::Reader);
    let launcher_volume = volumes
        .iter()
        .find(|volume| volume.role == VolumeRole::Launcher);

    let (model, total_space, free_space, total_bytes, free_bytes) =
        if let Some(reader_volume) = reader_volume {
            let disk_info = parse_diskutil_info(&reader_volume.mount_point);
            (
                disk_info.0.or_else(|| reader_volume.media_name.clone()),
                disk_info
                    .1
                    .or_else(|| reader_volume.total_bytes.map(format_bytes)),
                disk_info
                    .2
                    .or_else(|| reader_volume.free_bytes.map(format_bytes)),
                disk_info.3.or(reader_volume.total_bytes),
                disk_info.4.or(reader_volume.free_bytes),
            )
        } else {
            (None, None, None, None, None)
        };

    let used_bytes = total_bytes
        .zip(free_bytes)
        .map(|(total, free)| total.saturating_sub(free));
    let used_space = used_bytes.map(format_bytes);

    Ok(ReaderState {
        desktop: true,
        reader_available: reader_volume.is_some(),
        launcher_available: launcher_volume.is_some(),
        reader_path: reader_volume.map(|volume| volume.mount_point.clone()),
        launcher_path: launcher_volume.map(|volume| volume.mount_point.clone()),
        model,
        total_space,
        free_space,
        used_space,
        total_bytes,
        free_bytes,
        used_bytes,
        volume_name: reader_volume.and_then(|volume| volume.volume_name.clone()),
        filesystem_type: reader_volume.and_then(|volume| volume.filesystem_type.clone()),
        filesystem_name: reader_volume.and_then(|volume| volume.filesystem_name.clone()),
        mounted_volumes: volumes.len(),
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
            .strip_prefix(reader_root_path()?)
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
            extension: path
                .extension()
                .map(|ext| ext.to_string_lossy().to_string()),
            modified_at: modified_at(&metadata),
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
fn get_reader_entry_details(relative_path: String) -> Result<ReaderEntryDetails, String> {
    let path = resolve_reader_path(&relative_path)?;
    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;

    let item_count = if metadata.is_dir() {
        Some(
            fs::read_dir(&path)
                .map_err(|error| error.to_string())?
                .count(),
        )
    } else {
        None
    };

    Ok(ReaderEntryDetails {
        name: path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_else(|| "Reader".to_string()),
        relative_path,
        absolute_path: path.to_string_lossy().to_string(),
        is_dir: metadata.is_dir(),
        size: metadata.len(),
        extension: path
            .extension()
            .map(|ext| ext.to_string_lossy().to_string()),
        modified_at: modified_at(&metadata),
        item_count,
    })
}

#[tauri::command]
fn search_reader_entries(query: String) -> Result<Vec<ReaderEntry>, String> {
    let root_path = reader_root_path()?;
    let root = Path::new(&root_path);
    if !root.exists() {
        return Ok(Vec::new());
    }

    let trimmed = query.trim().to_lowercase();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    collect_matches(root, &trimmed, &mut results)?;

    results.sort_by(|a, b| {
        a.relative_path
            .to_lowercase()
            .cmp(&b.relative_path.to_lowercase())
    });
    Ok(results)
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
    let mut path = PathBuf::from(reader_root_path()?);

    for component in Path::new(relative_path).components() {
        match component {
            Component::Normal(part) => path.push(part),
            Component::CurDir => {}
            _ => return Err("Unsafe path requested".to_string()),
        }
    }

    Ok(path)
}

fn reader_root_path() -> Result<String, String> {
    discover_reader_volumes()?
        .into_iter()
        .find(|volume| volume.role == VolumeRole::Reader)
        .map(|volume| volume.mount_point)
        .ok_or_else(|| "No mounted Sony Reader volume found".to_string())
}

fn discover_reader_volumes() -> Result<Vec<DetectedVolume>, String> {
    let output = Command::new("diskutil")
        .args(["list", "-plist", "external"])
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let plist =
        Value::from_reader_xml(output.stdout.as_slice()).map_err(|error| error.to_string())?;
    let Some(dict) = plist.as_dictionary() else {
        return Ok(Vec::new());
    };

    let mut identifiers = Vec::new();
    if let Some(entries) = dict.get("AllDisksAndPartitions").and_then(Value::as_array) {
        for entry in entries {
            collect_disk_identifiers(entry, &mut identifiers);
        }
    }

    let mut volumes = Vec::new();
    for identifier in identifiers {
        if let Some(volume) = read_volume_info(&identifier)? {
            volumes.push(volume);
        }
    }

    if volumes
        .iter()
        .all(|volume| volume.role != VolumeRole::Reader)
    {
        if let Some(first_non_launcher) = volumes
            .iter_mut()
            .find(|volume| volume.role != VolumeRole::Launcher)
        {
            first_non_launcher.role = VolumeRole::Reader;
        }
    }

    Ok(volumes)
}

fn collect_disk_identifiers(value: &Value, output: &mut Vec<String>) {
    let Some(dict) = value.as_dictionary() else {
        return;
    };

    if let Some(identifier) = dict.get("DeviceIdentifier").and_then(Value::as_string) {
        output.push(identifier.to_string());
    }

    if let Some(children) = dict.get("Partitions").and_then(Value::as_array) {
        for child in children {
            collect_disk_identifiers(child, output);
        }
    }
}

fn read_volume_info(identifier: &str) -> Result<Option<DetectedVolume>, String> {
    let output = Command::new("diskutil")
        .args(["info", "-plist", identifier])
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Ok(None);
    }

    let plist =
        Value::from_reader_xml(output.stdout.as_slice()).map_err(|error| error.to_string())?;
    let Some(dict) = plist.as_dictionary() else {
        return Ok(None);
    };

    let mount_point = dict
        .get("MountPoint")
        .and_then(Value::as_string)
        .map(str::to_string);
    let bus_protocol = dict
        .get("BusProtocol")
        .and_then(Value::as_string)
        .map(str::to_string);

    if mount_point.is_none() || bus_protocol.as_deref() != Some("USB") {
        return Ok(None);
    }

    let volume_name = dict
        .get("VolumeName")
        .and_then(Value::as_string)
        .map(str::to_string);
    let media_name = dict
        .get("MediaName")
        .and_then(Value::as_string)
        .map(str::to_string);
    let role = infer_volume_role(volume_name.as_deref(), media_name.as_deref());

    Ok(Some(DetectedVolume {
        mount_point: mount_point.unwrap_or_default(),
        volume_name,
        media_name,
        filesystem_type: dict
            .get("FilesystemType")
            .and_then(Value::as_string)
            .map(str::to_string),
        filesystem_name: dict
            .get("FilesystemName")
            .and_then(Value::as_string)
            .map(str::to_string),
        total_bytes: dict.get("TotalSize").and_then(Value::as_unsigned_integer),
        free_bytes: dict.get("FreeSpace").and_then(Value::as_unsigned_integer),
        role,
    }))
}

fn infer_volume_role(volume_name: Option<&str>, media_name: Option<&str>) -> VolumeRole {
    let combined = format!(
        "{} {}",
        volume_name.unwrap_or_default().to_lowercase(),
        media_name.unwrap_or_default().to_lowercase()
    );

    if combined.contains("launcher") {
        VolumeRole::Launcher
    } else if combined.contains("reader") || combined.contains("prs") || combined.contains("sony") {
        VolumeRole::Reader
    } else {
        VolumeRole::Unknown
    }
}

fn collect_matches(path: &Path, query: &str, results: &mut Vec<ReaderEntry>) -> Result<(), String> {
    for item in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = item.map_err(|error| error.to_string())?;
        let entry_path = entry.path();
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        if name.to_lowercase().contains(query) {
            let relative_path = entry_path
                .strip_prefix(reader_root_path()?)
                .map_err(|error| error.to_string())?
                .to_string_lossy()
                .trim_start_matches('/')
                .to_string();

            results.push(ReaderEntry {
                name,
                relative_path,
                absolute_path: entry_path.to_string_lossy().to_string(),
                is_dir: metadata.is_dir(),
                size: metadata.len(),
                extension: entry_path
                    .extension()
                    .map(|ext| ext.to_string_lossy().to_string()),
                modified_at: modified_at(&metadata),
            });
        }

        if metadata.is_dir() {
            collect_matches(&entry_path, query, results)?;
        }
    }

    Ok(())
}

fn modified_at(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
}

fn parse_diskutil_info(path: &str) -> DiskInfo {
    let output = Command::new("diskutil").args(["info", path]).output();

    let Ok(output) = output else {
        return (None, None, None, None, None);
    };

    let text = String::from_utf8_lossy(&output.stdout);
    let model = parse_diskutil_value(&text, "Device / Media Name:");
    let total_space = parse_diskutil_value(&text, "Volume Total Space:");
    let free_space = parse_diskutil_value(&text, "Volume Free Space:");
    let total_bytes = parse_diskutil_bytes(&text, "Volume Total Space:");
    let free_bytes = parse_diskutil_bytes(&text, "Volume Free Space:");

    (model, total_space, free_space, total_bytes, free_bytes)
}

fn parse_diskutil_value(text: &str, key: &str) -> Option<String> {
    text.lines()
        .find_map(|line| {
            line.split_once(':')
                .filter(|(name, _)| name.trim() == key.trim())
        })
        .map(|(_, value)| value.trim().to_string())
}

fn parse_diskutil_bytes(text: &str, key: &str) -> Option<u64> {
    parse_diskutil_value(text, key).and_then(|value| {
        let first_token = value.split_whitespace().next()?;
        first_token.replace(',', "").parse::<u64>().ok()
    })
}

fn format_bytes(value: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    let value_f = value as f64;

    if value_f < KB {
        format!("{} B", value)
    } else if value_f < MB {
        format!("{:.1} KB", value_f / KB)
    } else if value_f < GB {
        format!("{:.1} MB", value_f / MB)
    } else {
        format!("{:.2} GB", value_f / GB)
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_reader_state,
            list_reader_entries,
            get_reader_entry_details,
            search_reader_entries,
            copy_files_to_reader,
            export_reader_file,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

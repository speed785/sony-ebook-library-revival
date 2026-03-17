use base64::{engine::general_purpose::STANDARD, Engine as _};
use plist::Value;
use roxmltree::Document;
use serde::Serialize;
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use zip::ZipArchive;

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

#[derive(Serialize)]
struct ReaderPreview {
    mime_type: String,
    data_url: String,
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
        let file_name = entry.file_name().to_string_lossy().to_string();
        if should_hide_entry(&file_name) {
            continue;
        }
        let absolute_path = path.to_string_lossy().to_string();
        let relative = path
            .strip_prefix(reader_root_path()?)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .trim_start_matches('/')
            .to_string();
        let extension = path
            .extension()
            .map(|ext| ext.to_string_lossy().to_string());
        let name = display_name_for_entry(&path, &file_name, extension.as_deref());

        entries.push(ReaderEntry {
            name,
            relative_path: relative,
            absolute_path,
            is_dir: metadata.is_dir(),
            size: metadata.len(),
            extension,
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

    let file_name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "Reader".to_string());
    let extension = path
        .extension()
        .map(|ext| ext.to_string_lossy().to_string());

    Ok(ReaderEntryDetails {
        name: display_name_for_entry(&path, &file_name, extension.as_deref()),
        relative_path,
        absolute_path: path.to_string_lossy().to_string(),
        is_dir: metadata.is_dir(),
        size: metadata.len(),
        extension,
        modified_at: modified_at(&metadata),
        item_count,
    })
}

#[tauri::command]
fn get_reader_preview(relative_path: String) -> Result<Option<ReaderPreview>, String> {
    let path = resolve_reader_path(&relative_path)?;
    let extension = path
        .extension()
        .map(|ext| ext.to_string_lossy().to_string().to_lowercase());

    match extension.as_deref() {
        Some("epub") => Ok(extract_epub_cover_preview(&path)),
        Some("pdf") => Ok(generate_pdf_preview(&path)),
        _ => Ok(None),
    }
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
        let file_name = entry.file_name().to_string_lossy().to_string();

        if should_hide_entry(&file_name) {
            continue;
        }

        let extension = entry_path
            .extension()
            .map(|ext| ext.to_string_lossy().to_string());
        let name = display_name_for_entry(&entry_path, &file_name, extension.as_deref());

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
                extension,
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

fn should_hide_entry(name: &str) -> bool {
    name.starts_with('.')
}

fn display_name_for_entry(path: &Path, file_name: &str, extension: Option<&str>) -> String {
    if let Some(ext) = extension {
        if ext.eq_ignore_ascii_case("epub") {
            if let Some(title) = extract_epub_title(path) {
                return title;
            }
        }
    }

    file_name.to_string()
}

fn extract_epub_cover_preview(path: &Path) -> Option<ReaderPreview> {
    let file = fs::File::open(path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;
    let (opf_path, opf_xml) = read_epub_opf(&mut archive)?;
    let opf_doc = Document::parse(&opf_xml).ok()?;
    let opf_base = Path::new(&opf_path)
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();

    let cover_href = find_epub_cover_href(&opf_doc)?;
    let resolved_path = normalize_zip_path(opf_base.join(cover_href));

    let mut bytes = Vec::new();
    archive
        .by_name(&resolved_path)
        .ok()?
        .read_to_end(&mut bytes)
        .ok()?;

    let mime_type = guess_mime_from_path(&resolved_path).to_string();
    Some(ReaderPreview {
        data_url: format!("data:{};base64,{}", mime_type, STANDARD.encode(bytes)),
        mime_type,
    })
}

fn generate_pdf_preview(path: &Path) -> Option<ReaderPreview> {
    let preview_dir = std::env::temp_dir().join("sony-ebook-library-revival-previews");
    fs::create_dir_all(&preview_dir).ok()?;

    let output = Command::new("qlmanage")
        .args([
            "-t",
            "-s",
            "512",
            "-o",
            preview_dir.to_string_lossy().as_ref(),
            path.to_string_lossy().as_ref(),
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let png_name = format!("{}.png", path.file_name()?.to_string_lossy());
    let bytes = fs::read(preview_dir.join(png_name)).ok()?;

    Some(ReaderPreview {
        mime_type: "image/png".to_string(),
        data_url: format!("data:image/png;base64,{}", STANDARD.encode(bytes)),
    })
}

fn extract_epub_title(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;
    let (_, opf_xml) = read_epub_opf(&mut archive)?;
    let opf_doc = Document::parse(&opf_xml).ok()?;
    opf_doc
        .descendants()
        .find(|node| node.tag_name().name() == "title")
        .and_then(|node| node.text())
        .map(str::trim)
        .filter(|title| !title.is_empty())
        .map(str::to_string)
}

fn read_epub_opf<R: Read + std::io::Seek>(archive: &mut ZipArchive<R>) -> Option<(String, String)> {
    let container_path = "META-INF/container.xml";
    let mut container_xml = String::new();
    archive
        .by_name(container_path)
        .ok()?
        .read_to_string(&mut container_xml)
        .ok()?;

    let container_doc = Document::parse(&container_xml).ok()?;
    let opf_path = container_doc
        .descendants()
        .find(|node| node.tag_name().name() == "rootfile")?
        .attribute("full-path")?
        .to_string();

    let mut opf_xml = String::new();
    archive
        .by_name(&opf_path)
        .ok()?
        .read_to_string(&mut opf_xml)
        .ok()?;

    Some((opf_path, opf_xml))
}

fn find_epub_cover_href(opf_doc: &Document<'_>) -> Option<String> {
    if let Some(item) = opf_doc.descendants().find(|node| {
        node.tag_name().name() == "item"
            && node
                .attribute("properties")
                .map(|props| props.split_whitespace().any(|value| value == "cover-image"))
                .unwrap_or(false)
    }) {
        return item.attribute("href").map(str::to_string);
    }

    if let Some(cover_id) = opf_doc.descendants().find_map(|node| {
        (node.tag_name().name() == "meta" && node.attribute("name") == Some("cover"))
            .then(|| node.attribute("content"))
            .flatten()
    }) {
        return opf_doc.descendants().find_map(|node| {
            (node.tag_name().name() == "item" && node.attribute("id") == Some(cover_id))
                .then(|| node.attribute("href"))
                .flatten()
                .map(str::to_string)
        });
    }

    opf_doc.descendants().find_map(|node| {
        if node.tag_name().name() != "item" {
            return None;
        }
        let media_type = node.attribute("media-type")?;
        if media_type.starts_with("image/") {
            node.attribute("href").map(str::to_string)
        } else {
            None
        }
    })
}

fn normalize_zip_path(path: PathBuf) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn guess_mime_from_path(path: &str) -> &'static str {
    if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".gif") {
        "image/gif"
    } else if path.ends_with(".webp") {
        "image/webp"
    } else {
        "application/octet-stream"
    }
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
        .plugin(tauri_plugin_drag::init())
        .invoke_handler(tauri::generate_handler![
            get_reader_state,
            list_reader_entries,
            get_reader_entry_details,
            get_reader_preview,
            search_reader_entries,
            copy_files_to_reader,
            export_reader_file,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

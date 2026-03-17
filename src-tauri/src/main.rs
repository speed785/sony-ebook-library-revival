mod platform;

#[cfg(target_os = "macos")]
mod platform_macos;

#[cfg(target_os = "linux")]
mod platform_linux;

#[cfg(target_os = "windows")]
mod platform_windows;

use base64::{engine::general_purpose::STANDARD, Engine as _};
use roxmltree::Document;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;
use zip::ZipArchive;

use platform::VolumeRole;

// ---------------------------------------------------------------------------
// Session-level caches
// ---------------------------------------------------------------------------

static READER_PATH_CACHE: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn reader_path_cache() -> &'static Mutex<Option<String>> {
    READER_PATH_CACHE.get_or_init(|| Mutex::new(None))
}

static EPUB_TITLE_CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn epub_title_cache() -> &'static Mutex<HashMap<String, String>> {
    EPUB_TITLE_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn invalidate_caches() {
    if let Ok(mut g) = reader_path_cache().lock() {
        *g = None;
    }
    if let Ok(mut g) = epub_title_cache().lock() {
        g.clear();
    }
}

// ---------------------------------------------------------------------------
// Serialisable types (shared with the frontend via IPC)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_reader_state() -> Result<ReaderState, String> {
    // Always re-discover on explicit refresh; invalidate caches as side-effect.
    invalidate_caches();

    let volumes = platform::discover_volumes()?;
    let reader_volume = volumes.iter().find(|v| v.role == VolumeRole::Reader);
    let launcher_volume = volumes.iter().find(|v| v.role == VolumeRole::Launcher);

    // Warm the path cache.
    if let Some(rv) = reader_volume {
        if let Ok(mut g) = reader_path_cache().lock() {
            *g = Some(rv.mount_point.clone());
        }
    }

    let (model, total_bytes, free_bytes) = if let Some(rv) = reader_volume {
        let (extra_model, extra_total, extra_free) = platform::extra_disk_info(&rv.mount_point);
        let model = extra_model.or_else(|| rv.media_name.clone());
        let total = extra_total.or(rv.total_bytes);
        let free = extra_free.or(rv.free_bytes);
        (model, total, free)
    } else {
        (None, None, None)
    };

    let total_space = total_bytes.map(format_bytes);
    let free_space = free_bytes.map(format_bytes);
    let used_bytes = total_bytes
        .zip(free_bytes)
        .map(|(t, f)| t.saturating_sub(f));
    let used_space = used_bytes.map(format_bytes);

    Ok(ReaderState {
        desktop: true,
        reader_available: reader_volume.is_some(),
        launcher_available: launcher_volume.is_some(),
        reader_path: reader_volume.map(|v| v.mount_point.clone()),
        launcher_path: launcher_volume.map(|v| v.mount_point.clone()),
        model,
        total_space,
        free_space,
        used_space,
        total_bytes,
        free_bytes,
        used_bytes,
        volume_name: reader_volume.and_then(|v| v.volume_name.clone()),
        filesystem_type: reader_volume.and_then(|v| v.filesystem_type.clone()),
        filesystem_name: reader_volume.and_then(|v| v.filesystem_name.clone()),
        mounted_volumes: volumes.len(),
    })
}

#[tauri::command]
fn list_reader_entries(relative_path: String) -> Result<Vec<ReaderEntry>, String> {
    let root = reader_root_path()?;
    let target = resolve_reader_path(&relative_path, &root)?;
    let mut entries = Vec::new();

    for result in fs::read_dir(&target).map_err(|e| e.to_string())? {
        let entry = result.map_err(|e| e.to_string())?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();
        if should_hide_entry(&file_name) {
            continue;
        }

        let absolute_path = path.to_string_lossy().to_string();
        let relative = portable_relative(&path, &root)?;
        let extension = path.extension().map(|e| e.to_string_lossy().to_string());
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
    let root = reader_root_path()?;
    let path = resolve_reader_path(&relative_path, &root)?;
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;

    let item_count = if metadata.is_dir() {
        Some(fs::read_dir(&path).map_err(|e| e.to_string())?.count())
    } else {
        None
    };

    let file_name = path
        .file_name()
        .map(|v| v.to_string_lossy().to_string())
        .unwrap_or_else(|| "Reader".to_string());
    let extension = path.extension().map(|e| e.to_string_lossy().to_string());

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
async fn get_reader_preview(relative_path: String) -> Result<Option<ReaderPreview>, String> {
    let root = reader_root_path()?;
    let path = resolve_reader_path(&relative_path, &root)?;
    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_string().to_lowercase());

    match extension.as_deref() {
        Some("epub") => Ok(extract_epub_cover_preview(&path)),
        Some("pdf") => {
            let path_clone = path.clone();
            tauri::async_runtime::spawn_blocking(move || generate_pdf_preview(&path_clone))
                .await
                .map_err(|e| e.to_string())
        }
        _ => Ok(None),
    }
}

#[tauri::command]
fn search_reader_entries(query: String) -> Result<Vec<ReaderEntry>, String> {
    let root = reader_root_path()?;
    let root_path = Path::new(&root);
    if !root_path.exists() {
        return Ok(Vec::new());
    }

    let trimmed = query.trim().to_lowercase();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    collect_matches(root_path, &trimmed, &root, &mut results)?;
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
    let root = reader_root_path()?;
    let target_dir = resolve_reader_path(&target_relative_dir, &root)?;

    if !target_dir.is_dir() {
        return Err("Target folder does not exist on the reader".to_string());
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
        fs::copy(&source_path, destination).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn export_reader_file(relative_path: String, destination_path: String) -> Result<(), String> {
    let root = reader_root_path()?;
    let source = resolve_reader_path(&relative_path, &root)?;
    if !source.is_file() {
        return Err("Selected entry is not a file".to_string());
    }
    fs::copy(source, destination_path).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn reveal_in_file_manager(absolute_path: String) -> Result<(), String> {
    platform::reveal_command(&absolute_path)
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/// Returns the reader root mount path, using the in-memory cache to avoid
/// re-running platform volume discovery on every IPC call.
fn reader_root_path() -> Result<String, String> {
    if let Ok(g) = reader_path_cache().lock() {
        if let Some(ref p) = *g {
            return Ok(p.clone());
        }
    }

    let path = platform::discover_volumes()?
        .into_iter()
        .find(|v| v.role == VolumeRole::Reader)
        .map(|v| v.mount_point)
        .ok_or_else(|| "No mounted Sony Reader volume found".to_string())?;

    if let Ok(mut g) = reader_path_cache().lock() {
        *g = Some(path.clone());
    }
    Ok(path)
}

/// Resolves a slash-separated relative path against the reader root, safely
/// rejecting traversal attempts.  Works on Windows too (PathBuf handles `\`).
fn resolve_reader_path(relative_path: &str, root: &str) -> Result<PathBuf, String> {
    let mut path = PathBuf::from(root);
    // Normalise both `/` and `\` as separators in the incoming relative path.
    for component in Path::new(relative_path).components() {
        match component {
            Component::Normal(part) => path.push(part),
            Component::CurDir => {}
            _ => return Err("Unsafe path requested".to_string()),
        }
    }
    Ok(path)
}

/// Produce a portable forward-slash relative path string from an absolute
/// `PathBuf` by stripping the reader root prefix.
fn portable_relative(path: &Path, root: &str) -> Result<String, String> {
    let rel = path.strip_prefix(root).map_err(|e| e.to_string())?;
    // Always use `/` as the separator in the relative path exposed to the UI,
    // regardless of the OS path separator.
    Ok(rel
        .components()
        .filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/"))
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

fn collect_matches(
    path: &Path,
    query: &str,
    root: &str,
    results: &mut Vec<ReaderEntry>,
) -> Result<(), String> {
    for item in fs::read_dir(path).map_err(|e| e.to_string())? {
        let entry = item.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let file_name = entry.file_name().to_string_lossy().to_string();

        if should_hide_entry(&file_name) {
            continue;
        }

        let extension = entry_path
            .extension()
            .map(|e| e.to_string_lossy().to_string());
        let name = display_name_for_entry(&entry_path, &file_name, extension.as_deref());

        if name.to_lowercase().contains(query) {
            let relative_path = portable_relative(&entry_path, root)?;
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
            collect_matches(&entry_path, query, root, results)?;
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

fn modified_at(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

fn should_hide_entry(name: &str) -> bool {
    name.starts_with('.')
}

fn display_name_for_entry(path: &Path, file_name: &str, extension: Option<&str>) -> String {
    if let Some(ext) = extension {
        if ext.eq_ignore_ascii_case("epub") {
            if let Some(title) = cached_epub_title(path) {
                return title;
            }
        }
    }
    file_name.to_string()
}

fn cached_epub_title(path: &Path) -> Option<String> {
    let key = path.to_string_lossy().to_string();
    {
        let g = epub_title_cache().lock().ok()?;
        if let Some(t) = g.get(&key) {
            return Some(t.clone());
        }
    }
    let title = extract_epub_title(path)?;
    if let Ok(mut g) = epub_title_cache().lock() {
        g.insert(key, title.clone());
    }
    Some(title)
}

// ---------------------------------------------------------------------------
// EPUB helpers
// ---------------------------------------------------------------------------

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
    let resolved = normalize_zip_path(opf_base.join(cover_href));

    let mut bytes = Vec::new();
    archive
        .by_name(&resolved)
        .ok()?
        .read_to_end(&mut bytes)
        .ok()?;

    let mime = guess_mime_from_path(&resolved).to_string();
    Some(ReaderPreview {
        data_url: format!("data:{};base64,{}", mime, STANDARD.encode(&bytes)),
        mime_type: mime,
    })
}

fn extract_epub_title(path: &Path) -> Option<String> {
    let file = fs::File::open(path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;
    let (_, opf_xml) = read_epub_opf(&mut archive)?;
    let opf_doc = Document::parse(&opf_xml).ok()?;
    opf_doc
        .descendants()
        .find(|n| n.tag_name().name() == "title")
        .and_then(|n| n.text())
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_string)
}

fn read_epub_opf<R: Read + std::io::Seek>(archive: &mut ZipArchive<R>) -> Option<(String, String)> {
    let mut container_xml = String::new();
    archive
        .by_name("META-INF/container.xml")
        .ok()?
        .read_to_string(&mut container_xml)
        .ok()?;

    let container_doc = Document::parse(&container_xml).ok()?;
    let opf_path = container_doc
        .descendants()
        .find(|n| n.tag_name().name() == "rootfile")?
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
    if let Some(item) = opf_doc.descendants().find(|n| {
        n.tag_name().name() == "item"
            && n.attribute("properties")
                .map(|p| p.split_whitespace().any(|v| v == "cover-image"))
                .unwrap_or(false)
    }) {
        return item.attribute("href").map(str::to_string);
    }

    if let Some(cover_id) = opf_doc.descendants().find_map(|n| {
        (n.tag_name().name() == "meta" && n.attribute("name") == Some("cover"))
            .then(|| n.attribute("content"))
            .flatten()
    }) {
        return opf_doc.descendants().find_map(|n| {
            (n.tag_name().name() == "item" && n.attribute("id") == Some(cover_id))
                .then(|| n.attribute("href"))
                .flatten()
                .map(str::to_string)
        });
    }

    opf_doc.descendants().find_map(|n| {
        if n.tag_name().name() != "item" {
            return None;
        }
        let mt = n.attribute("media-type")?;
        if mt.starts_with("image/") {
            n.attribute("href").map(str::to_string)
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

// ---------------------------------------------------------------------------
// PDF preview — cross-platform via platform-gated approach
// ---------------------------------------------------------------------------

fn generate_pdf_preview(path: &Path) -> Option<ReaderPreview> {
    #[cfg(target_os = "macos")]
    {
        // macOS: Quick Look CLI — fast, no extra dependency
        let preview_dir = std::env::temp_dir().join("sony-ebook-library-revival-previews");
        fs::create_dir_all(&preview_dir).ok()?;

        let output = std::process::Command::new("qlmanage")
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
            data_url: format!("data:image/png;base64,{}", STANDARD.encode(&bytes)),
        })
    }

    #[cfg(target_os = "linux")]
    {
        // Linux: pdftoppm (poppler-utils) — widely available, no Rust dep needed
        let preview_dir = std::env::temp_dir().join("sony-ebook-library-revival-previews");
        fs::create_dir_all(&preview_dir).ok()?;

        let stem = path.file_stem()?.to_string_lossy().to_string();
        let out_prefix = preview_dir.join(&stem);

        let output = std::process::Command::new("pdftoppm")
            .args([
                "-r",
                "150",
                "-singlefile",
                "-png",
                path.to_string_lossy().as_ref(),
                out_prefix.to_string_lossy().as_ref(),
            ])
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        // pdftoppm appends nothing (because -singlefile) — output is exactly <prefix>.png
        let png_path = preview_dir.join(format!("{stem}.png"));
        let bytes = fs::read(&png_path).ok()?;
        Some(ReaderPreview {
            mime_type: "image/png".to_string(),
            data_url: format!("data:image/png;base64,{}", STANDARD.encode(&bytes)),
        })
    }

    #[cfg(target_os = "windows")]
    {
        // Windows: use PowerShell + Windows.Data.Pdf WinRT API to render page 0
        let preview_dir = std::env::temp_dir().join("sony-ebook-library-revival-previews");
        fs::create_dir_all(&preview_dir).ok()?;

        let pdf_path = path.to_string_lossy().replace('\\', "\\\\");
        let png_path = preview_dir
            .join(format!("{}.png", path.file_stem()?.to_string_lossy()))
            .to_string_lossy()
            .replace('\\', "\\\\");

        let script = format!(
            r#"
Add-Type -AssemblyName Windows.Data.Pdf
$pdf = [Windows.Data.Pdf.PdfDocument,Windows.Data.Pdf,ContentType=WindowsRuntime]::LoadFromFileAsync(
    (Get-Item '{pdf_path}')
).GetResults()
$page = $pdf.GetPage(0)
$stream = [Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Storage.Streams,ContentType=WindowsRuntime]::new()
$opts = [Windows.Data.Pdf.PdfPageRenderOptions,Windows.Data.Pdf,ContentType=WindowsRuntime]::new()
$opts.DestinationWidth = 512
$page.RenderToStreamAsync($stream, $opts).GetResults() | Out-Null
$reader = [System.IO.BinaryReader]::new([System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream))
$bytes = $reader.ReadBytes($stream.Size)
[System.IO.File]::WriteAllBytes('{png_path}', $bytes)
"#
        );

        let output = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output()
            .ok()?;

        if !output.status.success() {
            return None;
        }

        let bytes =
            fs::read(preview_dir.join(format!("{}.png", path.file_stem()?.to_string_lossy())))
                .ok()?;

        Some(ReaderPreview {
            mime_type: "image/png".to_string(),
            data_url: format!("data:image/png;base64,{}", STANDARD.encode(&bytes)),
        })
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = path;
        None
    }
}

// ---------------------------------------------------------------------------
// Byte formatting
// ---------------------------------------------------------------------------

fn format_bytes(value: u64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;
    let v = value as f64;
    if v < KB {
        format!("{value} B")
    } else if v < MB {
        format!("{:.1} KB", v / KB)
    } else if v < GB {
        format!("{:.1} MB", v / MB)
    } else {
        format!("{:.2} GB", v / GB)
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_reader_state,
            list_reader_entries,
            get_reader_entry_details,
            get_reader_preview,
            search_reader_entries,
            copy_files_to_reader,
            export_reader_file,
            reveal_in_file_manager,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

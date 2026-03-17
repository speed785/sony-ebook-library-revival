/// Shared types used by all platform implementations.

#[derive(Clone, PartialEq)]
pub enum VolumeRole {
    Reader,
    Launcher,
    Unknown,
}

#[derive(Clone)]
pub struct DetectedVolume {
    pub mount_point: String,
    pub volume_name: Option<String>,
    pub media_name: Option<String>,
    pub filesystem_type: Option<String>,
    pub filesystem_name: Option<String>,
    pub total_bytes: Option<u64>,
    pub free_bytes: Option<u64>,
    pub role: VolumeRole,
}

// ── Platform dispatch ─────────────────────────────────────────────────────────

/// Enumerate external volumes. Delegates to the correct platform module.
pub fn discover_volumes() -> Result<Vec<DetectedVolume>, String> {
    #[cfg(target_os = "macos")]
    {
        crate::platform_macos::discover_volumes()
    }
    #[cfg(target_os = "linux")]
    {
        crate::platform_linux::discover_volumes()
    }
    #[cfg(target_os = "windows")]
    {
        crate::platform_windows::discover_volumes()
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("Unsupported platform".to_string())
    }
}

/// Return (model_hint, total_bytes, free_bytes) for extra metadata where
/// the platform can supply it cheaply.
pub fn extra_disk_info(mount_point: &str) -> (Option<String>, Option<u64>, Option<u64>) {
    #[cfg(target_os = "macos")]
    {
        crate::platform_macos::extra_disk_info(mount_point)
    }
    #[cfg(target_os = "linux")]
    {
        crate::platform_linux::extra_disk_info(mount_point)
    }
    #[cfg(target_os = "windows")]
    {
        crate::platform_windows::extra_disk_info(mount_point)
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = mount_point;
        (None, None, None)
    }
}

/// Open a file manager at the given path, selecting the item where supported.
/// Uses tauri-plugin-opener under the hood via the caller.
pub fn reveal_command(absolute_path: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("open")
            .args(["-R", absolute_path])
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err("Could not reveal item in Finder".to_string())
        }
    }
    #[cfg(target_os = "windows")]
    {
        // explorer /select,"path" selects the file in Explorer
        let arg = format!("/select,\"{absolute_path}\"");
        let status = std::process::Command::new("explorer")
            .arg(&arg)
            .status()
            .map_err(|e| e.to_string())?;
        // explorer.exe always returns a non-zero exit code — treat any launch as success
        let _ = status;
        Ok(())
    }
    #[cfg(target_os = "linux")]
    {
        // Try file-manager-specific select; fall back to opening the parent dir.
        let path = std::path::Path::new(absolute_path);
        let parent = path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "/".to_string());

        // Attempt nautilus --select (GNOME), then xdg-open on parent
        if std::process::Command::new("nautilus")
            .args(["--select", absolute_path])
            .spawn()
            .is_ok()
        {
            return Ok(());
        }
        let status = std::process::Command::new("xdg-open")
            .arg(&parent)
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err("Could not open file manager".to_string())
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        let _ = absolute_path;
        Err("Unsupported platform".to_string())
    }
}

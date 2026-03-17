use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use std::process::Command;

use windows::Win32::Foundation::MAX_PATH;
use windows::Win32::Storage::FileSystem::{
    GetDiskFreeSpaceExW, GetDriveTypeW, GetVolumeInformationW, DRIVE_REMOVABLE,
};
use windows::Win32::System::WindowsProgramming::GetSystemDirectoryW;

use crate::platform::{DetectedVolume, VolumeRole};

pub fn discover_volumes() -> Result<Vec<DetectedVolume>, String> {
    let drive_bits = unsafe { windows::Win32::Storage::FileSystem::GetLogicalDrives() };
    if drive_bits == 0 {
        return Ok(Vec::new());
    }

    let mut volumes = Vec::new();

    for bit in 0u32..26 {
        if drive_bits & (1 << bit) == 0 {
            continue;
        }

        let letter = (b'A' + bit as u8) as char;
        let root = format!("{letter}:\\");
        let root_w: Vec<u16> = root.encode_utf16().chain(std::iter::once(0)).collect();

        // Only removable drives (covers SD, USB sticks, readers mounted as drives)
        let drive_type = unsafe { GetDriveTypeW(windows::core::PCWSTR(root_w.as_ptr())) };
        if drive_type != DRIVE_REMOVABLE {
            continue;
        }

        // Read volume label and filesystem type
        let mut vol_name_buf = vec![0u16; MAX_PATH as usize + 1];
        let mut fs_name_buf = vec![0u16; MAX_PATH as usize + 1];

        let vol_info_ok = unsafe {
            GetVolumeInformationW(
                windows::core::PCWSTR(root_w.as_ptr()),
                Some(&mut vol_name_buf),
                None,
                None,
                None,
                Some(&mut fs_name_buf),
            )
        }
        .is_ok();

        let volume_name = if vol_info_ok {
            let end = vol_name_buf.iter().position(|&c| c == 0).unwrap_or(0);
            let s = OsString::from_wide(&vol_name_buf[..end])
                .to_string_lossy()
                .to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        } else {
            None
        };

        let filesystem_name = if vol_info_ok {
            let end = fs_name_buf.iter().position(|&c| c == 0).unwrap_or(0);
            let s = OsString::from_wide(&fs_name_buf[..end])
                .to_string_lossy()
                .to_string();
            if s.is_empty() {
                None
            } else {
                Some(s)
            }
        } else {
            None
        };

        // Free/total bytes
        let mut free_bytes_caller = 0u64;
        let mut total_bytes = 0u64;
        let mut free_bytes = 0u64;

        let space_ok = unsafe {
            GetDiskFreeSpaceExW(
                windows::core::PCWSTR(root_w.as_ptr()),
                Some(&mut free_bytes_caller),
                Some(&mut total_bytes),
                Some(&mut free_bytes),
            )
        }
        .is_ok();

        let (total_bytes_opt, free_bytes_opt) = if space_ok {
            (Some(total_bytes), Some(free_bytes))
        } else {
            (None, None)
        };

        // Try to detect if this is USB via WMI / PowerShell (best-effort)
        let is_usb = is_usb_drive(letter);

        // On Windows every removable drive that is USB is a candidate.
        // Non-USB removable (e.g. SD card reader without USB transport)
        // is also accepted as fallback — the user is unlikely to have other
        // removable FAT volumes mounted simultaneously on a dev machine.
        if !is_usb {
            // Still include non-USB removable but as Unknown so it can be
            // promoted by the fallback logic below.
        }

        let role = infer_role(volume_name.as_deref());

        volumes.push(DetectedVolume {
            mount_point: root.trim_end_matches('\\').to_string(),
            volume_name,
            media_name: None,
            filesystem_type: filesystem_name.clone(),
            filesystem_name,
            total_bytes: total_bytes_opt,
            free_bytes: free_bytes_opt,
            role,
        });
    }

    promote_fallback_reader(&mut volumes);
    Ok(volumes)
}

/// Returns (model_hint, total_bytes, free_bytes) — on Windows the model
/// is queried via a PowerShell WMI one-liner. Best-effort.
pub fn extra_disk_info(mount_point: &str) -> (Option<String>, Option<u64>, Option<u64>) {
    let model = query_wmi_model(mount_point);
    (model, None, None) // bytes already populated by discover_volumes
}

// ── helpers ──────────────────────────────────────────────────────────────────

/// Heuristic: ask PowerShell whether the drive letter maps to a USB device.
/// Fails silently — returns false on any error.
fn is_usb_drive(letter: char) -> bool {
    let script = format!(
        r#"$d=(Get-WmiObject Win32_LogicalDisk -Filter "DeviceID='{letter}:'").DriveType;$p=(Get-WmiObject Win32_DiskDrive | Where-Object {{$_.InterfaceType -eq 'USB'}} | Get-WmiObject -Query "ASSOCIATORS OF {{Win32_DiskDrive}} WHERE ResultClass=Win32_LogicalDisk" 2>$null | Where-Object {{$_.DeviceID -eq '{letter}:'}});if($p){{exit 0}}else{{exit 1}}"#
    );
    Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Query WMI for the model string of the disk backing a drive letter.
fn query_wmi_model(mount_point: &str) -> Option<String> {
    let letter = mount_point.chars().next()?;
    let script = format!(
        r#"(Get-WmiObject -Query "ASSOCIATORS OF {{Win32_LogicalDisk.DeviceID='{letter}:'}} WHERE ResultClass=Win32_DiskDrive").Model"#
    );
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .ok()?;
    let model = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if model.is_empty() {
        None
    } else {
        Some(model)
    }
}

fn infer_role(volume_name: Option<&str>) -> VolumeRole {
    let label = volume_name.unwrap_or_default().to_lowercase();
    if label.contains("launcher") {
        VolumeRole::Launcher
    } else if label.contains("reader") || label.contains("prs") || label.contains("sony") {
        VolumeRole::Reader
    } else {
        VolumeRole::Unknown
    }
}

fn promote_fallback_reader(volumes: &mut [DetectedVolume]) {
    if volumes.iter().all(|v| v.role != VolumeRole::Reader) {
        if let Some(v) = volumes.iter_mut().find(|v| v.role != VolumeRole::Launcher) {
            v.role = VolumeRole::Reader;
        }
    }
}

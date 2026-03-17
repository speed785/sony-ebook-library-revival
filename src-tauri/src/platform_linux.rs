use std::fs;
use std::path::Path;
use std::process::Command;

use crate::platform::{DetectedVolume, VolumeRole};

pub fn discover_volumes() -> Result<Vec<DetectedVolume>, String> {
    // Use `lsblk --json` to enumerate block devices, then filter to USB
    // removable partitions that are actually mounted.
    let output = Command::new("lsblk")
        .args([
            "--json",
            "--output",
            "NAME,MOUNTPOINT,LABEL,FSTYPE,SIZE,RM,TRAN",
            "--bytes",
        ])
        .output()
        .map_err(|e| format!("lsblk failed: {e}"))?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("lsblk parse error: {e}"))?;

    let mut volumes = Vec::new();

    if let Some(devices) = json.get("blockdevices").and_then(|v| v.as_array()) {
        for device in devices {
            collect_from_device(device, &mut volumes);
        }
    }

    promote_fallback_reader(&mut volumes);
    Ok(volumes)
}

/// Returns (model_hint, total_bytes, free_bytes) for a mount point using
/// statvfs-style data from /proc or df.
pub fn extra_disk_info(mount_point: &str) -> (Option<String>, Option<u64>, Option<u64>) {
    // Try reading the model from the sysfs device tree
    let model = read_sysfs_model(mount_point);

    // Use `df --block-size=1 <mount>` for reliable byte counts
    let (total, free) = df_bytes(mount_point).unzip();
    (model, total, free)
}

// ── helpers ──────────────────────────────────────────────────────────────────

fn collect_from_device(device: &serde_json::Value, out: &mut Vec<DetectedVolume>) {
    // Recurse into children (partitions)
    if let Some(children) = device.get("children").and_then(|v| v.as_array()) {
        for child in children {
            collect_from_device(child, out);
        }
    }

    // Only interested in USB removable partitions that are mounted
    let is_removable = device.get("rm").and_then(|v| v.as_bool()).unwrap_or(false);
    let transport = device
        .get("tran")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    let mount_point = device
        .get("mountpoint")
        .and_then(|v| v.as_str())
        .unwrap_or_default();

    // Accept USB transport, or removable devices whose transport lsblk
    // doesn't report (common on some kernels for sub-partitions)
    if mount_point.is_empty() {
        return;
    }
    if transport != "usb" && !is_removable {
        return;
    }

    let label = device
        .get("label")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let fstype = device
        .get("fstype")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    // Space info
    let (total_bytes, free_bytes) = df_bytes(mount_point)
        .map(|(t, f)| (Some(t), Some(f)))
        .unwrap_or((None, None));

    let role = infer_role(label.as_deref());

    out.push(DetectedVolume {
        mount_point: mount_point.to_string(),
        volume_name: label.clone(),
        media_name: None,
        filesystem_type: fstype.clone(),
        filesystem_name: fstype,
        total_bytes,
        free_bytes,
        role,
    });
}

/// Returns (total_bytes, free_bytes) from `df`, or None if unavailable.
fn df_bytes(mount_point: &str) -> Option<(u64, u64)> {
    let output = Command::new("df")
        .args(["--block-size=1", "--output=size,avail", mount_point])
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&output.stdout);
    // df output: header line + data line
    let data = text.lines().nth(1)?;
    let mut parts = data.split_whitespace();
    let total = parts.next()?.parse::<u64>().ok()?;
    let free = parts.next()?.parse::<u64>().ok()?;
    Some((total, free))
}

/// Read a human-readable model string from sysfs for the device backing
/// the given mount point.  Best-effort — returns None when unavailable.
fn read_sysfs_model(mount_point: &str) -> Option<String> {
    // Find the block device backing this mount from /proc/mounts
    let mounts = fs::read_to_string("/proc/mounts").ok()?;
    let dev_node = mounts.lines().find_map(|line| {
        let mut parts = line.splitn(3, ' ');
        let dev = parts.next()?;
        let mnt = parts.next()?;
        if mnt == mount_point {
            Some(dev.to_string())
        } else {
            None
        }
    })?;

    // Strip partition number to get base device (e.g. /dev/sdb1 → sdb)
    let dev_name = Path::new(&dev_node)
        .file_name()?
        .to_string_lossy()
        .trim_end_matches(|c: char| c.is_ascii_digit())
        .to_string();

    let model_path = format!("/sys/block/{dev_name}/device/model");
    fs::read_to_string(&model_path)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn infer_role(label: Option<&str>) -> VolumeRole {
    let label_lc = label.unwrap_or_default().to_lowercase();
    if label_lc.contains("launcher") {
        VolumeRole::Launcher
    } else if label_lc.contains("reader") || label_lc.contains("prs") || label_lc.contains("sony") {
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

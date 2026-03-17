use plist::Value;
use std::process::Command;

use crate::platform::{DetectedVolume, VolumeRole};

pub fn discover_volumes() -> Result<Vec<DetectedVolume>, String> {
    let output = Command::new("diskutil")
        .args(["list", "-plist", "external"])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(Vec::new());
    }

    let plist = Value::from_reader_xml(output.stdout.as_slice()).map_err(|e| e.to_string())?;
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

    promote_fallback_reader(&mut volumes);
    Ok(volumes)
}

/// Best-effort model/space data from `diskutil info <mount>`.
pub fn extra_disk_info(mount_point: &str) -> (Option<String>, Option<u64>, Option<u64>) {
    let output = match Command::new("diskutil")
        .args(["info", mount_point])
        .output()
    {
        Ok(o) => o,
        Err(_) => return (None, None, None),
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let model = parse_value(&text, "Device / Media Name:");
    let total = parse_bytes(&text, "Volume Total Space:");
    let free = parse_bytes(&text, "Volume Free Space:");
    (model, total, free)
}

// ── helpers ──────────────────────────────────────────────────────────────────

fn collect_disk_identifiers(value: &Value, out: &mut Vec<String>) {
    let Some(dict) = value.as_dictionary() else {
        return;
    };
    if let Some(id) = dict.get("DeviceIdentifier").and_then(Value::as_string) {
        out.push(id.to_string());
    }
    if let Some(children) = dict.get("Partitions").and_then(Value::as_array) {
        for child in children {
            collect_disk_identifiers(child, out);
        }
    }
}

fn read_volume_info(identifier: &str) -> Result<Option<DetectedVolume>, String> {
    let output = Command::new("diskutil")
        .args(["info", "-plist", identifier])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(None);
    }

    let plist = Value::from_reader_xml(output.stdout.as_slice()).map_err(|e| e.to_string())?;
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
    let role = infer_role(volume_name.as_deref(), media_name.as_deref());

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

fn parse_value(text: &str, key: &str) -> Option<String> {
    text.lines()
        .find_map(|line| line.split_once(':').filter(|(k, _)| k.trim() == key.trim()))
        .map(|(_, v)| v.trim().to_string())
}

fn parse_bytes(text: &str, key: &str) -> Option<u64> {
    parse_value(text, key).and_then(|v| {
        v.split_whitespace()
            .next()?
            .replace(',', "")
            .parse::<u64>()
            .ok()
    })
}

fn infer_role(volume_name: Option<&str>, media_name: Option<&str>) -> VolumeRole {
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

fn promote_fallback_reader(volumes: &mut [DetectedVolume]) {
    if volumes.iter().all(|v| v.role != VolumeRole::Reader) {
        if let Some(v) = volumes.iter_mut().find(|v| v.role != VolumeRole::Launcher) {
            v.role = VolumeRole::Reader;
        }
    }
}

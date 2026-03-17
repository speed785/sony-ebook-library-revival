import type { ReaderState } from "../../types";

type DeviceBannerProps = {
  device: ReaderState;
  status: string;
  usagePercent: number;
  modelLabel: string;
  onOpenDevice: () => void;
};

export function DeviceBanner({
  device,
  status,
  usagePercent,
  modelLabel,
  onOpenDevice,
}: DeviceBannerProps) {
  return (
    <section className="device-banner" onClick={onOpenDevice}>
      <div
        className={`device-pill ${device.reader_available ? "device-pill--connected" : "device-pill--disconnected"}`}
      >
        {device.reader_available ? "Connected" : "Waiting for device"}
      </div>
      <div className="device-banner__primary">
        <strong>
          {device.reader_available
            ? modelLabel
            : "Connect a Sony Reader over USB"}
        </strong>
        <span>{status}</span>
      </div>
      <div className="device-banner__stats">
        <div>
          <label>Free</label>
          <span>{device.free_space || "--"}</span>
        </div>
        <div>
          <label>Used</label>
          <span>{device.used_space || "--"}</span>
        </div>
        <div>
          <label>Format</label>
          <span>{device.filesystem_name || "Unavailable"}</span>
        </div>
        <div>
          <label>Volumes</label>
          <span>{device.mounted_volumes || 0}</span>
        </div>
      </div>
      <div className="device-banner__meter">
        <div
          className="device-banner__meter-fill"
          style={{ width: `${usagePercent}%` }}
        />
      </div>
    </section>
  );
}

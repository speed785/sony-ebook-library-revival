import { Download, ExternalLink, PanelRightClose } from "lucide-react";
import type {
  DrawerView,
  ReaderEntryDetails,
  ReaderPreview,
  ReaderState,
} from "../../types";
import { formatBytes, formatDate } from "../../utils";
import { DetailItem } from "./DetailItem";
import { iconForEntry } from "../helpers";

type DetailsDrawerProps = {
  device: ReaderState;
  drawerView: DrawerView;
  selectedEntryDetails: ReaderEntryDetails | null;
  selectedPreview: ReaderPreview | null;
  modelLabel: string;
  collapsed: boolean;
  checkedAt: string | null;
  onClose: () => void;
  onReveal: () => void;
  onExport: () => void;
  onToggleCollapsed: () => void;
};

export function DetailsDrawer({
  device,
  drawerView,
  selectedEntryDetails,
  selectedPreview,
  modelLabel,
  collapsed,
  checkedAt,
  onClose,
  onReveal,
  onExport,
  onToggleCollapsed,
}: DetailsDrawerProps) {
  if (drawerView.kind === "closed" || collapsed) {
    return null;
  }

  return (
    <aside className="details-drawer">
      <div className="details-drawer__header">
        <div>
          <p className="eyebrow">Details</p>
          <h3>
            {drawerView.kind === "device"
              ? modelLabel
              : selectedEntryDetails?.name || drawerView.entry.name}
          </h3>
        </div>
        <button className="secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {drawerView.kind === "device" ? (
        <div className="details-drawer__body">
          <DetailItem label="Model" value={modelLabel || "Unknown"} />
          <DetailItem
            label="Reader volume"
            value={device.reader_path || "Unavailable"}
          />
          <DetailItem
            label="Launcher volume"
            value={
              device.launcher_available
                ? device.launcher_path || "Mounted"
                : "Not mounted"
            }
          />
          <DetailItem
            label="Free space"
            value={device.free_space || "Unavailable"}
          />
          <DetailItem
            label="Used space"
            value={device.used_space || "Unavailable"}
          />
          <DetailItem label="Last refresh" value={checkedAt || "Just now"} />
        </div>
      ) : (
        <div className="details-drawer__body">
          {selectedPreview ? (
            <div className="details-preview">
              <img src={selectedPreview.data_url} alt="Book preview" />
            </div>
          ) : (
            <div className="details-preview details-preview--empty">
              {iconForEntry(drawerView.entry, true)}
            </div>
          )}
          <DetailItem
            label="Name"
            value={selectedEntryDetails?.name || drawerView.entry.name}
          />
          <DetailItem
            label="Path"
            value={
              selectedEntryDetails?.relative_path ||
              drawerView.entry.relative_path
            }
          />
          <DetailItem
            label="Type"
            value={
              selectedEntryDetails?.is_dir
                ? "Folder"
                : selectedEntryDetails?.extension?.toUpperCase() || "Document"
            }
          />
          <DetailItem
            label="Size"
            value={
              selectedEntryDetails?.is_dir
                ? "--"
                : formatBytes(
                    selectedEntryDetails?.size || drawerView.entry.size,
                  )
            }
          />
          <DetailItem
            label="Updated"
            value={formatDate(
              selectedEntryDetails?.modified_at || drawerView.entry.modified_at,
            )}
          />
          {selectedEntryDetails?.is_dir ? (
            <DetailItem
              label="Items"
              value={String(selectedEntryDetails.item_count ?? 0)}
            />
          ) : null}
          <div className="details-drawer__actions">
            <button className="secondary" type="button" onClick={onReveal}>
              <ExternalLink size={16} />
              Show in file manager
            </button>
            {!drawerView.entry.is_dir ? (
              <button className="primary" type="button" onClick={onExport}>
                <Download size={16} />
                Export file
              </button>
            ) : null}
            <button
              className="secondary"
              type="button"
              onClick={onToggleCollapsed}
            >
              <PanelRightClose size={16} />
              Collapse
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}

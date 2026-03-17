import { Download, ExternalLink } from "lucide-react";
import { memo } from "react";
import type {
  AppMode,
  DrawerView,
  ReaderEntry,
  ReaderState,
} from "../../types";
import { breadcrumbParts, formatBytes, formatDate } from "../../utils";
import { fileKindLabel, iconForEntry, stripDisplayExtension } from "../helpers";

type ContentListProps = {
  mode: AppMode;
  device: ReaderState;
  canUseNativeBridge: boolean;
  currentDir: string;
  visibleEntries: ReaderEntry[];
  selectedEntry: ReaderEntry | null;
  selectedPaths: string[];
  searchQuery: string;
  isSearching: boolean;
  transferState: string | null;
  sortKey: "name" | "type" | "date" | "size";
  filterKey: "all" | "folders" | "epub" | "pdf";
  dragActive: boolean;
  drawerView: DrawerView;
  onSortChange: (key: "name" | "type" | "date" | "size") => void;
  onFilterChange: (key: "all" | "folders" | "epub" | "pdf") => void;
  onSelectPaths: (paths: string[]) => void;
  onToggleSelectedPath: (path: string) => void;
  onOpenEntry: (entry: ReaderEntry) => void;
  onNavigate: (path: string) => void;
  onImport: () => void;
  onExport: () => void;
  onDragToFinder: () => void;
  onOpenDetails: () => void;
};

export const ContentList = memo(function ContentList({
  canUseNativeBridge,
  currentDir,
  visibleEntries,
  selectedEntry,
  selectedPaths,
  searchQuery,
  isSearching,
  transferState,
  sortKey,
  filterKey,
  dragActive,
  drawerView,
  onSortChange,
  onFilterChange,
  onToggleSelectedPath,
  onOpenEntry,
  onNavigate,
  onImport,
  onExport,
  onDragToFinder,
  onOpenDetails,
}: ContentListProps) {
  const breadcrumbs = breadcrumbParts(currentDir);

  return (
    <section className="workspace__main">
      {dragActive ? (
        <div className="drop-overlay">
          <div className="drop-overlay__panel">
            <Download size={26} />
            <strong>
              Drop books to import into{" "}
              {breadcrumbs[breadcrumbs.length - 1]?.label || "Reader"}
            </strong>
            <span>
              EPUB, PDF, TXT and other supported reader files will be copied
              into the current folder.
            </span>
          </div>
        </div>
      ) : null}

      <div className="content-header">
        <div>
          <div className="breadcrumbs">
            {breadcrumbs.map((part, index) => (
              <button
                key={part.path || "root"}
                className="breadcrumb"
                type="button"
                onClick={() => onNavigate(part.path)}
              >
                {part.label}
                {index < breadcrumbs.length - 1 ? <span>/</span> : null}
              </button>
            ))}
          </div>
          <h2>{breadcrumbs[breadcrumbs.length - 1]?.label || "Reader"}</h2>
        </div>
        <div className="content-actions">
          <select
            aria-label="Sort files"
            value={sortKey}
            onChange={(event) =>
              onSortChange(
                event.target.value as "name" | "type" | "date" | "size",
              )
            }
          >
            <option value="name">Sort: Name</option>
            <option value="type">Sort: Type</option>
            <option value="date">Sort: Updated</option>
            <option value="size">Sort: Size</option>
          </select>
          <button
            className="secondary"
            type="button"
            onClick={onImport}
            disabled={!canUseNativeBridge}
          >
            Import books
          </button>
          <button
            className="secondary"
            type="button"
            onClick={onOpenDetails}
            disabled={!selectedEntry && drawerView.kind === "closed"}
          >
            Details
          </button>
          <button
            className="secondary"
            type="button"
            onMouseDown={onDragToFinder}
            disabled={!selectedPaths.length || !canUseNativeBridge}
          >
            <ExternalLink size={15} />
            Drag to Finder
          </button>
          <button
            className="secondary"
            type="button"
            onClick={onExport}
            disabled={
              !selectedEntry || selectedEntry.is_dir || !canUseNativeBridge
            }
          >
            Export
          </button>
        </div>
      </div>

      <div className="content-toolbar">
        <div className="filter-chips">
          {(
            [
              ["all", "All"],
              ["folders", "Folders"],
              ["epub", "EPUB"],
              ["pdf", "PDF"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={`filter-chip ${filterKey === value ? "filter-chip--active" : ""}`}
              type="button"
              onClick={() => onFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="selection-summary">
          {selectedPaths.length
            ? `${selectedPaths.length} item${selectedPaths.length === 1 ? "" : "s"} selected`
            : transferState || "Choose a file to inspect or export"}
        </div>
      </div>

      <div className="content-list">
        {isSearching ? (
          <div className="content-search-state">
            Showing results for <strong>{searchQuery}</strong>
          </div>
        ) : null}
        <div className="content-list__header">
          <span>Select</span>
          <span>Item</span>
          <span>Type</span>
          <span>Updated</span>
          <span>Size</span>
        </div>
        {visibleEntries.length ? (
          visibleEntries.map((entry) => {
            const kind = entry.is_dir ? "Folder" : fileKindLabel(entry);
            return (
              <button
                key={entry.relative_path}
                className={`content-row ${selectedEntry?.relative_path === entry.relative_path ? "content-row--selected" : ""}`}
                type="button"
                onClick={() => {
                  onOpenEntry(entry);
                }}
                onDoubleClick={() => {
                  if (entry.is_dir) {
                    onNavigate(entry.relative_path);
                    return;
                  }
                  onOpenEntry(entry);
                }}
              >
                <span>
                  <input
                    aria-label={`Select ${entry.name}`}
                    type="checkbox"
                    checked={selectedPaths.includes(entry.relative_path)}
                    onChange={() => onToggleSelectedPath(entry.relative_path)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </span>
                <span className="content-row__name">
                  <span className="content-row__icon">
                    {iconForEntry(entry, false)}
                  </span>
                  <span>
                    <strong>{stripDisplayExtension(entry.name)}</strong>
                    <small>{entry.relative_path}</small>
                  </span>
                </span>
                <span>{entry.is_dir ? "Folder" : kind}</span>
                <span>{formatDate(entry.modified_at)}</span>
                <span>{entry.is_dir ? "--" : formatBytes(entry.size)}</span>
              </button>
            );
          })
        ) : (
          <div className="empty-list">This folder is empty.</div>
        )}
      </div>
    </section>
  );
});

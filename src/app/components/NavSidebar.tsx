import { ChevronLeft, ChevronRight, FolderOpen, Search } from "lucide-react";
import Tree from "rc-tree";
import type { ReactNode } from "react";
import type { ReaderEntry, ReaderState } from "../../types";
import { iconForEntry, stripDisplayExtension } from "../helpers";

type TreeNode = {
  key: string;
  title: ReactNode;
  isLeaf?: boolean;
  children?: TreeNode[];
};

type NavSidebarProps = {
  collapsed: boolean;
  navCardCollapsed: boolean;
  modelLabel: string;
  device: ReaderState;
  searchQuery: string;
  treeNodes: TreeNode[];
  expandedKeys: string[];
  currentDir: string;
  onToggleCollapsed: () => void;
  onOpenDevice: () => void;
  onSearchChange: (value: string) => void;
  onExpandKeys: (keys: string[], expandedNode?: string) => void;
  onSelectDirectory: (path: string) => void;
};

function toTreeNode(entry: ReaderEntry): TreeNode {
  return {
    key: entry.relative_path,
    title: (
      <span className="tree-label">
        {iconForEntry(entry, false)}
        <span>
          {entry.relative_path === "database/media/books"
            ? "Books"
            : stripDisplayExtension(entry.name)}
        </span>
      </span>
    ),
    isLeaf: false,
  };
}

export { toTreeNode };

export function NavSidebar({
  collapsed,
  modelLabel,
  device,
  searchQuery,
  treeNodes,
  expandedKeys,
  currentDir,
  onToggleCollapsed,
  onOpenDevice,
  onSearchChange,
  onExpandKeys,
  onSelectDirectory,
}: NavSidebarProps) {
  return (
    <aside
      className={`workspace__nav ${collapsed ? "workspace__nav--collapsed" : ""}`}
    >
      {/* Toggle row — always visible */}
      <div className="pane-heading">
        {!collapsed ? <p className="eyebrow">Reader</p> : <span />}
        <button
          className="secondary icon-button"
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </div>

      {!collapsed ? (
        <>
          {/* Device card section */}
          <div className="nav-device-section">
            <button
              className="nav-card__device"
              type="button"
              onClick={onOpenDevice}
            >
              <div>
                <strong>{modelLabel}</strong>
                <span>
                  {device.volume_name || device.reader_path || "Mounted volume"}
                </span>
              </div>
              <span>{device.mounted_volumes || 1} vol</span>
            </button>
          </div>

          {/* Tree + search section */}
          <div className="nav-tree-section">
            <p className="eyebrow">Library</p>
            <div className="nav-card__search">
              <Search size={14} />
              <input
                aria-label="Search reader files"
                type="search"
                placeholder="Search files…"
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
            <Tree
              className="reader-tree"
              treeData={treeNodes}
              expandedKeys={expandedKeys}
              selectedKeys={[currentDir]}
              onExpand={(keys, info) => {
                onExpandKeys(
                  keys as string[],
                  info.expanded ? String(info.node.key) : undefined,
                );
              }}
              onSelect={(keys, info) => {
                const key = String(keys[0] || info.node.key || "");
                if (!key) return;
                onSelectDirectory(key);
              }}
            />
          </div>
        </>
      ) : (
        /* Collapsed icon strip */
        <div className="nav-card--collapsed-actions">
          <button
            className="secondary icon-button"
            type="button"
            aria-label="Search"
            onClick={onToggleCollapsed}
          >
            <Search size={15} />
          </button>
          <button
            className="secondary icon-button"
            type="button"
            aria-label="Device details"
            onClick={onOpenDevice}
          >
            <FolderOpen size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}

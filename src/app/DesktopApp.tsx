import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileText,
  Folder,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
} from "lucide-react";
import Tree from "rc-tree";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { startDrag } from "@crabnebula/tauri-plugin-drag";

import type {
  AppMode,
  DrawerView,
  ReaderEntry,
  ReaderEntryDetails,
  ReaderPreview,
  ReaderState,
} from "../types";
import { assetUrl, breadcrumbParts, formatBytes, formatDate } from "../utils";

type TreeNode = {
  key: string;
  title: ReactNode;
  isLeaf?: boolean;
  children?: TreeNode[];
};

type DesktopAppProps = {
  mode: AppMode;
};

const previewDevice: ReaderState = {
  desktop: true,
  reader_available: true,
  launcher_available: true,
  reader_path: "/Volumes/READER",
  launcher_path: "/Volumes/LAUNCHER",
  model: "PRS-300",
  total_space: "465.0 MB",
  free_space: "445.1 MB",
  used_space: "19.9 MB",
  total_bytes: 487587840,
  free_bytes: 466721792,
  used_bytes: 20866048,
  volume_name: "READER",
  filesystem_type: "msdos",
  filesystem_name: "MS-DOS FAT16",
  mounted_volumes: 2,
};

const previewEntries: Record<string, ReaderEntry[]> = {
  "": [
    {
      name: "Digital Editions",
      relative_path: "Digital Editions",
      absolute_path: "/Volumes/READER/Digital Editions",
      is_dir: true,
      size: 0,
      extension: null,
      modified_at: null,
    },
    {
      name: "Documents",
      relative_path: "Documents",
      absolute_path: "/Volumes/READER/Documents",
      is_dir: true,
      size: 0,
      extension: null,
      modified_at: null,
    },
    {
      name: "database",
      relative_path: "database",
      absolute_path: "/Volumes/READER/database",
      is_dir: true,
      size: 0,
      extension: null,
      modified_at: null,
    },
  ],
  database: [
    {
      name: "media",
      relative_path: "database/media",
      absolute_path: "/Volumes/READER/database/media",
      is_dir: true,
      size: 0,
      extension: null,
      modified_at: null,
    },
  ],
  "database/media": [
    {
      name: "books",
      relative_path: "database/media/books",
      absolute_path: "/Volumes/READER/database/media/books",
      is_dir: true,
      size: 0,
      extension: null,
      modified_at: null,
    },
  ],
  "database/media/books": [
    {
      name: "Mollick, Ethan",
      relative_path: "database/media/books/Mollick, Ethan",
      absolute_path: "/Volumes/READER/database/media/books/Mollick, Ethan",
      is_dir: true,
      size: 0,
      extension: null,
      modified_at: null,
    },
    {
      name: "Eat, Pray, Love.epub",
      relative_path: "database/media/books/Eat,_Pray,_Love.epub",
      absolute_path:
        "/Volumes/READER/database/media/books/Eat,_Pray,_Love.epub",
      is_dir: false,
      size: 1800123,
      extension: "epub",
      modified_at: 1709182800,
    },
    {
      name: "Harvests of Joy.epub",
      relative_path: "database/media/books/Harvests of Joy.epub",
      absolute_path:
        "/Volumes/READER/database/media/books/Harvests of Joy.epub",
      is_dir: false,
      size: 1521420,
      extension: "epub",
      modified_at: 1709265600,
    },
    {
      name: "The House of Mondavi.epub",
      relative_path: "database/media/books/The House of Mondavi.epub",
      absolute_path:
        "/Volumes/READER/database/media/books/The House of Mondavi.epub",
      is_dir: false,
      size: 1622340,
      extension: "epub",
      modified_at: 1709352000,
    },
  ],
  "database/media/books/Mollick, Ethan": [
    {
      name: "Co-Intelligence - Mollick, Ethan_16.epub",
      relative_path:
        "database/media/books/Mollick, Ethan/Co-Intelligence - Mollick, Ethan_16.epub",
      absolute_path:
        "/Volumes/READER/database/media/books/Mollick, Ethan/Co-Intelligence - Mollick, Ethan_16.epub",
      is_dir: false,
      size: 2388400,
      extension: "epub",
      modified_at: 1711195200,
    },
  ],
  Documents: [
    {
      name: "Collections",
      relative_path: "Documents/Collections",
      absolute_path: "/Volumes/READER/Documents/Collections",
      is_dir: true,
      size: 0,
      extension: null,
      modified_at: null,
    },
    {
      name: "The Left Hand of Darkness.epub",
      relative_path: "Documents/The Left Hand of Darkness.epub",
      absolute_path: "/Volumes/READER/Documents/The Left Hand of Darkness.epub",
      is_dir: false,
      size: 1468006,
      extension: "epub",
      modified_at: 1710185100,
    },
    {
      name: "Piranesi.epub",
      relative_path: "Documents/Piranesi.epub",
      absolute_path: "/Volumes/READER/Documents/Piranesi.epub",
      is_dir: false,
      size: 841212,
      extension: "epub",
      modified_at: 1711101600,
    },
    {
      name: "Essays.pdf",
      relative_path: "Documents/Essays.pdf",
      absolute_path: "/Volumes/READER/Documents/Essays.pdf",
      is_dir: false,
      size: 2860081,
      extension: "pdf",
      modified_at: 1709504400,
    },
  ],
  "Documents/Collections": [
    {
      name: "Fiction",
      relative_path: "Documents/Collections/Fiction",
      absolute_path: "/Volumes/READER/Documents/Collections/Fiction",
      is_dir: true,
      size: 0,
      extension: null,
      modified_at: null,
    },
  ],
  "Digital Editions": [],
};

export function DesktopApp({ mode }: DesktopAppProps) {
  const canUseNativeBridge = mode === "live" && "__TAURI_INTERNALS__" in window;
  const [device, setDevice] = useState<ReaderState>({
    desktop: mode === "live",
    reader_available: false,
    launcher_available: false,
    reader_path: null,
    launcher_path: null,
    model: null,
    total_space: null,
    free_space: null,
    used_space: null,
    total_bytes: null,
    free_bytes: null,
    used_bytes: null,
    volume_name: null,
    filesystem_type: null,
    filesystem_name: null,
    mounted_volumes: 0,
  });
  const [status, setStatus] = useState("Looking for a connected reader");
  const [currentDir, setCurrentDir] = useState("");
  const [entries, setEntries] = useState<ReaderEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<ReaderEntry | null>(null);
  const [selectedEntryDetails, setSelectedEntryDetails] =
    useState<ReaderEntryDetails | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<ReaderPreview | null>(
    null,
  );
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [drawerView, setDrawerView] = useState<DrawerView>({ kind: "closed" });
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "type" | "date" | "size">(
    "name",
  );
  const [filterKey, setFilterKey] = useState<
    "all" | "folders" | "epub" | "pdf"
  >("all");
  const [transferState, setTransferState] = useState<string | null>(null);

  useEffect(() => {
    void refreshDevice();
  }, []);

  useEffect(() => {
    if (!canUseNativeBridge) {
      return;
    }

    const webview = getCurrentWebview();
    let unlisten: (() => void) | undefined;

    void webview
      .onDragDropEvent(async (event) => {
        if (event.payload.type === "over") {
          document.body.classList.add("drag-target-active");
          setDragActive(true);
          return;
        }

        if (event.payload.type === "leave") {
          document.body.classList.remove("drag-target-active");
          setDragActive(false);
          return;
        }

        document.body.classList.remove("drag-target-active");
        setDragActive(false);
        const paths = event.payload.paths;
        if (paths.length === 0 || !device.reader_available) {
          return;
        }

        await copyIntoReader(paths);
      })
      .then((listener) => {
        unlisten = listener;
      });

    return () => {
      document.body.classList.remove("drag-target-active");
      setDragActive(false);
      unlisten?.();
    };
  }, [canUseNativeBridge, currentDir, device.reader_available, mode]);

  async function refreshDevice() {
    setStatus("Checking mounted Sony volumes");
    setCheckedAt(
      new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    );

    if (mode === "preview") {
      setDevice(previewDevice);
      setStatus("Reader connected");
      await loadDirectory("database/media/books", previewDevice, true);
      return;
    }

    if (!canUseNativeBridge) {
      setStatus("Connect a Sony Reader to view live device information");
      setDevice((current) => ({ ...current, reader_available: false }));
      return;
    }

    try {
      const nextState = await invoke<ReaderState>("get_reader_state");
      setDevice(nextState);

      if (!nextState.reader_available) {
        setStatus("No reader connected");
        setCurrentDir("");
        setEntries([]);
        setTreeNodes([]);
        setSelectedEntry(null);
        setSelectedEntryDetails(null);
        setSelectedPreview(null);
        setSelectedPaths([]);
        setDrawerView({ kind: "closed" });
        return;
      }

      setStatus(`Connected to ${nextState.model || "Sony Reader"}`);
      await loadDirectory("", nextState, false);
    } catch (error) {
      setStatus(`Device check failed: ${String(error)}`);
    }
  }

  async function listEntries(path: string): Promise<ReaderEntry[]> {
    if (mode === "preview") {
      return previewEntries[path] || [];
    }

    return invoke<ReaderEntry[]>("list_reader_entries", { relativePath: path });
  }

  async function loadDirectory(
    path: string,
    state: ReaderState,
    preferDocuments: boolean,
  ) {
    if (!state.reader_available) {
      return;
    }

    const targetPath = preferDocuments
      ? path
      : path || (await resolveInitialPath());
    const nextEntries = await listEntries(targetPath);
    setCurrentDir(targetPath);
    setEntries(nextEntries);
    setSelectedEntry(null);
    setSelectedEntryDetails(null);
    setSelectedPreview(null);
    setSelectedPaths([]);
    setDrawerView({ kind: "closed" });

    const rootNodes = await buildTreeRoots();
    setTreeNodes(rootNodes);
    setExpandedKeys(
      targetPath
        ? targetPath.split("/").reduce<string[]>((acc, _, index, arr) => {
            const key = arr.slice(0, index + 1).join("/");
            acc.push(key);
            return acc;
          }, [])
        : [],
    );
  }

  async function resolveInitialPath() {
    for (const preferredPath of preferredRoots()) {
      try {
        const items = await listEntries(preferredPath);
        if (items.length > 0 || preferredPath) {
          return preferredPath;
        }
      } catch {
        continue;
      }
    }

    const rootEntries = await listEntries("");
    return rootEntries.find((entry) => entry.is_dir)?.relative_path || "";
  }

  async function buildTreeRoots(): Promise<TreeNode[]> {
    const rootEntries = (await listEntries(""))
      .filter((entry) => entry.is_dir)
      .map(toTreeNode);

    const quickRoots: TreeNode[] = [];
    for (const preferredPath of preferredRoots().filter(Boolean)) {
      try {
        const parts = preferredPath.split("/");
        const title =
          parts[parts.length - 1] === "books"
            ? "Books"
            : parts[parts.length - 1];
        quickRoots.push({
          key: preferredPath,
          title,
          isLeaf: false,
        });
      } catch {
        continue;
      }
    }

    const unique = new Map<string, TreeNode>();
    [...quickRoots, ...rootEntries].forEach((node) =>
      unique.set(node.key, node),
    );
    return [...unique.values()];
  }

  async function loadTreeChildren(nodeKey: string) {
    const children = (await listEntries(nodeKey))
      .filter((entry) => entry.is_dir)
      .map(toTreeNode);
    setTreeNodes((current) => updateTreeChildren(current, nodeKey, children));
  }

  async function searchEntries(query: string) {
    const trimmed = query.trim();
    setSearchQuery(query);

    if (!trimmed) {
      setIsSearching(false);
      await loadDirectory(currentDir, device, mode === "preview");
      return;
    }

    setIsSearching(true);
    setStatus(`Searching for "${trimmed}"`);

    if (mode === "preview") {
      const flattened = Object.values(previewEntries)
        .flat()
        .filter(
          (entry, index, all) =>
            all.findIndex(
              (item) => item.relative_path === entry.relative_path,
            ) === index,
        )
        .filter((entry) =>
          entry.name.toLowerCase().includes(trimmed.toLowerCase()),
        );
      setEntries(flattened);
      setSelectedEntry(null);
      setSelectedEntryDetails(null);
      setSelectedPreview(null);
      setSelectedPaths([]);
      setDrawerView({ kind: "closed" });
      return;
    }

    const results = await invoke<ReaderEntry[]>("search_reader_entries", {
      query: trimmed,
    });
    setEntries(results);
    setSelectedEntry(null);
    setSelectedEntryDetails(null);
    setSelectedPreview(null);
    setSelectedPaths([]);
    setDrawerView({ kind: "closed" });
  }

  async function openEntry(entry: ReaderEntry) {
    setSelectedEntry(entry);

    const details: ReaderEntryDetails =
      mode === "preview"
        ? {
            ...entry,
            item_count: entry.is_dir
              ? (previewEntries[entry.relative_path] || []).length
              : null,
          }
        : await invoke<ReaderEntryDetails>("get_reader_entry_details", {
            relativePath: entry.relative_path,
          });

    setSelectedEntryDetails(details);
    if (mode === "preview") {
      setSelectedPreview(
        details.extension === "epub" || details.extension === "pdf"
          ? {
              mime_type: "image/svg+xml",
              data_url: assetUrl("brand-mark.svg"),
            }
          : null,
      );
    } else if (details.extension === "epub" || details.extension === "pdf") {
      const preview = await invoke<ReaderPreview | null>("get_reader_preview", {
        relativePath: entry.relative_path,
      });
      setSelectedPreview(preview);
    } else {
      setSelectedPreview(null);
    }
    setDetailsCollapsed(false);
    setDrawerView({ kind: "entry", entry });
  }

  async function copyIntoReader(sourcePaths: string[]) {
    setTransferState(
      `Copying ${sourcePaths.length} file${sourcePaths.length === 1 ? "" : "s"}`,
    );
    setStatus(
      `Copying ${sourcePaths.length} file${sourcePaths.length === 1 ? "" : "s"} to the reader`,
    );
    await invoke("copy_files_to_reader", {
      sourcePaths,
      targetRelativeDir: currentDir,
    });
    await loadDirectory(currentDir, device, mode === "preview");
    setStatus(
      `Imported ${sourcePaths.length} item${sourcePaths.length === 1 ? "" : "s"}`,
    );
    setTransferState(
      `Imported ${sourcePaths.length} item${sourcePaths.length === 1 ? "" : "s"}`,
    );
  }

  async function importFromDisk() {
    if (!canUseNativeBridge || !device.reader_available) {
      return;
    }

    const selected = await open({
      multiple: true,
      filters: [{ name: "Books", extensions: ["epub", "pdf", "txt"] }],
    });

    if (!selected) {
      return;
    }

    const paths = Array.isArray(selected) ? selected : [selected];
    await copyIntoReader(paths);
  }

  async function exportSelected() {
    if (!selectedEntry || selectedEntry.is_dir || !canUseNativeBridge) {
      return;
    }

    const destination = await save({ defaultPath: selectedEntry.name });
    if (!destination) {
      return;
    }

    await invoke("export_reader_file", {
      relativePath: selectedEntry.relative_path,
      destinationPath: destination,
    });

    setStatus(`Exported ${selectedEntry.name}`);
    setTransferState(`Exported ${selectedEntry.name}`);
  }

  async function revealSelected() {
    if (!selectedEntry || !canUseNativeBridge) {
      return;
    }

    await invoke("reveal_in_finder", {
      absolutePath: selectedEntry.absolute_path,
    });
    setStatus(`Revealed ${selectedEntry.name} in Finder`);
  }

  async function dragSelectedToFinder() {
    if (!canUseNativeBridge || selectedPaths.length === 0) {
      return;
    }

    const dragPaths = visibleEntries
      .filter(
        (entry) => selectedPaths.includes(entry.relative_path) && !entry.is_dir,
      )
      .map((entry) => entry.absolute_path);

    if (dragPaths.length === 0) {
      return;
    }

    const icon = createDragIconDataUrl();
    await startDrag({
      item: dragPaths,
      icon,
    });
  }

  const usagePercent = useMemo(() => {
    if (!device.total_bytes || !device.used_bytes) {
      return 0;
    }

    return Math.round((device.used_bytes / device.total_bytes) * 100);
  }, [device.total_bytes, device.used_bytes]);

  const breadcrumbs = breadcrumbParts(currentDir);
  const drawerOpen = drawerView.kind !== "closed";
  const modelLabel = device.model || device.volume_name || "Sony Reader";
  const visibleEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (filterKey === "all") {
        return true;
      }

      if (filterKey === "folders") {
        return entry.is_dir;
      }

      return entry.extension?.toLowerCase() === filterKey;
    });

    return [...filtered].sort((left, right) => {
      switch (sortKey) {
        case "size":
          return right.size - left.size;
        case "date":
          return (right.modified_at || 0) - (left.modified_at || 0);
        case "type": {
          const leftType = left.is_dir ? "folder" : left.extension || "file";
          const rightType = right.is_dir ? "folder" : right.extension || "file";
          return (
            leftType.localeCompare(rightType) ||
            left.name.localeCompare(right.name)
          );
        }
        case "name":
        default:
          return left.name.localeCompare(right.name);
      }
    });
  }, [entries, filterKey, sortKey]);

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div>
          <p className="eyebrow">Sony eBook Library Revival</p>
          <h1>Reader manager</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="secondary icon-button"
            type="button"
            onClick={() => setNavCollapsed((current) => !current)}
          >
            {navCollapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <button
            className="secondary icon-button"
            type="button"
            onClick={() => setDetailsCollapsed((current) => !current)}
            disabled={drawerView.kind === "closed"}
          >
            {detailsCollapsed ? (
              <PanelRightOpen size={18} />
            ) : (
              <PanelRightClose size={18} />
            )}
          </button>
          <button
            className="secondary"
            onClick={() => void refreshDevice()}
            type="button"
          >
            Refresh
          </button>
        </div>
      </header>

      <section
        className="device-banner"
        onClick={() => setDrawerView({ kind: "device" })}
      >
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

      {!device.reader_available ? (
        <DisconnectedState onRefresh={() => void refreshDevice()} />
      ) : (
        <div
          className={`workspace ${drawerOpen && !detailsCollapsed ? "workspace--drawer-open" : ""} ${navCollapsed ? "workspace--nav-collapsed" : ""}`}
        >
          <aside
            className={`workspace__nav ${navCollapsed ? "workspace__nav--collapsed" : ""}`}
          >
            <div className="nav-card">
              <div className="pane-heading">
                {!navCollapsed ? <p className="eyebrow">Reader</p> : <span />}
                <button
                  className="secondary icon-button"
                  type="button"
                  onClick={() => setNavCollapsed((current) => !current)}
                >
                  {navCollapsed ? (
                    <ChevronRight size={16} />
                  ) : (
                    <ChevronLeft size={16} />
                  )}
                </button>
              </div>
              <button
                className="nav-card__device"
                type="button"
                onClick={() => setDrawerView({ kind: "device" })}
              >
                <div>
                  <strong>{modelLabel}</strong>
                  <span>
                    {device.volume_name ||
                      device.reader_path ||
                      "Mounted volume"}
                  </span>
                </div>
                <span>{device.mounted_volumes || 1} volumes</span>
              </button>
            </div>
            {!navCollapsed ? (
              <div className="nav-card nav-card--tree">
                <p className="eyebrow">Library tree</p>
                <div className="nav-card__search">
                  <Search size={16} />
                  <input
                    aria-label="Search reader files"
                    type="search"
                    placeholder="Search files and folders"
                    value={searchQuery}
                    onChange={(event) => void searchEntries(event.target.value)}
                  />
                </div>
                <Tree
                  className="reader-tree"
                  treeData={treeNodes}
                  expandedKeys={expandedKeys}
                  selectedKeys={[currentDir]}
                  onExpand={(keys, info) => {
                    setExpandedKeys(keys as string[]);
                    if (info.expanded) {
                      void loadTreeChildren(String(info.node.key));
                    }
                  }}
                  onSelect={(keys, info) => {
                    const key = String(keys[0] || info.node.key || "");
                    if (!key) {
                      return;
                    }

                    setIsSearching(false);
                    setSearchQuery("");
                    setCurrentDir(key);
                    void loadDirectory(key, device, mode === "preview");
                  }}
                />
              </div>
            ) : (
              <div className="nav-card nav-card--collapsed-actions">
                <button
                  className="secondary icon-button"
                  type="button"
                  onClick={() => setNavCollapsed(false)}
                >
                  <Search size={16} />
                </button>
                <button
                  className="secondary icon-button"
                  type="button"
                  onClick={() => setDrawerView({ kind: "device" })}
                >
                  <FolderOpen size={16} />
                </button>
              </div>
            )}
          </aside>

          <section className="workspace__main">
            {dragActive ? (
              <div className="drop-overlay">
                <div className="drop-overlay__panel">
                  <Download size={28} />
                  <strong>
                    Drop books to import into{" "}
                    {breadcrumbs[breadcrumbs.length - 1]?.label || "Reader"}
                  </strong>
                  <span>
                    EPUB, PDF, TXT and other supported reader files will be
                    copied into the current folder.
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
                      onClick={() => {
                        setIsSearching(false);
                        setSearchQuery("");
                        void loadDirectory(
                          part.path,
                          device,
                          mode === "preview",
                        );
                      }}
                    >
                      {part.label}
                      {index < breadcrumbs.length - 1 ? <span>/</span> : null}
                    </button>
                  ))}
                </div>
                <h2>
                  {breadcrumbs[breadcrumbs.length - 1]?.label || "Reader"}
                </h2>
              </div>
              <div className="content-actions">
                <select
                  aria-label="Sort files"
                  value={sortKey}
                  onChange={(event) =>
                    setSortKey(
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
                  onClick={() => void importFromDisk()}
                  disabled={!canUseNativeBridge}
                >
                  Import books
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => {
                    if (selectedEntry) {
                      setDetailsCollapsed(false);
                      setDrawerView({ kind: "entry", entry: selectedEntry });
                    } else {
                      setDetailsCollapsed(false);
                      setDrawerView({ kind: "device" });
                    }
                  }}
                  disabled={!selectedEntry}
                >
                  Details
                </button>
                <button
                  className="secondary"
                  type="button"
                  onMouseDown={() => void dragSelectedToFinder()}
                  disabled={!selectedPaths.length || !canUseNativeBridge}
                >
                  <ExternalLink size={16} />
                  Drag to Finder
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => void exportSelected()}
                  disabled={
                    !selectedEntry ||
                    selectedEntry.is_dir ||
                    !canUseNativeBridge
                  }
                >
                  Export
                </button>
              </div>
            </div>

            <div className="content-toolbar">
              <div className="filter-chips">
                {[
                  ["all", "All"],
                  ["folders", "Folders"],
                  ["epub", "EPUB"],
                  ["pdf", "PDF"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`filter-chip ${filterKey === value ? "filter-chip--active" : ""}`}
                    type="button"
                    onClick={() =>
                      setFilterKey(value as "all" | "folders" | "epub" | "pdf")
                    }
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
                        setSelectedPaths([entry.relative_path]);
                        void openEntry(entry);
                      }}
                      onDoubleClick={() => {
                        if (entry.is_dir) {
                          setIsSearching(false);
                          setSearchQuery("");
                          void loadDirectory(
                            entry.relative_path,
                            device,
                            mode === "preview",
                          );
                          return;
                        }

                        void openEntry(entry);
                      }}
                    >
                      <span>
                        <input
                          aria-label={`Select ${entry.name}`}
                          type="checkbox"
                          checked={selectedPaths.includes(entry.relative_path)}
                          onChange={() => {
                            setSelectedPaths((current) =>
                              current.includes(entry.relative_path)
                                ? current.filter(
                                    (path) => path !== entry.relative_path,
                                  )
                                : [...current, entry.relative_path],
                            );
                          }}
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
                      <span>
                        {entry.is_dir ? "--" : formatBytes(entry.size)}
                      </span>
                    </button>
                  );
                })
              ) : (
                <div className="empty-list">This folder is empty.</div>
              )}
            </div>
          </section>

          <DetailsDrawer
            collapsed={detailsCollapsed}
            checkedAt={checkedAt}
            device={device}
            drawerView={drawerView}
            selectedEntryDetails={selectedEntryDetails}
            selectedPreview={selectedPreview}
            modelLabel={modelLabel}
            onClose={() => setDrawerView({ kind: "closed" })}
            onReveal={() => void revealSelected()}
            onExport={() => void exportSelected()}
            onToggleCollapsed={() => setDetailsCollapsed((current) => !current)}
          />
        </div>
      )}
    </main>
  );
}

function DisconnectedState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <section className="disconnected-state">
      <div className="disconnected-state__art" aria-hidden="true">
        <div className="device-illustration">
          <div className="device-illustration__screen" />
        </div>
      </div>
      <div className="disconnected-state__copy">
        <p className="eyebrow">Waiting for a reader</p>
        <h2>Connect your Sony Reader to begin.</h2>
        <p>
          Plug the device in over USB to browse its library, move books, and see
          storage details. Live information only appears when a reader is
          mounted on your Mac.
        </p>
        <button className="primary" type="button" onClick={onRefresh}>
          Refresh device
        </button>
      </div>
    </section>
  );
}

function DetailsDrawer({
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
}: {
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
}) {
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
              Reveal in Finder
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

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

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

function fileKindLabel(entry: ReaderEntry): string {
  if (entry.extension?.toLowerCase() === "epub") return "EPUB";
  if (entry.extension?.toLowerCase() === "pdf") return "PDF";
  if (entry.extension?.toLowerCase() === "zip") return "ZIP";
  if (entry.extension?.toLowerCase() === "lrf") return "LRF";
  return "File";
}

function stripDisplayExtension(name: string): string {
  return name.replace(/\.(epub|pdf|zip|lrf|txt|rtf)$/i, "");
}

function iconForEntry(entry: ReaderEntry, large: boolean) {
  const size = large ? 56 : 20;
  if (entry.is_dir) {
    return <Folder size={size} />;
  }
  switch ((entry.extension || "").toLowerCase()) {
    case "epub":
    case "lrf":
      return <BookOpen size={size} />;
    case "pdf":
      return <FileText size={size} />;
    case "zip":
      return <FileArchive size={size} />;
    default:
      return <File size={size} />;
  }
}

function preferredRoots(): string[] {
  return ["database/media/books", "Documents", "Digital Editions", ""];
}

function createDragIconDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sO38p8AAAAASUVORK5CYII=";
  }

  context.fillStyle = "#6d4c33";
  context.beginPath();
  context.roundRect(8, 8, 80, 80, 20);
  context.fill();
  context.fillStyle = "#fff9f2";
  context.font = "600 18px Avenir Next";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("BOOK", 48, 48);
  return canvas.toDataURL("image/png");
}

function updateTreeChildren(
  nodes: TreeNode[],
  key: string,
  children: TreeNode[],
): TreeNode[] {
  return nodes.map((node) => {
    if (node.key === key) {
      return { ...node, children };
    }

    if (node.children) {
      return {
        ...node,
        children: updateTreeChildren(node.children, key, children),
      };
    }

    return node;
  });
}

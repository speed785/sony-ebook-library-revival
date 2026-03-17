import { useEffect, useMemo, useRef, useState } from "react";
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
import { assetUrl } from "../utils";
import { createDragIconDataUrl, preferredRoots } from "./helpers";
import { toTreeNode } from "./components/NavSidebar";

import { Topbar } from "./components/Topbar";
import { DeviceBanner } from "./components/DeviceBanner";
import { NavSidebar } from "./components/NavSidebar";
import { ContentList } from "./components/ContentList";
import { DetailsDrawer } from "./components/DetailsDrawer";
import { DisconnectedState } from "./components/DisconnectedState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TreeNode = {
  key: string;
  title: React.ReactNode;
  isLeaf?: boolean;
  children?: TreeNode[];
};

type DesktopAppProps = {
  mode: AppMode;
};

// ---------------------------------------------------------------------------
// Preview data (mode === "preview")
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function DesktopApp({ mode }: DesktopAppProps) {
  const canUseNativeBridge = mode === "live" && "__TAURI_INTERNALS__" in window;

  // --- State ---
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

  // Debounce timer for search — avoids firing IPC on every keystroke.
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Effects ---
  useEffect(() => {
    void refreshDevice();
  }, []);

  useEffect(() => {
    if (!canUseNativeBridge) return;

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
        if (paths.length === 0 || !device.reader_available) return;
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

  // --- IPC helpers ---
  async function listEntries(path: string): Promise<ReaderEntry[]> {
    if (mode === "preview") return previewEntries[path] || [];
    return invoke<ReaderEntry[]>("list_reader_entries", { relativePath: path });
  }

  async function resolveInitialPath() {
    for (const preferred of preferredRoots()) {
      try {
        const items = await listEntries(preferred);
        if (items.length > 0 || preferred) return preferred;
      } catch {
        continue;
      }
    }
    const rootEntries = await listEntries("");
    return rootEntries.find((e) => e.is_dir)?.relative_path || "";
  }

  async function buildTreeRoots(): Promise<TreeNode[]> {
    const rootEntries = (await listEntries(""))
      .filter((e) => e.is_dir)
      .map(toTreeNode);

    const quickRoots: TreeNode[] = [];
    for (const preferred of preferredRoots().filter(Boolean)) {
      const parts = preferred.split("/");
      const title =
        parts[parts.length - 1] === "books" ? "Books" : parts[parts.length - 1];
      quickRoots.push({ key: preferred, title, isLeaf: false });
    }

    const unique = new Map<string, TreeNode>();
    [...quickRoots, ...rootEntries].forEach((node) =>
      unique.set(node.key, node),
    );
    return [...unique.values()];
  }

  async function loadDirectory(
    path: string,
    state: ReaderState,
    preferDocuments: boolean,
  ) {
    if (!state.reader_available) return;

    const targetPath = preferDocuments
      ? path
      : path || (await resolveInitialPath());

    // Fetch directory contents and rebuild the tree roots in parallel to
    // halve the number of sequential IPC round-trips on every navigation.
    const [nextEntries, rootNodes] = await Promise.all([
      listEntries(targetPath),
      buildTreeRoots(),
    ]);

    setCurrentDir(targetPath);
    setEntries(nextEntries);
    setSelectedEntry(null);
    setSelectedEntryDetails(null);
    setSelectedPreview(null);
    setSelectedPaths([]);
    setDrawerView({ kind: "closed" });
    setTreeNodes(rootNodes);
    setExpandedKeys(
      targetPath
        ? targetPath.split("/").reduce<string[]>((acc, _, index, arr) => {
            acc.push(arr.slice(0, index + 1).join("/"));
            return acc;
          }, [])
        : [],
    );
  }

  async function loadTreeChildren(nodeKey: string) {
    const children = (await listEntries(nodeKey))
      .filter((e) => e.is_dir)
      .map(toTreeNode);
    setTreeNodes((current) => updateTreeChildren(current, nodeKey, children));
  }

  // --- Search with debounce ---
  function searchEntries(query: string) {
    setSearchQuery(query);
    if (searchDebounceRef.current !== null)
      clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 250);
  }

  async function runSearch(query: string) {
    const trimmed = query.trim();
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

  // --- Device refresh ---
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

  // --- Entry actions ---
  async function openEntry(entry: ReaderEntry) {
    setSelectedEntry(entry);
    setSelectedPaths([entry.relative_path]);

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
          ? { mime_type: "image/svg+xml", data_url: assetUrl("brand-mark.svg") }
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
    const count = sourcePaths.length;
    const label = `${count} file${count === 1 ? "" : "s"}`;
    setTransferState(`Copying ${label}`);
    setStatus(`Copying ${label} to the reader`);
    await invoke("copy_files_to_reader", {
      sourcePaths,
      targetRelativeDir: currentDir,
    });
    await loadDirectory(currentDir, device, mode === "preview");
    setStatus(`Imported ${count} item${count === 1 ? "" : "s"}`);
    setTransferState(`Imported ${count} item${count === 1 ? "" : "s"}`);
  }

  async function importFromDisk() {
    if (!canUseNativeBridge || !device.reader_available) return;
    const selected = await open({
      multiple: true,
      filters: [{ name: "Books", extensions: ["epub", "pdf", "txt"] }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    await copyIntoReader(paths);
  }

  async function exportSelected() {
    if (!selectedEntry || selectedEntry.is_dir || !canUseNativeBridge) return;
    const destination = await save({ defaultPath: selectedEntry.name });
    if (!destination) return;
    await invoke("export_reader_file", {
      relativePath: selectedEntry.relative_path,
      destinationPath: destination,
    });
    setStatus(`Exported ${selectedEntry.name}`);
    setTransferState(`Exported ${selectedEntry.name}`);
  }

  async function revealSelected() {
    if (!selectedEntry || !canUseNativeBridge) return;
    await invoke("reveal_in_finder", {
      absolutePath: selectedEntry.absolute_path,
    });
    setStatus(`Revealed ${selectedEntry.name} in Finder`);
  }

  async function dragSelectedToFinder() {
    if (!canUseNativeBridge || selectedPaths.length === 0) return;
    const dragPaths = visibleEntries
      .filter((e) => selectedPaths.includes(e.relative_path) && !e.is_dir)
      .map((e) => e.absolute_path);
    if (dragPaths.length === 0) return;
    await startDrag({ item: dragPaths, icon: createDragIconDataUrl() });
  }

  // --- Derived ---
  const usagePercent = useMemo(() => {
    if (!device.total_bytes || !device.used_bytes) return 0;
    return Math.round((device.used_bytes / device.total_bytes) * 100);
  }, [device.total_bytes, device.used_bytes]);

  const modelLabel = device.model || device.volume_name || "Sony Reader";
  const drawerOpen = drawerView.kind !== "closed";

  const visibleEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (filterKey === "all") return true;
      if (filterKey === "folders") return entry.is_dir;
      return entry.extension?.toLowerCase() === filterKey;
    });

    return [...filtered].sort((left, right) => {
      switch (sortKey) {
        case "size":
          return right.size - left.size;
        case "date":
          return (right.modified_at || 0) - (left.modified_at || 0);
        case "type": {
          const l = left.is_dir ? "folder" : left.extension || "file";
          const r = right.is_dir ? "folder" : right.extension || "file";
          return l.localeCompare(r) || left.name.localeCompare(right.name);
        }
        case "name":
        default:
          return left.name.localeCompare(right.name);
      }
    });
  }, [entries, filterKey, sortKey]);

  // --- Render ---
  return (
    <main className="app-shell">
      <Topbar
        navCollapsed={navCollapsed}
        detailsCollapsed={detailsCollapsed}
        drawerView={drawerView}
        onToggleNav={() => setNavCollapsed((c) => !c)}
        onToggleDetails={() => setDetailsCollapsed((c) => !c)}
        onRefresh={() => void refreshDevice()}
      />

      <DeviceBanner
        device={device}
        status={status}
        usagePercent={usagePercent}
        modelLabel={modelLabel}
        onOpenDevice={() => setDrawerView({ kind: "device" })}
      />

      {!device.reader_available ? (
        <DisconnectedState onRefresh={() => void refreshDevice()} />
      ) : (
        <div
          className={`workspace ${drawerOpen && !detailsCollapsed ? "workspace--drawer-open" : ""} ${navCollapsed ? "workspace--nav-collapsed" : ""}`}
        >
          <NavSidebar
            collapsed={navCollapsed}
            navCardCollapsed={navCollapsed}
            modelLabel={modelLabel}
            device={device}
            searchQuery={searchQuery}
            treeNodes={treeNodes}
            expandedKeys={expandedKeys}
            currentDir={currentDir}
            onToggleCollapsed={() => setNavCollapsed((c) => !c)}
            onOpenDevice={() => setDrawerView({ kind: "device" })}
            onSearchChange={searchEntries}
            onExpandKeys={(keys, expandedNode) => {
              setExpandedKeys(keys);
              if (expandedNode) void loadTreeChildren(expandedNode);
            }}
            onSelectDirectory={(key) => {
              setIsSearching(false);
              setSearchQuery("");
              setCurrentDir(key);
              void loadDirectory(key, device, mode === "preview");
            }}
          />

          <ContentList
            mode={mode}
            device={device}
            canUseNativeBridge={canUseNativeBridge}
            currentDir={currentDir}
            visibleEntries={visibleEntries}
            selectedEntry={selectedEntry}
            selectedPaths={selectedPaths}
            searchQuery={searchQuery}
            isSearching={isSearching}
            transferState={transferState}
            sortKey={sortKey}
            filterKey={filterKey}
            dragActive={dragActive}
            drawerView={drawerView}
            onSortChange={setSortKey}
            onFilterChange={setFilterKey}
            onSelectPaths={setSelectedPaths}
            onToggleSelectedPath={(path) =>
              setSelectedPaths((current) =>
                current.includes(path)
                  ? current.filter((p) => p !== path)
                  : [...current, path],
              )
            }
            onOpenEntry={(entry) => void openEntry(entry)}
            onNavigate={(path) => {
              setIsSearching(false);
              setSearchQuery("");
              void loadDirectory(path, device, mode === "preview");
            }}
            onImport={() => void importFromDisk()}
            onExport={() => void exportSelected()}
            onDragToFinder={() => void dragSelectedToFinder()}
            onOpenDetails={() => {
              setDetailsCollapsed(false);
              if (selectedEntry) {
                setDrawerView({ kind: "entry", entry: selectedEntry });
              } else {
                setDrawerView({ kind: "device" });
              }
            }}
          />

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
            onToggleCollapsed={() => setDetailsCollapsed((c) => !c)}
          />
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function updateTreeChildren(
  nodes: TreeNode[],
  key: string,
  children: TreeNode[],
): TreeNode[] {
  return nodes.map((node) => {
    if (node.key === key) return { ...node, children };
    if (node.children) {
      return {
        ...node,
        children: updateTreeChildren(node.children, key, children),
      };
    }
    return node;
  });
}

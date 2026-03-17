import "./styles.css";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { save } from "@tauri-apps/plugin-dialog";

type ReaderState = {
  desktop: boolean;
  reader_available: boolean;
  launcher_available: boolean;
  reader_path: string | null;
  launcher_path: string | null;
  model: string | null;
  total_space: string | null;
  free_space: string | null;
};

type ReaderEntry = {
  name: string;
  relative_path: string;
  absolute_path: string;
  is_dir: boolean;
  size: number;
};

type UiState = {
  language: string;
  region: string;
  currentDir: string;
  device: ReaderState;
  entries: ReaderEntry[];
  selectedFile: ReaderEntry | null;
  status: string;
  desktop: boolean;
};

const labels = {
  en: "English",
  de: "German",
  fr: "French",
  nl: "Dutch",
};

const regions = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
};

const isDesktop = "__TAURI_INTERNALS__" in window;

const uiState: UiState = {
  language: localStorage.getItem("sony-revival-language") || "en",
  region: localStorage.getItem("sony-revival-region") || "US",
  currentDir: "",
  device: {
    desktop: isDesktop,
    reader_available: false,
    launcher_available: false,
    reader_path: null,
    launcher_path: null,
    model: null,
    total_space: null,
    free_space: null,
  },
  entries: [],
  selectedFile: null,
  status: isDesktop ? "Checking for Reader..." : "Web showcase mode",
  desktop: isDesktop,
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("#app element is missing");
}

app.innerHTML = `
  <main class="shell">
    <section class="window" aria-label="Sony eBook Library Revival">
      <header class="titlebar">
        <div class="titlebar__dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div>
          <p class="titlebar__eyebrow">Modern Mac remake</p>
          <p class="titlebar__title">Setup eBook Library Revival</p>
        </div>
      </header>

      <div class="frame">
        <aside class="hero">
          <div class="hero__badge">PRS Revival</div>
          <h1>Sony Reader, remade for current macOS.</h1>
          <p>
            A desktop-first tribute to the original Sony setup app, rebuilt in TypeScript and Tauri,
            with a GitHub Pages companion build for the public showcase.
          </p>
          <ul class="hero__facts">
            <li>Original setup flow reinterpreted for today</li>
            <li>Reader detection and live mounted-volume details</li>
            <li>File browser with drag-in upload and export actions</li>
          </ul>
        </aside>

        <section class="panel">
          <div class="panel__topbar">
            <div>
              <p class="eyebrow">Status</p>
              <div class="status-pill" id="status-pill"></div>
            </div>
            <div class="actions-inline">
              <button class="secondary" id="refresh-device" type="button">Refresh device</button>
              <button class="secondary" id="open-launcher" type="button">Launcher info</button>
            </div>
          </div>

          <section class="card stack-gap">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Connection</p>
                <h2>Reader snapshot</h2>
              </div>
              <div class="chip-row">
                <span class="chip" id="platform-chip"></span>
                <span class="chip" id="mode-chip"></span>
              </div>
            </div>
            <div class="device-grid" id="device-grid"></div>
          </section>

          <section class="card stack-gap">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Setup flow</p>
                <h2>Classic preferences</h2>
              </div>
            </div>
            <div class="form-grid">
              <label>
                <span>Language</span>
                <select id="language-select">
                  <option value="en">English</option>
                  <option value="de">German</option>
                  <option value="fr">French</option>
                  <option value="nl">Dutch</option>
                </select>
              </label>
              <label>
                <span>Region</span>
                <select id="region-select">
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="NL">Netherlands</option>
                </select>
              </label>
            </div>
            <div class="info-note">
              Sony's original URLs are retired. This remake preserves the setup feel, then hands off to a working modern workflow.
            </div>
          </section>

          <section class="card stack-gap card--workspace">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Library workspace</p>
                <h2>Browse and move files</h2>
              </div>
              <div class="actions-inline">
                <button class="secondary" id="up-dir" type="button">Up one level</button>
                <button class="secondary" id="reload-files" type="button">Reload files</button>
              </div>
            </div>

            <div class="toolbar">
              <div class="path-pill" id="path-pill">/</div>
              <div class="toolbar__text" id="toolbar-text">Drop books here in the desktop app.</div>
            </div>

            <div class="workspace-grid">
              <section class="dropzone" id="dropzone">
                <div>
                  <p class="dropzone__title">Import to Reader</p>
                  <p class="dropzone__body">Drag EPUB or PDF files into this app to copy them to the selected folder on the device.</p>
                </div>
                <label class="primary button-like" for="file-input">Choose files</label>
                <input id="file-input" type="file" multiple />
              </section>

              <section class="filepane">
                <div class="filepane__header">
                  <span>Name</span>
                  <span>Size</span>
                </div>
                <div class="file-list" id="file-list"></div>
              </section>
            </div>

            <div class="actions-inline actions-inline--footer">
              <button class="secondary" id="export-file" type="button">Export selected</button>
              <button class="secondary" id="reveal-file" type="button">Reveal selected</button>
              <button class="primary" id="copy-tips" type="button">Copy PRS-300 tips</button>
            </div>
          </section>
        </section>
      </div>
    </section>
  </main>
`;

const statusPill = must<HTMLDivElement>("#status-pill");
const platformChip = must<HTMLSpanElement>("#platform-chip");
const modeChip = must<HTMLSpanElement>("#mode-chip");
const deviceGrid = must<HTMLDivElement>("#device-grid");
const languageSelect = must<HTMLSelectElement>("#language-select");
const regionSelect = must<HTMLSelectElement>("#region-select");
const pathPill = must<HTMLDivElement>("#path-pill");
const toolbarText = must<HTMLDivElement>("#toolbar-text");
const fileList = must<HTMLDivElement>("#file-list");
const dropzone = must<HTMLDivElement>("#dropzone");
const fileInput = must<HTMLInputElement>("#file-input");
const refreshDevice = must<HTMLButtonElement>("#refresh-device");
const openLauncher = must<HTMLButtonElement>("#open-launcher");
const upDir = must<HTMLButtonElement>("#up-dir");
const reloadFiles = must<HTMLButtonElement>("#reload-files");
const exportFile = must<HTMLButtonElement>("#export-file");
const revealFile = must<HTMLButtonElement>("#reveal-file");
const copyTips = must<HTMLButtonElement>("#copy-tips");

languageSelect.value = uiState.language;
regionSelect.value = uiState.region;

languageSelect.addEventListener("change", () => {
  uiState.language = languageSelect.value;
  localStorage.setItem("sony-revival-language", uiState.language);
  render();
});

regionSelect.addEventListener("change", () => {
  uiState.region = regionSelect.value;
  localStorage.setItem("sony-revival-region", uiState.region);
  render();
});

refreshDevice.addEventListener("click", () => {
  void refreshDeviceState();
});

openLauncher.addEventListener("click", () => {
  if (uiState.device.launcher_available && uiState.device.launcher_path) {
    uiState.status = `Legacy launcher volume found at ${uiState.device.launcher_path}`;
  } else {
    uiState.status = "Launcher volume not detected";
  }
  render();
});

upDir.addEventListener("click", () => {
  const parts = uiState.currentDir.split("/").filter(Boolean);
  parts.pop();
  uiState.currentDir = parts.join("/");
  void loadEntries();
});

reloadFiles.addEventListener("click", () => {
  void loadEntries();
});

fileInput.addEventListener("change", () => {
  const files = Array.from(fileInput.files || []);
  if (files.length > 0) {
    void handleBrowserFiles(files);
  }
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dropzone--active");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dropzone--active");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dropzone--active");
  const files = Array.from(event.dataTransfer?.files || []);
  if (files.length > 0) {
    void handleBrowserFiles(files);
  }
});

exportFile.addEventListener("click", () => {
  void exportSelected();
});

revealFile.addEventListener("click", () => {
  void revealSelected();
});

copyTips.addEventListener("click", async () => {
  const text = [
    "EPUB works best on the PRS-300.",
    "PDF is supported, but the small screen is less comfortable.",
    "Use Calibre for metadata cleanup and send-to-device workflows.",
    "Always eject the Reader cleanly after transfers.",
  ].join("\n");

  await navigator.clipboard.writeText(text);
  uiState.status = "PRS-300 tips copied";
  render();
});

if (isDesktop) {
  void attachDesktopDropListener();
}

void refreshDeviceState();

async function refreshDeviceState(): Promise<void> {
  if (!isDesktop) {
    uiState.status = "Web showcase mode: desktop device access is disabled";
    render();
    return;
  }

  uiState.status = "Checking mounted Sony volumes...";
  render();

  try {
    uiState.device = await invoke<ReaderState>("get_reader_state");
    uiState.status = uiState.device.reader_available
      ? `Detected ${uiState.device.model || "Sony Reader"}`
      : "Reader not currently mounted";

    if (uiState.device.reader_available) {
      await loadEntries();
    } else {
      uiState.entries = [];
      uiState.selectedFile = null;
      render();
    }
  } catch (error) {
    uiState.status = `Device check failed: ${String(error)}`;
    render();
  }
}

async function loadEntries(): Promise<void> {
  if (!isDesktop || !uiState.device.reader_available) {
    render();
    return;
  }

  try {
    uiState.entries = await invoke<ReaderEntry[]>("list_reader_entries", {
      relativePath: uiState.currentDir,
    });
    uiState.selectedFile = null;
    uiState.status =
      `Viewing /${uiState.currentDir || ""}`.replace(/\/$/, "") || "/";
  } catch (error) {
    uiState.status = `Unable to list files: ${String(error)}`;
  }

  render();
}

async function handleBrowserFiles(files: File[]): Promise<void> {
  if (!isDesktop) {
    uiState.status = `Received ${files.length} file(s) in web showcase mode`;
    render();
    return;
  }

  uiState.status = `Desktop import expects files dropped from Finder. Browser-backed uploads are not copied directly.`;
  render();
}

async function attachDesktopDropListener(): Promise<void> {
  const webview = getCurrentWebview();
  await webview.onDragDropEvent(async (event) => {
    if (event.payload.type === "over") {
      dropzone.classList.add("dropzone--active");
      return;
    }

    if (event.payload.type === "leave") {
      dropzone.classList.remove("dropzone--active");
      return;
    }

    dropzone.classList.remove("dropzone--active");
    const paths = event.payload.paths;
    if (paths.length === 0) {
      return;
    }

    uiState.status = `Copying ${paths.length} file(s) to Reader...`;
    render();

    try {
      await invoke("copy_files_to_reader", {
        sourcePaths: paths,
        targetRelativeDir: uiState.currentDir,
      });
      uiState.status = `Imported ${paths.length} file(s)`;
      await loadEntries();
    } catch (error) {
      uiState.status = `Import failed: ${String(error)}`;
      render();
    }
  });
}

async function exportSelected(): Promise<void> {
  if (!isDesktop || !uiState.selectedFile || uiState.selectedFile.is_dir) {
    uiState.status = "Select a file to export";
    render();
    return;
  }

  const target = await save({
    defaultPath: uiState.selectedFile.name,
  });

  if (!target) {
    uiState.status = "Export cancelled";
    render();
    return;
  }

  try {
    await invoke("export_reader_file", {
      relativePath: uiState.selectedFile.relative_path,
      destinationPath: target,
    });
    uiState.status = `Exported ${uiState.selectedFile.name}`;
  } catch (error) {
    uiState.status = `Export failed: ${String(error)}`;
  }

  render();
}

async function revealSelected(): Promise<void> {
  if (!isDesktop || !uiState.selectedFile) {
    uiState.status = "Select a file or folder to reveal";
    render();
    return;
  }

  try {
    await invoke("reveal_in_finder", {
      absolutePath: uiState.selectedFile.absolute_path,
    });
    uiState.status = `Revealed ${uiState.selectedFile.name} in Finder`;
  } catch (error) {
    uiState.status = `Reveal failed: ${String(error)}`;
  }

  render();
}

function render(): void {
  statusPill.textContent = uiState.status;
  platformChip.textContent = uiState.desktop ? "Desktop app" : "GitHub Pages";
  modeChip.textContent = uiState.desktop ? "Live device mode" : "Showcase mode";
  pathPill.textContent = `/${uiState.currentDir}`.replace(/\/$/, "") || "/";
  toolbarText.textContent = uiState.desktop
    ? "Drag files in from Finder. Export selected items back out to your Mac."
    : "The public web build shows the interface; device access is available in the desktop app.";

  deviceGrid.innerHTML = [
    deviceTile(
      "Reader",
      uiState.device.reader_available ? "Connected" : "Not connected",
    ),
    deviceTile(
      "Launcher volume",
      uiState.device.launcher_available ? "Mounted" : "Not found",
    ),
    deviceTile("Model", uiState.device.model || "Unknown"),
    deviceTile("Capacity", uiState.device.total_space || "Unavailable"),
    deviceTile("Free space", uiState.device.free_space || "Unavailable"),
    deviceTile(
      "Locale",
      `${labels[uiState.language as keyof typeof labels]} / ${regions[uiState.region as keyof typeof regions]}`,
    ),
  ].join("");

  fileList.innerHTML = uiState.entries.length
    ? uiState.entries
        .map((entry) => {
          const selected =
            uiState.selectedFile?.relative_path === entry.relative_path
              ? " file-row--selected"
              : "";
          const icon = entry.is_dir ? "Folder" : "File";
          return `
            <button class="file-row${selected}" data-path="${entry.relative_path}" data-dir="${entry.is_dir}">
              <span>
                <strong>${icon}</strong>
                <span>${entry.name}</span>
              </span>
              <span>${entry.is_dir ? "--" : formatBytes(entry.size)}</span>
            </button>
          `;
        })
        .join("")
    : `<div class="empty-state">${uiState.device.reader_available ? "This folder is empty." : "Connect a Reader in the desktop app to browse files."}</div>`;

  for (const row of Array.from(
    fileList.querySelectorAll<HTMLButtonElement>(".file-row"),
  )) {
    row.addEventListener("click", () => {
      const path = row.dataset.path || "";
      const isDir = row.dataset.dir === "true";
      const entry =
        uiState.entries.find((item) => item.relative_path === path) || null;
      uiState.selectedFile = entry;

      if (isDir) {
        uiState.currentDir = path;
        void loadEntries();
        return;
      }

      render();
    });
  }

  const disabled = !uiState.desktop || !uiState.device.reader_available;
  upDir.disabled = disabled || uiState.currentDir.length === 0;
  reloadFiles.disabled = disabled;
  exportFile.disabled =
    !uiState.selectedFile || !!uiState.selectedFile?.is_dir || !uiState.desktop;
  revealFile.disabled = !uiState.selectedFile || !uiState.desktop;
  fileInput.disabled = disabled;
}

function deviceTile(label: string, value: string): string {
  return `
    <article class="device-tile">
      <span class="device-tile__label">${label}</span>
      <strong>${value}</strong>
    </article>
  `;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function must<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }
  return element;
}

# Sony eBook Library Revival

<p align="center">
  <img src="public/brand-mark.svg" alt="Sony eBook Library Revival icon" width="96" height="96" />
</p>

<p align="center">
  <img src="public/screenshots/app-overview.png" alt="Sony eBook Library Revival desktop app" width="900" />
</p>

A modern macOS desktop app for classic Sony Readers.

Replaces Sony's abandoned setup-era utility with a focused local workflow: browse the device, preview books, move files in and out, and manage older readers on current Macs — no storefronts, no sync services.

- Website: `https://speed785.github.io/sony-ebook-library-revival/`
- Latest release: `https://github.com/speed785/sony-ebook-library-revival/releases/latest`
- Direct download: `https://github.com/speed785/sony-ebook-library-revival/releases/latest/download/Sony-eBook-Library-Revival-macOS.dmg`

---

## What the app does

- Detects mounted Sony Reader volumes over USB on macOS
- Shows device details — model, filesystem, mounted volumes, storage usage
- Navigates the reader with a collapsible tree sidebar, file list, filter chips, and a slide-out details drawer
- Prefers real book locations (`database/media/books`) over setup folders
- Previews EPUB cover images and PDF thumbnails in the details drawer
- Imports books from Finder via file picker or drag-and-drop onto the app window
- Exports files to any destination via a native save dialog
- Reveals selected files in Finder
- Supports dragging selected files out of the app into Finder
- Search across the full device filesystem, debounced and cached for speed

## Performance

Several hot paths were optimised to eliminate the lag that appeared on larger libraries:

| Area                  | Before                                                    | After                                                               |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- |
| Reader mount path     | `diskutil` spawned on every IPC call                      | Cached in-memory for the session via `OnceLock`; cleared on Refresh |
| EPUB title extraction | ZIP opened and OPF parsed per file, per directory listing | `HashMap` cache keyed by path — each EPUB parsed once per session   |
| Search                | IPC or full flat-map fired on every keystroke             | 250 ms debounce before the search fires                             |
| Directory load        | `listEntries` + `buildTreeRoots` ran sequentially         | Both run in parallel via `Promise.all`                              |
| PDF preview           | `qlmanage` blocked the Tauri command thread               | Moved to `spawn_blocking` — UI stays responsive                     |

## Design

The app uses a **light e-paper × aero chrome** visual language:

- Cool off-white surfaces (`#f5f7fa`) with a multi-radial linen gradient background
- Single steel-blue chrome accent (`#2477e8`, desaturated to ~65% saturation)
- Frosted glass panels — `backdrop-filter: blur` with 1 px inner-border refraction
- Geist typeface (Avenir Next fallback) with tabular numerics on data columns
- Compositor-only hover transitions (`transform`, `opacity`, `background-color`) — no layout-triggering animations
- `prefers-reduced-motion` respected throughout

## Stack

| Layer       | Technology                 |
| ----------- | -------------------------- |
| UI          | React 19 + TypeScript 5    |
| Build       | Vite 7                     |
| Desktop     | Tauri 2                    |
| Backend     | Rust (2021 edition)        |
| Icons       | Lucide React               |
| Tree        | rc-tree                    |
| Tests       | Vitest 4 + Testing Library |
| Lint/format | ESLint 9 + Prettier 3      |
| CI/CD       | GitHub Actions             |

## Project structure

```
src/
├── main.tsx                  # Route: Website (web) or DesktopApp (Tauri)
├── styles.css                # Full design system — tokens, components, layout
├── types.ts                  # Shared TypeScript types
├── utils.ts                  # formatBytes, formatDate, breadcrumbParts, assetUrl
├── app/
│   ├── DesktopApp.tsx        # Root shell — all state, effects, IPC handlers (~280 lines)
│   ├── helpers.tsx           # iconForEntry, fileKindLabel, stripDisplayExtension, etc.
│   └── components/
│       ├── Topbar.tsx
│       ├── DeviceBanner.tsx
│       ├── NavSidebar.tsx
│       ├── ContentList.tsx   # React.memo — isolated from unrelated state changes
│       ├── DetailsDrawer.tsx
│       ├── DisconnectedState.tsx
│       └── DetailItem.tsx
└── site/
    └── Website.tsx           # Marketing landing page

src-tauri/src/
└── main.rs                   # Rust backend — volume detection, file ops, previews
```

## Development

Install dependencies:

```bash
npm install
```

Run the frontend only (website preview at `http://localhost:1420`):

```bash
npm run dev
```

Run the full desktop app (Vite + Rust, hot-reloads both):

```bash
npm run tauri dev
```

Run tests:

```bash
npm test
```

Generate updated screenshots from the current preview route:

```bash
npm run screenshots
```

## Quality checks

Run the full check set before pushing:

```bash
npm run check
```

This runs in order:

1. `npm run lint` — ESLint
2. `npm run format:check` — Prettier
3. `npm run test` — Vitest
4. `npm run build` — TypeScript + Vite
5. `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check`
6. `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`

Individual Rust checks:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## Building for release

```bash
npm run tauri build
```

Produces a signed `.dmg` in `src-tauri/target/release/bundle/dmg/`. Version tags like `v0.1.0` trigger the release workflow and publish the DMG automatically via GitHub Actions.

## Screenshots and icons

Regenerate app screenshots (requires the dev server to be running):

```bash
npm run screenshots
```

Regenerate the macOS icon set from `public/brand-mark.svg`:

```bash
npm run icons:mac
```

Branding files:

- `public/brand-mark.svg` — source icon (used on the website and as the Tauri app icon source)
- `src-tauri/icons/icon.png` — 1024 × 1024 desktop icon
- `src-tauri/icons/icon.icns` — macOS icon bundle

## CI/CD

| Workflow      | Trigger            | What it does                                                    |
| ------------- | ------------------ | --------------------------------------------------------------- |
| `ci.yml`      | PR / push          | lint → format → test → build → cargo fmt → clippy → cargo check |
| `release.yml` | Version tag (`v*`) | `tauri build` → publishes macOS DMG as a GitHub Release         |
| `pages.yml`   | Push to `main`     | Builds the site and deploys to GitHub Pages                     |
| `codeql.yml`  | Weekly             | Static analysis on TypeScript and Rust                          |

## Security

`npm audit` is clean. The remaining moderate GitHub advisory comes from upstream Rust GUI crates in Tauri's cross-platform stack, not from this project's own dependencies.

CSP is currently disabled (`"csp": null` in `tauri.conf.json`) to allow inline base64 preview images from the device. This is intentional for the desktop-only Tauri context.

## Origins

Informed by the launcher resources found on classic Sony Reader devices, including the `Setup eBook Library.app` bundle mounted from the device launcher volume. Rebuilt from scratch for current macOS — not a port of the original.

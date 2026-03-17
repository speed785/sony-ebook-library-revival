# Sony eBook Library Revival

<p align="center">
  <img src="public/brand-mark.svg" alt="Sony eBook Library Revival icon" width="128" height="128" />
</p>

<p align="center">
  <img src="public/screenshots/app-overview.png" alt="Sony eBook Library Revival desktop app overview" width="900" />
</p>

A modern macOS app for classic Sony Readers.

It replaces Sony's dead setup-era utility with a cleaner local workflow for browsing the device, previewing books, moving files in and out, and managing older readers on current Macs.

Website: `https://speed785.github.io/sony-ebook-library-revival/`

Latest release: `https://github.com/speed785/sony-ebook-library-revival/releases/latest`

Direct Mac download: `https://github.com/speed785/sony-ebook-library-revival/releases/latest/download/Sony-eBook-Library-Revival-macOS.dmg`

## What the app does

- detects mounted Sony Reader volumes on macOS
- shows device details like model, mounted volumes, filesystem, and storage usage
- browses the reader with a collapsible tree pane, file list, and collapsible details drawer
- supports search, filtering, and sorting inside the reader workspace
- prefers real book locations like `database/media/books` instead of just setup/manual folders
- imports books from Finder, reveals files in Finder, exports selected files, and supports dragging selected files toward Finder from the app
- previews EPUB and PDF items in the details drawer when metadata or thumbnails are available
- keeps the public website focused on product information, screenshots, and downloads

## Why this exists

Older Sony readers still work well, but their original Mac software does not. This project keeps the useful parts of that workflow alive without relying on abandoned storefronts, legacy installers, or dead sync services.

## App and website

- The desktop app is the real tool and has live device access
- The website is informational and points people to the app, screenshots, and releases

## Screenshots

<p align="center">
  <img src="public/screenshots/app-library.png" alt="Sony eBook Library Revival library browser" width="900" />
</p>

The latest screenshots reflect the current reader workspace, including the books root, preview drawer, and updated file navigation.

## Stack

- React + TypeScript
- Vite
- Tauri v2
- Rust
- Vitest + Testing Library
- ESLint + Prettier
- GitHub Actions

## Development

Install dependencies:

```bash
npm install
```

Run the website/app frontend:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run tauri:dev
```

Generate updated screenshots from the current preview route:

```bash
npm run screenshots
```

Build the website:

```bash
npm run build
```

Build the desktop app:

```bash
npm run tauri:build
```

## Quality checks

Run the full project check set:

```bash
npm run check
```

That includes:

- `npm run lint`
- `npm run format:check`
- `npm run test`
- `npm run build`
- `cargo fmt --manifest-path src-tauri/Cargo.toml --all --check`
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`

## Screenshots and icons

Regenerate the macOS icon set:

```bash
npm run icons:mac
```

Branding files:

- Website/app icon source: `public/brand-mark.svg`
- Desktop icon PNG: `src-tauri/icons/icon.png`
- Desktop icon bundle: `src-tauri/icons/icon.icns`

## Releases

Version tags like `v0.1.0` trigger the release workflow and publish the macOS DMG automatically.

The release page is here:

`https://github.com/speed785/sony-ebook-library-revival/releases`

## Security note

`npm audit` is clean locally. The remaining moderate GitHub alert appears to come from upstream Rust GUI dependencies pulled in by Tauri's cross-platform stack rather than from this project's own TypeScript dependencies.

## Origins

This remake is informed by the launcher resources found on classic Sony Reader devices, including the old `Setup eBook Library.app` bundle mounted from the device launcher volume.

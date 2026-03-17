# Sony eBook Library Revival

<p align="center">
  <img src="public/brand-mark.svg" alt="Sony eBook Library Revival icon" width="128" height="128" />
</p>

<p align="center">
  <img src="public/site-hero.svg" alt="Sony eBook Library Revival app preview" width="860" />
</p>

A clean-room remake of the classic Sony Reader setup experience, rebuilt as:

- a modern macOS desktop app with Tauri
- a TypeScript project website

Website: `https://speed785.github.io/sony-ebook-library-revival/`

The goal is not to run Sony's old binary. The goal is to preserve the era and spirit of the original app while rebuilding it as a professional modern tool with an e-ink and aero-inspired visual direction.

## What it does

- recreates the Sony setup flow with an e-ink meets aero interface
- detects mounted Sony Reader volumes in the desktop app
- shows connected-device details like model and available space
- browses files on the Reader from the desktop app
- supports drag-in import from Finder to the Reader
- supports export of selected Reader files back to your Mac
- includes a public informational website for the project

## Why there are two builds

The desktop app has real device access. The website is intentionally informational: it explains the tool, shows branded artwork, and links people to the app and repo, while the Tauri app remains the only build that interacts with the Reader.

## Stack

- Vite
- TypeScript
- Tauri v2
- Rust
- ESLint + Prettier
- GitHub Actions

## Branding

- Web favicon: `public/brand-mark.svg`
- Desktop app icon source: `src-tauri/icons/icon.png`
- Desktop app bundle icon set: `src-tauri/icons/icon.icns`
- In-app brand mark: reused in the hero header so the app and docs share the same identity

## Dependency note

`npm audit` is clean locally. The remaining GitHub security warning appears to come from upstream Rust GUI dependencies pulled in by Tauri's cross-platform stack, rather than from this project's own TypeScript dependencies.

## Development

Install dependencies:

```bash
npm install
```

Run the web app:

```bash
npm run dev
```

Run the desktop app:

```bash
npm run tauri:dev
```

Build the web app:

```bash
npm run build
```

Build the desktop app:

```bash
npm run tauri:build
```

## Quality checks

```bash
npm run lint
npm run format:check
cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

## GitHub setup after publishing

Recommended secure repo settings:

- default branch protection on `main`
- required status checks from `CI`
- Dependabot alerts and security updates enabled
- secret scanning enabled
- code scanning enabled
- GitHub Pages source set to `GitHub Actions`
- squash merge enabled, force pushes disabled on `main`

This repository already includes:

- CI workflow for lint, format, build, `cargo check`, and `clippy`
- GitHub Pages deployment workflow
- CodeQL workflow
- Dependabot config
- security policy and issue templates

## Current limitation

Dragging files into the app from Finder is implemented for desktop import. Export is currently handled with an explicit save flow so it works reliably on modern macOS. Direct drag-out from the webview to Finder would require a deeper native bridge.

## Origins

This remake is informed by the launcher resources found on classic Sony Reader devices, including the old `Setup eBook Library.app` bundle mounted from the device launcher volume.

# Sony eBook Library Revival

A clean-room remake of the classic Sony Reader setup experience, rebuilt as:

- a modern macOS desktop app with Tauri
- a TypeScript web build for GitHub Pages

The goal is not to run Sony's old binary. The goal is to preserve the feel of the original app while making it useful on current systems.

## What it does

- recreates the Sony setup flow with a modern Mac-style interface
- detects mounted Sony Reader volumes in the desktop app
- shows connected-device details like model and available space
- browses files on the Reader from the desktop app
- supports drag-in import from Finder to the Reader
- supports export of selected Reader files back to your Mac
- ships a public Pages build for documentation and demo purposes

## Why there are two builds

The desktop app has real device access. The GitHub Pages build is a public-facing showcase built from the same TypeScript frontend, but browsers cannot directly inspect mounted Sony volumes the way the Tauri app can.

## Stack

- Vite
- TypeScript
- Tauri v2
- Rust
- ESLint + Prettier
- GitHub Actions

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

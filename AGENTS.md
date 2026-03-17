# AGENTS.md

## Project intent

This repository has two intentionally different surfaces:

- the `Tauri` desktop app is the real working tool
- the project site is informational and promotional only

Do not reintroduce live device access to the web build.

## Product direction

- Keep the visual language in the `e-ink x aero` space
- Favor polished glass, soft blue chrome, and calm e-paper surfaces over retro parchment styling
- The desktop app should feel like a premium 2008/2009 Sony utility remade for modern macOS
- The website should explain the tool, show branded visuals, and point people to the desktop app and repo

## App behavior

- Desktop functionality lives in `src/main.ts` and `src-tauri/src/main.rs`
- The app may detect the mounted Sony Reader, inspect files, import files from Finder, export files, and reveal files in Finder
- Keep destructive file operations opt-in and clearly presented

## Web behavior

- The project site should remain a landing page / docs surface
- It may include screenshots, illustrations, feature lists, downloads, and contributor docs
- It should not pretend to browse local reader files in-browser

## Design notes

- Preserve responsiveness for both the site and the desktop shell
- Avoid a fake nested OS window effect inside the desktop app
- Keep branding assets in `public/` and sync the desktop icon from the main brand mark when needed

## Quality bar

Before finishing code changes, run the relevant checks:

```bash
npm run lint
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

When changing Rust or formatting-sensitive files, also run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

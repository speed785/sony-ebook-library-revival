## What's new in v0.1.0

First cross-platform release — macOS, Windows, and Linux.

### Highlights

- **macOS, Windows, Linux** — full native installers for all three platforms (DMG, MSI/NSIS, AppImage/deb/rpm)
- **Faster** — reader mount path and EPUB titles cached in-memory; search debounced; directory loads parallelised; PDF previews off the main thread
- **Redesigned UI** — cool e-paper × aero chrome palette, frosted glass panels, Geist font, compositor-only animations
- **New app icon** — dark navy glass tile with e-reader silhouette, matching the updated design language
- **Component architecture** — `DesktopApp.tsx` split into focused, memoised components for better render performance

### Downloads

| Platform              | Installer                       |
| --------------------- | ------------------------------- |
| macOS (Apple Silicon) | `.dmg`                          |
| Windows               | `.msi` or NSIS `.exe`           |
| Linux                 | `.AppImage` or `.deb` or `.rpm` |

### Notes

- Connect your Sony Reader over USB before launching the app
- If the device is not detected, use the Refresh button in the toolbar
- Requires `poppler-utils` on Linux for PDF preview (`sudo apt install poppler-utils` or equivalent)

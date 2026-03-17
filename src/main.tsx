import { createRoot } from "react-dom/client";

import "rc-tree/assets/index.css";
import "./styles.css";

import { DesktopApp } from "./app/DesktopApp";
import { Website } from "./site/Website";

const container = document.querySelector<HTMLDivElement>("#app");

if (!container) {
  throw new Error("#app element is missing");
}

const isDesktop = "__TAURI_INTERNALS__" in window;
const searchParams = new URLSearchParams(window.location.search);
const previewMode = searchParams.get("preview") === "desktop";

document.body.classList.add(
  isDesktop || previewMode ? "desktop-app" : "web-app",
);

const root = createRoot(container);
root.render(
  isDesktop || previewMode ? (
    <DesktopApp mode={previewMode ? "preview" : "live"} />
  ) : (
    <Website />
  ),
);

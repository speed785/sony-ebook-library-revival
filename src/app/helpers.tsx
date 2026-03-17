import { BookOpen, File, FileArchive, FileText, Folder } from "lucide-react";
import type { ReaderEntry } from "../types";

export function fileKindLabel(entry: ReaderEntry): string {
  if (entry.extension?.toLowerCase() === "epub") return "EPUB";
  if (entry.extension?.toLowerCase() === "pdf") return "PDF";
  if (entry.extension?.toLowerCase() === "zip") return "ZIP";
  if (entry.extension?.toLowerCase() === "lrf") return "LRF";
  return "File";
}

export function stripDisplayExtension(name: string): string {
  return name.replace(/\.(epub|pdf|zip|lrf|txt|rtf)$/i, "");
}

export function iconForEntry(entry: ReaderEntry, large: boolean) {
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

export function preferredRoots(): string[] {
  return ["database/media/books", "Documents", "Digital Editions", ""];
}

export function createDragIconDataUrl(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) {
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sO38p8AAAAASUVORK5CYII=";
  }

  context.fillStyle = "#2477e8";
  context.beginPath();
  context.roundRect(8, 8, 80, 80, 20);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "600 18px Geist, Avenir Next";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("BOOK", 48, 48);
  return canvas.toDataURL("image/png");
}

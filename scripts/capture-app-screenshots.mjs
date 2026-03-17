import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const root = process.cwd();
const outputDir = path.join(root, "public", "screenshots");

await mkdir(outputDir, { recursive: true });

const server = spawn(
  "npm",
  ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173"],
  {
    cwd: root,
    stdio: "ignore",
    shell: true,
  },
);

try {
  await wait(4000);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1540, height: 1080 },
    deviceScaleFactor: 2,
  });

  await page.goto("http://127.0.0.1:4173/?preview=desktop", {
    waitUntil: "networkidle",
  });
  await page
    .locator(".window")
    .screenshot({ path: path.join(outputDir, "app-overview.png") });
  await page
    .locator(".card--workspace")
    .screenshot({ path: path.join(outputDir, "app-library.png") });

  await browser.close();
} finally {
  server.kill("SIGTERM");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DesktopApp } from "./DesktopApp";

describe("DesktopApp", () => {
  it("renders the disconnected state in live mode before a device is present", () => {
    render(<DesktopApp mode="live" />);

    expect(screen.getByText("Connect your Sony Reader to begin.")).toBeTruthy();
  });

  it("renders the connected preview workspace", async () => {
    render(<DesktopApp mode="preview" />);

    expect(await screen.findByText("Reader connected")).toBeTruthy();
    expect(screen.getAllByText("Documents").length).toBeGreaterThan(0);
    expect(screen.getByText("The Left Hand of Darkness")).toBeTruthy();
  });
});

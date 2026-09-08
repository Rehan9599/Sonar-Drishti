import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import UploadPanel from "../src/components/UploadPanel/UploadPanel.jsx";

describe("UploadPanel", () => {
  it("renders the upload form with a Detect button", () => {
    render(
      <MemoryRouter>
        <UploadPanel />
      </MemoryRouter>
    );
    const button = screen.getByRole("button", { name: /Detect/i });
    expect(button).toBeTruthy();
  });

  it("disables the Detect button when no file is selected", () => {
    render(
      <MemoryRouter>
        <UploadPanel />
      </MemoryRouter>
    );
    const button = screen.getByRole("button", { name: /Detect/i });
    expect(button.disabled).toBe(true);
  });
});
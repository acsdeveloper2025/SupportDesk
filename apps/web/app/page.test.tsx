import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the bootstrap landing page", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { name: "SupportDesk" })).toBeInTheDocument();
    expect(screen.getByText("Enterprise Ticketing Platform")).toBeInTheDocument();
    expect(screen.getByText("Project Successfully Bootstrapped")).toBeInTheDocument();
  });
});

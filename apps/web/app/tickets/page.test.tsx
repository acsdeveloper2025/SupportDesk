import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TicketsPage from "./page";

describe("tickets page", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires a description before posting a new ticket", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          items: [],
          total: 0,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);

    render(<TicketsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Create New Ticket" }));
    fireEvent.change(screen.getByLabelText("Ticket Subject / Title"), {
      target: { value: "Cannot connect to VPN" },
    });
    expect(screen.getByLabelText("Detailed Description")).toBeRequired();

    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

    await waitFor(() =>
      expect(fetch).not.toHaveBeenCalledWith(
        "/api/tickets",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("offers the API-supported feature request ticket type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            items: [],
            total: 0,
          }),
        ),
      ),
    );

    render(<TicketsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Create New Ticket" }));

    expect(screen.getAllByRole("option", { name: "FEATURE REQUEST" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("option", { name: "TASK" })).not.toBeInTheDocument();
  });
});

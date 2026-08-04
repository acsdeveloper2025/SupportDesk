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

  it("uploads selected attachments after creating a ticket", async () => {
    const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = requestUrl(input);
      if (url.startsWith("/api/tickets?")) {
        return Promise.resolve(Response.json({ items: [], total: 0 }));
      }
      if (url === "/api/auth/csrf") {
        return Promise.resolve(Response.json({ csrfToken: "csrf-token" }));
      }
      if (url === "/api/tickets" && init?.method === "POST") {
        return Promise.resolve(Response.json({ id: "ticket-1" }, { status: 201 }));
      }
      if (url === "/api/tickets/ticket-1/attachments" && init?.method === "POST") {
        return Promise.resolve(Response.json({ id: "attachment-1" }, { status: 201 }));
      }
      return Promise.resolve(Response.json({}));
    });
    vi.stubGlobal("fetch", fetch);

    render(<TicketsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "+ Create New Ticket" }));
    fireEvent.change(screen.getByLabelText("Ticket Subject / Title"), {
      target: { value: "Cannot connect to VPN" },
    });
    fireEvent.change(screen.getByLabelText("Detailed Description"), {
      target: { value: "VPN fails after MFA approval." },
    });
    fireEvent.change(screen.getByLabelText("Attachments"), {
      target: { files: [new File(["hello"], "vpn-log.txt", { type: "text/plain" })] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Ticket" }));

    await waitFor(() => {
      const uploadCall = fetch.mock.calls.find(
        ([input, init]) =>
          requestUrl(input) === "/api/tickets/ticket-1/attachments" && init?.method === "POST",
      );
      expect(uploadCall).toBeDefined();
      expect(uploadCall?.[1]?.body).toBeInstanceOf(FormData);
      expect(uploadCall?.[1]?.headers).toEqual({ "x-csrf-token": "csrf-token" });
    });
  });
});

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

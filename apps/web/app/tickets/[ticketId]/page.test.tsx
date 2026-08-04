import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TicketDetailPage from "./page";

const sampleTicket = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  tenantId: "bbbbbbbb-0000-4000-8000-000000000002",
  publicRef: "TKT-1001",
  title: "Cannot connect to VPN",
  description: "Detailed description of the VPN issue.",
  status: "OPEN",
  priority: "HIGH",
  channel: "WEB",
  type: "INCIDENT",
  requesterUserId: "cccccccc-0000-4000-8000-000000000003",
  assigneeUserId: null,
  assignedGroupId: null,
  solvedAt: null,
  closedAt: null,
  dueDate: null,
  version: 1,
  createdAt: "2026-07-01T10:00:00.000Z",
  updatedAt: "2026-07-01T10:00:00.000Z",
};

const sampleComments = {
  items: [
    {
      id: "dddddddd-0000-4000-8000-000000000004",
      tenantId: sampleTicket.tenantId,
      ticketId: sampleTicket.id,
      authorUserId: "eeeeeeee-0000-4000-8000-000000000005",
      body: "We are investigating the issue.",
      visibility: "PUBLIC",
      version: 1,
      createdAt: "2026-07-01T11:00:00.000Z",
      updatedAt: "2026-07-01T11:00:00.000Z",
      deletedAt: null,
    },
  ],
  meta: {
    totalRecords: 1,
    totalPages: 1,
    currentPage: 1,
    pageSize: 50,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

const sampleAttachments = {
  items: [
    {
      id: "ffffffff-0000-4000-8000-000000000006",
      originalFilename: "vpn-log.txt",
      mimeType: "text/plain",
      fileSize: 2048,
      uploadedByUserId: "eeeeeeee-0000-4000-8000-000000000005",
      createdAt: "2026-07-01T12:00:00.000Z",
    },
  ],
};

function makeParams(ticketId: string): Promise<{ ticketId: string }> {
  return Promise.resolve({ ticketId });
}

describe("TicketDetailPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows loading skeleton while fetching", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => undefined)), // never resolves
    );
    render(<TicketDetailPage params={makeParams(sampleTicket.id)} />);
    expect(screen.getByLabelText("Loading ticket details")).toBeInTheDocument();
  });

  it("renders ticket detail after successful fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve(Response.json({ userId: "user-1" }));
        }
        if (url.includes("/comments")) {
          return Promise.resolve(Response.json(sampleComments));
        }
        if (url.includes("/timeline")) {
          return Promise.resolve(Response.json({ items: [] }));
        }
        if (url.includes("/attachments")) {
          return Promise.resolve(Response.json(sampleAttachments));
        }
        return Promise.resolve(Response.json(sampleTicket));
      }),
    );

    render(<TicketDetailPage params={makeParams(sampleTicket.id)} />);

    expect(await screen.findByText("TKT-1001")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cannot connect to VPN" })).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Detailed description of the VPN issue.")).toBeInTheDocument();
    expect(screen.getByText("We are investigating the issue.")).toBeInTheDocument();
    expect(screen.getByText("vpn-log.txt")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download vpn-log.txt" })).toHaveAttribute(
      "href",
      "/api/attachments/ffffffff-0000-4000-8000-000000000006",
    );
  });

  it("shows not-found error banner on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve(Response.json({ userId: "user-1" }));
        }
        if (url.includes("/comments") || url.includes("/timeline")) {
          return Promise.resolve(Response.json({ items: [] }));
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    render(<TicketDetailPage params={makeParams("nonexistent")} />);
    expect(await screen.findByText("Ticket not found")).toBeInTheDocument();
  });

  it("shows forbidden error banner on 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve(Response.json({ userId: "user-1" }));
        }
        if (url.includes("/comments") || url.includes("/timeline")) {
          return Promise.resolve(Response.json({ items: [] }));
        }
        return Promise.resolve(new Response(null, { status: 403 }));
      }),
    );

    render(<TicketDetailPage params={makeParams(sampleTicket.id)} />);
    expect(
      await screen.findByText("You do not have permission to view this ticket"),
    ).toBeInTheDocument();
  });

  it("shows unauthorized error banner on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve(Response.json({ userId: "user-1" }));
        }
        if (url.includes("/comments") || url.includes("/timeline")) {
          return Promise.resolve(Response.json({ items: [] }));
        }
        return Promise.resolve(new Response(null, { status: 401 }));
      }),
    );

    render(<TicketDetailPage params={makeParams(sampleTicket.id)} />);
    expect(
      await screen.findByText("You must be signed in to view this ticket"),
    ).toBeInTheDocument();
  });

  it("shows conflict banner when PATCH returns 409", async () => {
    let patchCalled = false;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (url.includes("/api/auth/csrf")) {
          return Promise.resolve(Response.json({ csrfToken: "tok" }));
        }
        if (url.includes("/api/auth/me")) {
          return Promise.resolve(Response.json({ userId: "user-1" }));
        }
        if (url.includes("/comments")) {
          return Promise.resolve(Response.json(sampleComments));
        }
        if (url.includes("/timeline")) {
          return Promise.resolve(Response.json({ items: [] }));
        }
        if (options?.method === "PATCH") {
          patchCalled = true;
          return Promise.resolve(new Response(null, { status: 409 }));
        }
        return Promise.resolve(Response.json(sampleTicket));
      }),
    );

    render(<TicketDetailPage params={makeParams(sampleTicket.id)} />);

    // Wait for ticket to load, then trigger edit
    const editBtn = await screen.findByRole("button", { name: /edit ticket/i });
    fireEvent.click(editBtn);

    const saveBtn = await screen.findByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    await waitFor(() => expect(patchCalled).toBe(true));
    expect(await screen.findByText("This ticket was updated by another user")).toBeInTheDocument();
  });

  it("shows comments section with empty state when no comments exist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/auth/me")) {
          return Promise.resolve(Response.json({ userId: "user-1" }));
        }
        if (url.includes("/comments")) {
          return Promise.resolve(
            Response.json({
              items: [],
              meta: {
                totalRecords: 0,
                totalPages: 0,
                currentPage: 1,
                pageSize: 50,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            }),
          );
        }
        if (url.includes("/timeline")) {
          return Promise.resolve(Response.json({ items: [] }));
        }
        return Promise.resolve(Response.json(sampleTicket));
      }),
    );

    render(<TicketDetailPage params={makeParams(sampleTicket.id)} />);
    expect(await screen.findByText("No comments yet.")).toBeInTheDocument();
  });
});

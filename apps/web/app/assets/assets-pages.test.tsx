import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CreateAssetPage from "./new/page";
import AssetsPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Asset Management CMDB Pages", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders Asset Inventory Dashboard with search and filter controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/assets")) {
          return Promise.resolve(
            Response.json({
              items: [
                {
                  id: "ast-1",
                  assetRef: "AST-000001",
                  name: "MacBook Pro 16",
                  lifecycleState: "ASSIGNED",
                  assetType: { id: "t-1", name: "Hardware", key: "hardware" },
                  category: { id: "c-1", name: "Laptops" },
                  location: { id: "l-1", name: "HQ - Floor 3" },
                  assignedUser: { id: "u-1", email: "dev@acme.test" },
                  createdAt: "2026-08-01T00:00:00Z",
                },
              ],
              totalRecords: 1,
            }),
          );
        }
        return Promise.resolve(Response.json({ items: [] }));
      }),
    );

    render(<AssetsPage />);

    expect(screen.getByRole("heading", { name: "Asset Management (CMDB)" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by ref, name, tag/i)).toBeInTheDocument();
    expect(screen.getByText("+ Register New Asset")).toBeInTheDocument();

    expect(await screen.findByText("AST-000001")).toBeInTheDocument();
    expect(screen.getByText("MacBook Pro 16")).toBeInTheDocument();
    expect(screen.getByText("ASSIGNED")).toBeInTheDocument();
  });

  it("renders Create Asset form with type, category, and detail inputs", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/asset-types")) {
          return Promise.resolve(
            Response.json({ items: [{ id: "t-1", name: "Hardware", key: "hardware" }] }),
          );
        }
        if (url.includes("/api/asset-categories")) {
          return Promise.resolve(Response.json({ items: [{ id: "c-1", name: "Laptops" }] }));
        }
        if (url.includes("/api/asset-locations")) {
          return Promise.resolve(Response.json({ items: [{ id: "l-1", name: "HQ Floor 3" }] }));
        }
        return Promise.resolve(Response.json({ items: [] }));
      }),
    );

    render(<CreateAssetPage />);

    expect(screen.getByRole("heading", { name: "Register New Asset" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. MacBook Pro 16 2024 - Dev Team")).toBeInTheDocument();
    expect(screen.getByText("Asset Type")).toBeInTheDocument();
  });
});

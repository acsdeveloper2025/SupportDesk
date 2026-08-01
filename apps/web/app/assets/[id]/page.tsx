"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

interface AssetDetail {
  id: string;
  assetRef: string;
  name: string;
  lifecycleState: string;
  serialNumber?: string | null;
  assetTag?: string | null;
  barcode?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  vendor?: string | null;
  purchaseDate?: string | null;
  warrantyExpiresAt?: string | null;
  cost?: string | number | null;
  notes?: string | null;
  customFields?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;

  assetType?: { id: string; name: string; key: string };
  category?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
  ownerUser?: { id: string; email: string } | null;
  assignedUser?: { id: string; email: string } | null;
  assignedDepartment?: string | null;
}

interface AssetHistoryItem {
  id: string;
  action: string;
  fromState?: string | null;
  toState?: string | null;
  comment?: string | null;
  createdAt: string;
  actor?: { id: string; email: string } | null;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["IN_STOCK", "ASSIGNED", "DISPOSED", "ARCHIVED"],
  IN_STOCK: ["ASSIGNED", "IN_REPAIR", "RETIRED", "DISPOSED", "LOST", "ARCHIVED"],
  ASSIGNED: ["IN_STOCK", "IN_REPAIR", "RETIRED", "DISPOSED", "LOST", "ARCHIVED"],
  IN_REPAIR: ["IN_STOCK", "ASSIGNED", "RETIRED", "DISPOSED", "LOST", "ARCHIVED"],
  RETIRED: ["ARCHIVED", "IN_STOCK", "DISPOSED"],
  DISPOSED: ["ARCHIVED"],
  LOST: ["IN_STOCK", "ARCHIVED"],
  ARCHIVED: [],
};

export default function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [history, setHistory] = useState<AssetHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transition Modal / State
  const [targetState, setTargetState] = useState("");
  const [transitionComment, setTransitionComment] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  // Assignment Modal / State
  const [assignKind, setAssignKind] = useState<"USER" | "DEPARTMENT" | "LOCATION">("USER");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignDept, setAssignDept] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [assigning, setAssigning] = useState(false);

  const fetchAssetDetails = async (assetId: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/assets/${assetId}`);
      if (!res.ok) {
        throw new Error(`Asset not found or access denied (HTTP ${res.status})`);
      }
      const data = (await res.json()) as AssetDetail;
      setAsset(data);

      const histRes = await fetch(`/api/assets/${assetId}?includeHistory=true`);
      if (histRes.ok) {
        const histData = (await histRes.json()) as { history?: AssetHistoryItem[] };
        setHistory(histData.history ?? []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load asset details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setError(null);
        const res = await fetch(`/api/assets/${id}`);
        if (!res.ok) {
          throw new Error(`Asset not found or access denied (HTTP ${res.status})`);
        }
        const data = (await res.json()) as AssetDetail;
        if (!ignore) {
          setAsset(data);
        }

        const histRes = await fetch(`/api/assets/${id}?includeHistory=true`);
        if (histRes.ok) {
          const histData = (await histRes.json()) as { history?: AssetHistoryItem[] };
          if (!ignore) {
            setHistory(histData.history ?? []);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load asset details");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [id]);

  const handleTransition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetState) return;

    setTransitioning(true);
    void (async () => {
      try {
        const res = await fetch(`/api/assets/${id}/transition`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lifecycleState: targetState,
            comment: transitionComment || undefined,
          }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "Lifecycle transition failed");
        }
        setTargetState("");
        setTransitionComment("");
        await fetchAssetDetails(id);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Transition failed");
      } finally {
        setTransitioning(false);
      }
    })();
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    void (async () => {
      try {
        const payload: Record<string, unknown> = {
          kind: assignKind,
          reason: assignReason || undefined,
        };
        if (assignKind === "USER") payload.assignedToUserId = assignUserId;
        if (assignKind === "DEPARTMENT") payload.assignedDepartment = assignDept;

        const res = await fetch(`/api/assets/${id}/assign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? "Assignment failed");
        }
        setAssignDept("");
        setAssignUserId("");
        setAssignReason("");
        await fetchAssetDetails(id);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Assignment failed");
      } finally {
        setAssigning(false);
      }
    })();
  };

  const handleUnassign = () => {
    if (!confirm("Are you sure you want to unassign this asset?")) return;
    void (async () => {
      try {
        const res = await fetch(`/api/assets/${id}/unassign`, { method: "POST" });
        if (!res.ok) throw new Error("Unassignment failed");
        await fetchAssetDetails(id);
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : "Unassign failed");
      }
    })();
  };

  if (loading) {
    return (
      <div className="text-muted-foreground container mx-auto p-8 text-center">
        Loading asset details...
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="container mx-auto max-w-4xl space-y-4 p-6">
        <Link href="/assets" className="text-primary text-xs hover:underline">
          ← Back to Assets
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "Asset not found"}
        </div>
      </div>
    );
  }

  const possibleTransitions = ALLOWED_TRANSITIONS[asset.lifecycleState] ?? [];

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <div className="border-border flex flex-col items-start justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/assets" className="text-primary text-xs hover:underline">
              Assets
            </Link>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="font-mono text-xs font-bold">{asset.assetRef}</span>
          </div>
          <h1 className="text-foreground mt-1 text-2xl font-bold tracking-tight">{asset.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-mono text-xs">v{asset.version}</span>
          <span className="bg-primary/10 text-primary border-primary/20 rounded-full border px-3 py-1 text-xs font-bold">
            {asset.lifecycleState}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Asset Details */}
        <div className="space-y-6 lg:col-span-2">
          <div className="bg-card border-border space-y-4 rounded-lg border p-6">
            <h2 className="text-foreground border-border border-b pb-2 text-lg font-semibold">
              Specification & Details
            </h2>

            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <span className="text-muted-foreground block text-xs font-medium">
                  Asset Reference
                </span>
                <span className="font-mono font-semibold">{asset.assetRef}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">Asset Tag</span>
                <span>{asset.assetTag ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">
                  Serial Number
                </span>
                <span className="font-mono">{asset.serialNumber ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">Asset Type</span>
                <span>{asset.assetType?.name ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">Category</span>
                <span>{asset.category?.name ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">Location</span>
                <span>{asset.location?.name ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">
                  Manufacturer
                </span>
                <span>{asset.manufacturer ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">Model</span>
                <span>{asset.model ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">Vendor</span>
                <span>{asset.vendor ?? "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">
                  Purchase Date
                </span>
                <span>{asset.purchaseDate ? asset.purchaseDate.split("T")[0] : "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">
                  Warranty Expires
                </span>
                <span>{asset.warrantyExpiresAt ? asset.warrantyExpiresAt.split("T")[0] : "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-medium">Cost</span>
                <span>{asset.cost ? `$${asset.cost}` : "-"}</span>
              </div>
            </div>

            {asset.notes && (
              <div className="border-border border-t pt-2">
                <span className="text-muted-foreground mb-1 block text-xs font-medium">Notes</span>
                <p className="bg-muted/40 text-foreground rounded-md p-3 text-sm">{asset.notes}</p>
              </div>
            )}

            {asset.customFields && Object.keys(asset.customFields).length > 0 && (
              <div className="border-border border-t pt-2">
                <span className="text-muted-foreground mb-2 block text-xs font-medium">
                  Custom Attributes
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(asset.customFields).map(([k, v]) => (
                    <div key={k} className="bg-muted/40 rounded p-2">
                      <span className="font-medium">{k}:</span> {String(v)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timeline / History */}
          <div className="bg-card border-border space-y-4 rounded-lg border p-6">
            <h2 className="text-foreground border-border border-b pb-2 text-lg font-semibold">
              Lifecycle & Audit History
            </h2>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm">No history events recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h) => (
                  <div key={h.id} className="border-border/50 flex gap-3 border-b pb-2 text-xs">
                    <span className="text-primary font-semibold">{h.action}</span>
                    {h.fromState && h.toState && (
                      <span className="text-muted-foreground">
                        ({h.fromState} → {h.toState})
                      </span>
                    )}
                    {h.comment && <span className="text-foreground">{h.comment}</span>}
                    <span className="text-muted-foreground ml-auto font-mono">
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Actions & Assignment */}
        <div className="space-y-6">
          {/* Lifecycle State Transition Form */}
          <div className="bg-card border-border space-y-4 rounded-lg border p-5">
            <h3 className="text-foreground text-sm font-bold">Transition Lifecycle State</h3>

            {possibleTransitions.length === 0 ? (
              <p className="text-muted-foreground text-xs">
                Asset is in a terminal state ({asset.lifecycleState}).
              </p>
            ) : (
              <form onSubmit={handleTransition} className="space-y-3">
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-medium">
                    Target State
                  </label>
                  <select
                    value={targetState}
                    onChange={(e) => setTargetState(e.target.value)}
                    className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
                  >
                    <option value="">Select Next State...</option>
                    {possibleTransitions.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-medium">
                    Comment / Reason
                  </label>
                  <input
                    type="text"
                    value={transitionComment}
                    onChange={(e) => setTransitionComment(e.target.value)}
                    placeholder="Reason for state change..."
                    className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!targetState || transitioning}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded py-1.5 text-xs font-medium disabled:opacity-50"
                >
                  {transitioning ? "Executing..." : "Apply State Transition"}
                </button>
              </form>
            )}
          </div>

          {/* Current Assignment Card & Form */}
          <div className="bg-card border-border space-y-4 rounded-lg border p-5">
            <h3 className="text-foreground text-sm font-bold">Asset Assignment</h3>

            <div className="bg-muted/40 space-y-1 rounded p-3 text-xs">
              <span className="text-muted-foreground block font-medium">Current Status</span>
              {asset.assignedUser ? (
                <div className="flex items-center justify-between">
                  <span>
                    Assigned to User: <strong>{asset.assignedUser.email}</strong>
                  </span>
                  <button onClick={handleUnassign} className="text-red-600 hover:underline">
                    Unassign
                  </button>
                </div>
              ) : asset.assignedDepartment ? (
                <div className="flex items-center justify-between">
                  <span>
                    Assigned to Dept: <strong>{asset.assignedDepartment}</strong>
                  </span>
                  <button onClick={handleUnassign} className="text-red-600 hover:underline">
                    Unassign
                  </button>
                </div>
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </div>

            <form onSubmit={handleAssign} className="space-y-3 pt-2">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Assign Kind
                </label>
                <select
                  value={assignKind}
                  onChange={(e) =>
                    setAssignKind(e.target.value as "USER" | "DEPARTMENT" | "LOCATION")
                  }
                  className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
                >
                  <option value="USER">User (UUID)</option>
                  <option value="DEPARTMENT">Department Name</option>
                </select>
              </div>

              {assignKind === "USER" ? (
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-medium">
                    User ID (UUID)
                  </label>
                  <input
                    type="text"
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    placeholder="User UUID..."
                    className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-muted-foreground mb-1 block text-xs font-medium">
                    Department Name
                  </label>
                  <input
                    type="text"
                    value={assignDept}
                    onChange={(e) => setAssignDept(e.target.value)}
                    placeholder="e.g. Engineering, IT Support"
                    className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
                  />
                </div>
              )}

              <div>
                <label className="text-muted-foreground mb-1 block text-xs font-medium">
                  Reason
                </label>
                <input
                  type="text"
                  value={assignReason}
                  onChange={(e) => setAssignReason(e.target.value)}
                  placeholder="Deployment reason..."
                  className="border-input bg-background w-full rounded border px-3 py-1.5 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={assigning}
                className="bg-secondary text-secondary-foreground hover:bg-secondary/80 w-full rounded py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {assigning ? "Assigning..." : "Update Assignment"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

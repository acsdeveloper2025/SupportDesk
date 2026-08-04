"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchWithCsrf } from "@/lib/auth/csrf-client";

interface AssetType {
  id: string;
  name: string;
  key: string;
  customFieldsSchema?: Array<{ key: string; label: string; type: string }>;
}

interface AssetCategory {
  id: string;
  name: string;
}

interface AssetLocation {
  id: string;
  name: string;
}

interface ListResponse<T> {
  items?: T[];
}

export default function CreateAssetPage() {
  const router = useRouter();

  const [types, setTypes] = useState<AssetType[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [locations, setLocations] = useState<AssetLocation[]>([]);

  const [name, setName] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [assetTag, setAssetTag] = useState("");
  const [barcode, setBarcode] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [vendor, setVendor] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyExpiresAt, setWarrantyExpiresAt] = useState("");
  const [cost, setCost] = useState("");
  const [lifecycleState, setLifecycleState] = useState("DRAFT");
  const [notes, setNotes] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function loadOptions() {
      try {
        const [typesRes, catRes, locRes] = await Promise.all([
          fetch("/api/asset-types"),
          fetch("/api/asset-categories"),
          fetch("/api/asset-locations"),
        ]);

        if (typesRes.ok) {
          const data = (await typesRes.json()) as ListResponse<AssetType>;
          if (!ignore) {
            setTypes(data.items ?? []);
            if (data.items && data.items.length > 0 && data.items[0]) {
              setAssetTypeId(data.items[0].id);
            }
          }
        }
        if (catRes.ok) {
          const data = (await catRes.json()) as ListResponse<AssetCategory>;
          if (!ignore) {
            setCategories(data.items ?? []);
          }
        }
        if (locRes.ok) {
          const data = (await locRes.json()) as ListResponse<AssetLocation>;
          if (!ignore) {
            setLocations(data.items ?? []);
          }
        }
      } catch (err: unknown) {
        console.error("Failed to load select options", err);
      }
    }
    void loadOptions();
    return () => {
      ignore = true;
    };
  }, []);

  const selectedType = types.find((t) => t.id === assetTypeId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !assetTypeId) {
      setError("Asset name and type are required");
      return;
    }
    if (cost.trim() && !/^\d+(\.\d{1,2})?$/.test(cost.trim())) {
      setError("Cost must be a decimal number with up to 2 decimal places.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload = {
      name: name.trim(),
      assetTypeId,
      categoryId: categoryId || null,
      locationId: locationId || null,
      serialNumber: serialNumber.trim() || undefined,
      assetTag: assetTag.trim() || undefined,
      barcode: barcode.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      model: model.trim() || undefined,
      vendor: vendor.trim() || undefined,
      purchaseDate: purchaseDate || undefined,
      warrantyExpiresAt: warrantyExpiresAt || undefined,
      cost: cost.trim() || undefined,
      lifecycleState,
      notes: notes.trim() || undefined,
      customFields,
    };

    void (async () => {
      try {
        const res = await fetchWithCsrf("/api/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const data = (await res.json()) as { message?: string };
          throw new Error(data.message ?? `Failed to create asset: HTTP ${res.status}`);
        }

        const created = (await res.json()) as { id: string };
        router.push(`/assets/${created.id}`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Asset creation failed");
        setSubmitting(false);
      }
    })();
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/assets" className="text-primary text-xs hover:underline">
          ← Back to Assets
        </Link>
        <h1 className="text-foreground mt-2 text-2xl font-bold tracking-tight">
          Register New Asset
        </h1>
        <p className="text-muted-foreground text-sm">
          Create a new Configuration Item (CI) or asset record in the CMDB.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-card border-border space-y-6 rounded-lg border p-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="col-span-2">
            <label className="text-foreground mb-1 block text-sm font-medium">
              Asset Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MacBook Pro 16 2024 - Dev Team"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Asset Type <span className="text-red-500">*</span>
            </label>
            <select
              value={assetTypeId}
              onChange={(e) => setAssetTypeId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">(None)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Initial Lifecycle State
            </label>
            <select
              value={lifecycleState}
              onChange={(e) => setLifecycleState(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="ASSIGNED">Assigned</option>
            </select>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">(None)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Asset Tag</label>
            <input
              type="text"
              value={assetTag}
              onChange={(e) => setAssetTag(e.target.value)}
              placeholder="e.g. TAG-10024"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Serial Number</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. C02GL401MD6R"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Barcode / QR</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="e.g. BC-887410"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Manufacturer</label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="e.g. Apple, Dell, Lenovo"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. MacBook Pro 16-inch M3 Max"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Vendor</label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="e.g. CDW, Apple Business"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Purchase Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Warranty Expiration
            </label>
            <input
              type="date"
              value={warrantyExpiresAt}
              onChange={(e) => setWarrantyExpiresAt(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">Cost ($)</label>
            <input
              type="text"
              inputMode="decimal"
              pattern="\\d+(\\.\\d{1,2})?"
              title="Enter a decimal amount with up to 2 decimal places."
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="2499.00"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div className="col-span-2">
            <label className="text-foreground mb-1 block text-sm font-medium">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional information, condition notes, or deployment instructions..."
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Dynamic Custom Fields Schema */}
        {selectedType?.customFieldsSchema && selectedType.customFieldsSchema.length > 0 && (
          <div className="border-border space-y-4 border-t pt-4">
            <h3 className="text-foreground text-sm font-semibold">
              Custom Fields for {selectedType.name}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {selectedType.customFieldsSchema.map((field) => (
                <div key={field.key}>
                  <label className="text-foreground mb-1 block text-xs font-medium">
                    {field.label || field.key}
                  </label>
                  <input
                    type="text"
                    value={customFields[field.key] || ""}
                    onChange={(e) =>
                      setCustomFields({ ...customFields, [field.key]: e.target.value })
                    }
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-border flex justify-end gap-3 border-t pt-4">
          <Link
            href="/assets"
            className="border-input hover:bg-accent rounded-md border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Create Asset"}
          </button>
        </div>
      </form>
    </div>
  );
}

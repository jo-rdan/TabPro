import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
  Loader,
  Sparkles,
  Star,
} from "lucide-react";
import Layout from "../../components/Layout";
import ConfirmDialog from "../../components/ConfirmDialog";
import { useAuthStore } from "../../lib/auth";
import api from "../../lib/api";

interface MenuItemRow {
  id: string;
  name: string;
  category: string;
  priceRwf: number;
  isAvailable: boolean;
  // Chef's pick: shown first on the venue's Skuzi page and on Explore (max 3).
  featured?: boolean;
}

interface ExtractedItem {
  name: string;
  category: string;
  priceRwf: number;
}

function formatRwf(n: number) {
  return `${n.toLocaleString()} RWF`;
}

export default function MenuManagement() {
  const { venues, fetchMe } = useAuthStore();
  const venue = venues[0];
  useEffect(() => {
    if (!venue) fetchMe();
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add item form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editName, setEditName] = useState("");

  // AI extraction
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [savingExtracted, setSavingExtracted] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MenuItemRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchMenu = async () => {
    if (!venue) return;
    try {
      const res = await api.get(`/menu/${venue.id}`);
      setItems(res.data.data.items);
    } catch {
      setError("Failed to load menu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [venue]);

  const grouped = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, MenuItemRow[]>,
  );

  const handleAddItem = async () => {
    if (!newName.trim() || !newCategory.trim() || !newPrice) return;
    setAddLoading(true);
    try {
      await api.post("/menu", {
        venueId: venue!.id,
        items: [
          {
            name: newName.trim(),
            category: newCategory.trim(),
            priceRwf: parseInt(newPrice),
          },
        ],
      });
      setNewName("");
      setNewCategory("");
      setNewPrice("");
      setShowAddForm(false);
      await fetchMenu();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to add item.");
    } finally {
      setAddLoading(false);
    }
  };

  const handleToggle = async (itemId: string) => {
    try {
      await api.patch(`/menu/items/${itemId}/toggle`);
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId ? { ...i, isAvailable: !i.isAvailable } : i,
        ),
      );
    } catch {
      setError("Failed to toggle item.");
    }
  };

  const handleFeature = async (item: MenuItemRow) => {
    try {
      await api.patch(`/menu/items/${item.id}`, { featured: !item.featured });
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, featured: !item.featured } : i)));
    } catch (err: any) {
      setError(err?.response?.data?.error || "Couldn't save. Check your connection.");
    }
  };

  const handleSaveEdit = async (itemId: string) => {
    try {
      await api.patch(`/menu/items/${itemId}`, {
        name: editName,
        priceRwf: parseInt(editPrice),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, name: editName, priceRwf: parseInt(editPrice) }
            : i,
        ),
      );
      setEditingId(null);
    } catch {
      setError("Failed to update item.");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/menu/items/${deleteTarget.id}`);
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      setError("Failed to delete item.");
    } finally {
      setDeleting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExtracting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/menu/extract", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setExtracted(res.data.data);
      setShowReview(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.error || "Extraction failed. Try a clearer image.",
      );
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSaveExtracted = async () => {
    if (!venue || extracted.length === 0) return;
    setSavingExtracted(true);
    try {
      await api.post("/menu", { venueId: venue.id, items: extracted });
      setShowReview(false);
      setExtracted([]);
      await fetchMenu();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to save items.");
    } finally {
      setSavingExtracted(false);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Menu
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {items.length} items · {venue?.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
            <Star size={12} className="fill-amber-500 text-amber-500" /> Tap the star on up to 3 dishes: your chef's picks, shown first on your Skuzi page.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={extracting}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {extracting ? (
              <Loader size={15} className="animate-spin" />
            ) : (
              <Sparkles size={15} className="text-skuzi-honey" />
            )}
            {extracting ? "Extracting..." : "Upload menu"}
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={16} /> Add item
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {/* AI Review modal */}
      {showReview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#2B201B] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Review extracted items
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {extracted.length} items found — review before saving
                </p>
              </div>
              <button
                onClick={() => setShowReview(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-800">
              {extracted.map((item, i) => (
                <div
                  key={i}
                  className="px-5 py-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400">{item.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-brand-500">
                      {formatRwf(item.priceRwf)}
                    </span>
                    <button
                      onClick={() =>
                        setExtracted((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
              <button
                onClick={() => setShowReview(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveExtracted}
                disabled={savingExtracted || extracted.length === 0}
                className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {savingExtracted
                  ? "Saving..."
                  : `Save ${extracted.length} items`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete item?"
          message={`"${deleteTarget.name}" will be removed from your menu. This can't be undone.`}
          confirmLabel="Delete"
          danger
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            New item
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Item name"
              className="px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1C1511] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category"
              className="px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1C1511] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Price (RWF)"
              className="px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-[#1C1511] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={handleAddItem}
            disabled={addLoading || !newName || !newCategory || !newPrice}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
          >
            {addLoading ? "Adding..." : "Add item"}
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Menu items by category */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div
            key={category}
            className="bg-white dark:bg-[#2B201B] border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden"
          >
            <div className="px-5 py-3 bg-gray-50 dark:bg-[#1C1511]">
              <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {category}
              </h2>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className={`px-5 py-3 flex items-center justify-between ${!item.isAvailable ? "opacity-50" : ""}`}
                >
                  <div className="flex-1">
                    {editingId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1C1511] text-gray-900 dark:text-white w-40 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="text-sm px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#1C1511] text-gray-900 dark:text-white w-28 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          className="text-green-500 hover:text-green-600"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.name}
                        </p>
                        <p className="text-xs text-brand-500 font-semibold mt-0.5">
                          {formatRwf(item.priceRwf)}
                        </p>
                      </div>
                    )}
                  </div>
                  {editingId !== item.id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFeature(item)}
                        aria-label={item.featured ? `Remove ${item.name} from chef's picks` : `Make ${item.name} a chef's pick`}
                        aria-pressed={!!item.featured}
                        title={item.featured ? "Chef's pick (shown first on your Skuzi page)" : "Make it a chef's pick (up to 3)"}
                        className="p-1 transition-colors"
                      >
                        <Star size={18} className={item.featured ? "fill-amber-500 text-amber-500" : "text-gray-300 hover:text-amber-500 dark:text-gray-600"} />
                      </button>
                      <button
                        onClick={() => handleToggle(item.id)}
                        className="text-gray-400 hover:text-brand-500 transition-colors"
                      >
                        {item.isAvailable ? (
                          <ToggleRight size={20} className="text-brand-500" />
                        ) : (
                          <ToggleLeft size={20} />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditName(item.name);
                          setEditPrice(String(item.priceRwf));
                        }}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
            No menu items yet. Add items manually or upload your menu.
          </div>
        )}
      </div>
    </Layout>
  );
}

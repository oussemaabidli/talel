import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { api, ApiError } from '../../api/client';
import { SearchInput, Modal, ConfirmModal } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { mockCategories } from '../../data/mockData';
import type { InventoryItem, PartCondition } from '../../types';
import {
  Box, Plus, Edit2, Trash2, ArrowUpDown, Filter,
  CheckCircle2, AlertTriangle, Layers
} from 'lucide-react';

export const SellerInventory: React.FC = () => {
  const addToast = useStore((state) => state.addToast);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'price'>('name');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    partName: '',
    category: 'Brake System',
    brand: 'Bosch',
    referenceNumber: '',
    compatibleVehicles: 'Toyota Camry 2018-2023',
    condition: 'new' as PartCondition,
    price: 450,
    quantity: 10,
    warranty: '24 months',
    description: '',
  });

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ data: Array<Record<string, unknown>> }>('/seller/inventory?limit=100');
      setInventory(result.data.map((part) => ({
        id: String(part.id), sellerId: '', partName: String(part.partName), category: String(part.category), brand: String(part.brand),
        referenceNumber: String(part.oemReference || part.sku || ''), compatibleVehicles: (part.compatibleVehicles as string[]) || [],
        condition: String(part.condition).toLowerCase() as PartCondition, price: Number(part.price), quantity: Number(part.stock),
        warranty: String(part.warranty || ''), images: [], description: String(part.description || ''), isActive: Boolean(part.isActive),
        createdAt: String(part.createdAt), updatedAt: String(part.updatedAt),
      })));
      setLoadError('');
    } catch (error) { setLoadError(error instanceof ApiError ? error.message : 'Unable to load inventory.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadInventory(); }, [loadInventory]);

  const filteredInventory = inventory
    .filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = item.partName.toLowerCase().includes(q);
        const matchBrand = item.brand.toLowerCase().includes(q);
        const matchRef = item.referenceNumber.toLowerCase().includes(q);
        return matchName || matchBrand || matchRef;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'stock') return b.quantity - a.quantity;
      if (sortBy === 'price') return b.price - a.price;
      return a.partName.localeCompare(b.partName);
    });

  const handleOpenAdd = () => {
    setFormData({
      partName: '',
      category: 'Brake System',
      brand: 'Bosch',
      referenceNumber: '',
      compatibleVehicles: 'Toyota Camry 2018-2023',
      condition: 'new',
      price: 450,
      quantity: 10,
      warranty: '24 months',
      description: '',
    });
    setEditingItem(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      partName: item.partName,
      category: item.category,
      brand: item.brand,
      referenceNumber: item.referenceNumber,
      compatibleVehicles: item.compatibleVehicles.join(', '),
      condition: item.condition,
      price: item.price,
      quantity: item.quantity,
      warranty: item.warranty,
      description: item.description,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.partName.trim()) {
      addToast('error', 'Part name is required');
      return;
    }

    const input = {
      partName: formData.partName.trim(), category: formData.category, brand: formData.brand.trim(),
      sku: formData.referenceNumber.trim() || `SKU-${Date.now()}`,
      oemReference: formData.referenceNumber.trim() || undefined,
      compatibleVehicles: formData.compatibleVehicles.split(',').map((s) => s.trim()).filter(Boolean),
      condition: formData.condition.toUpperCase(), price: formData.price, stock: formData.quantity,
      minimumStock: 0, warranty: formData.warranty, description: formData.description.trim(),
    };
    try {
      if (editingItem) {
        const { sku, ...updates } = input;
        await api.patch(`/seller/inventory/${editingItem.id}`, updates);
        addToast('success', 'Part updated successfully');
      } else {
        await api.post('/seller/inventory', input);
        addToast('success', 'New part added to shop inventory');
      }
      setIsAddModalOpen(false);
      await loadInventory();
    } catch (error) { addToast('error', error instanceof ApiError ? error.message : 'Could not save inventory item.'); }
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      try { await api.delete(`/seller/inventory/${deletingId}`); addToast('info', 'Part archived from inventory'); setDeletingId(null); await loadInventory(); }
      catch (error) { addToast('error', error instanceof ApiError ? error.message : 'Could not archive inventory item.'); }
    }
  };

  const handleQuickStockUpdate = async (item: InventoryItem, delta: number) => {
    try { await api.post(`/seller/inventory/${item.id}/stock`, { delta }); await loadInventory(); }
    catch (error) { addToast('error', error instanceof ApiError ? error.message : 'Could not update stock.'); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Inventory Management</h1>
          <p className="text-sm text-text-secondary">
            Manage stocked parts, adjust quantities, and set standard reference pricing.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus size={16} /> Add New Part
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search part name, brand, reference..."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="select-field !py-2 !w-auto text-xs"
          >
            <option value="all">All Categories</option>
            {mockCategories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="select-field !py-2 !w-auto text-xs"
          >
            <option value="name">Sort by Name</option>
            <option value="stock">Sort by Stock Qty</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card overflow-hidden">
        {filteredInventory.length === 0 ? (
              <div className="py-16 text-center">
            {loading ? <p className="text-sm text-text-secondary">Loading inventory…</p> : loadError ? <div><p className="text-sm text-danger">{loadError}</p><button className="btn-secondary mt-3 text-xs" onClick={() => void loadInventory()}>Retry</button></div> : <>
            <Box size={36} className="text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-navy-900">No inventory found</h3>
            <p className="text-xs text-text-secondary mt-0.5">Try altering search keywords or add a new part.</p>
            </>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                  <th className="py-3 px-4">Part Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Brand / Ref</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4 text-center">In Stock</th>
                  <th className="py-3 px-4">Warranty</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-secondary/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-navy-900 text-xs">{item.partName}</p>
                      <p className="text-[11px] text-text-secondary truncate max-w-xs">
                        {item.compatibleVehicles.join(', ')}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-text-secondary">
                      {item.category}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <span className="font-semibold text-navy-900">{item.brand}</span>
                      <span className="text-text-secondary block font-mono text-[10px]">{item.referenceNumber}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-xs text-navy-900">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleQuickStockUpdate(item, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors"
                        >
                          -
                        </button>
                        <span className={`text-xs font-bold min-w-6 ${
                          item.quantity <= 2 ? 'text-danger font-extrabold' : 'text-navy-900'
                        }`}>
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuickStockUpdate(item, 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-green-700">
                      {item.warranty}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg border border-border hover:bg-accent-light/50 text-accent transition-colors"
                          title="Edit Part"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingId(item.id)}
                          className="p-1.5 rounded-lg border border-border hover:bg-red-50 text-danger transition-colors"
                          title="Delete Part"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Part Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingItem ? 'Edit Inventory Part' : 'Add Part to Inventory'}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Part Name *</label>
              <input
                type="text"
                value={formData.partName}
                onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="label">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="select-field"
              >
                {mockCategories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Brand / Manufacturer</label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">OEM / Reference Number</label>
              <input
                type="text"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
            <label className="label">Price (TND)</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Stock Quantity</label>
              <input
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Condition</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value as PartCondition })}
                className="select-field"
              >
                <option value="new">Brand New</option>
                <option value="used">Used / Salvage</option>
              </select>
            </div>

            <div>
              <label className="label">Warranty Duration</label>
              <input
                type="text"
                value={formData.warranty}
                onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="label">Compatible Vehicles (Comma separated)</label>
            <input
              type="text"
              placeholder="e.g. Toyota Camry 2018-2023, RAV4 2019-2023"
              value={formData.compatibleVehicles}
              onChange={(e) => setFormData({ ...formData, compatibleVehicles: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Description & Notes</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="btn-secondary text-xs"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              {editingItem ? 'Save Changes' : 'Add to Inventory'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Inventory Part"
        message="Are you sure you want to delete this part from your catalog? This action cannot be undone."
        confirmText="Delete Part"
        variant="danger"
      />
    </div>
  );
};

export default SellerInventory;


import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput, Modal, ConfirmModal } from '../../components/ui';
import type { Category } from '../../types';
import {
  Layers, Plus, Edit2, Trash2, CheckCircle, XCircle,
  FolderPlus, AlertCircle
} from 'lucide-react';
import { hostApi } from '../../api/host';

export const HostCategories: React.FC = () => {
  const { categories, addCategory, updateCategory, deleteCategory, addToast } = useStore();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('box');

  const filteredCategories = categories.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
    }
    return true;
  });

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setDescription('');
    setIcon('box');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingCategory(c);
    setName(c.name);
    setDescription(c.description);
    setIcon(c.icon);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const payload = { name: name.trim(), description: description.trim(), icon };
      if (editingCategory) {
        const saved = await hostApi<Category>(`/host/categories/${encodeURIComponent(editingCategory.id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
        updateCategory(saved.id, { ...saved, partCount: editingCategory.partCount });
        addToast('success', 'Category updated successfully');
      } else {
        const saved = await hostApi<Category>('/host/categories', { method: 'POST', body: JSON.stringify(payload) });
        addCategory({ ...saved, partCount: 0 });
        addToast('success', 'New category created');
      }
      setIsModalOpen(false);
    } catch (error) { addToast('error', error instanceof Error ? error.message : 'Unable to save category.'); }
  };

  const handleToggleActive = async (c: Category) => {
    try {
      await hostApi(`/host/categories/${encodeURIComponent(c.id)}`, { method: 'PATCH', body: JSON.stringify({ isActive: !c.isActive }) });
      updateCategory(c.id, { isActive: !c.isActive });
      addToast('info', `Category ${!c.isActive ? 'activated' : 'disabled'}`);
    } catch (error) { addToast('error', error instanceof Error ? error.message : 'Unable to update category.'); }
  };

  const handleConfirmDelete = async () => {
    if (deletingId) {
      try {
        await hostApi(`/host/categories/${encodeURIComponent(deletingId)}`, { method: 'DELETE' });
        deleteCategory(deletingId); addToast('info', 'Category removed'); setDeletingId(null);
      } catch (error) { addToast('error', error instanceof Error ? error.message : 'Unable to remove category.'); }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Vehicle Parts Taxonomy</h1>
          <p className="text-sm text-text-secondary">
            Manage system spare-part categories, request classifications, and catalog taxonomies.
          </p>
        </div>

        <button onClick={handleOpenAdd} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Search categories..." />
        </div>
        <span className="text-xs text-text-secondary font-medium">
          Total Categories: <strong className="text-navy-900 font-bold">{categories.length}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredCategories.map((c) => (
          <div key={c.id} className="card p-5 flex flex-col justify-between hover:shadow-md transition-all border-slate-200">
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="w-10 h-10 rounded-xl bg-surface-tertiary flex items-center justify-center font-bold text-lg">
                  ⚙️
                </div>
                <button
                  onClick={() => handleToggleActive(c)}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    c.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {c.isActive ? 'Active' : 'Disabled'}
                </button>
              </div>

              <h3 className="text-sm font-bold text-navy-900">{c.name}</h3>
              <p className="text-xs text-text-secondary mt-1 line-clamp-2">{c.description}</p>
              <span className="text-[11px] font-semibold text-accent mt-3 block">
                {c.partCount} listed parts
              </span>
            </div>

            <div className="pt-3 mt-4 border-t border-border flex items-center justify-end gap-1.5">
              <button
                onClick={() => handleOpenEdit(c)}
                className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-accent transition-colors"
                title="Edit Category"
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={() => setDeletingId(c.id)}
                className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-danger transition-colors"
                title="Delete Category"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Create Category'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Category Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field resize-none text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary text-xs">
              Cancel
            </button>
            <button type="submit" className="btn-primary text-xs">
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Category"
        message="Are you sure you want to remove this category? Requests already referencing it will retain their classification."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};

export default HostCategories;


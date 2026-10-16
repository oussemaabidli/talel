import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput, Avatar, VerifiedBadge, ConfirmModal } from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import type { UserRole } from '../../types';
import {
  Users, UserCheck, Store, Shield, Search,
  CheckCircle, XCircle, Trash2, ArrowUpDown
} from 'lucide-react';
import { hostApi } from '../../api/host';

export const HostUsers: React.FC = () => {
  const { clients, sellers, toggleUserStatus, addToast } = useStore();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'client' | 'seller'>('all');
  const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);

  // Combine users
  const allUsers = [
    ...clients.map(c => ({ ...c, role: 'client' as UserRole, displayName: c.name, subtext: c.email })),
    ...sellers.map(s => ({ ...s, role: 'seller' as UserRole, displayName: s.shopName, subtext: `${s.name} • ${s.email}` }))
  ];

  const filteredUsers = allUsers.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q);
    }
    return true;
  });

  const handleToggle = async () => {
    if (confirmToggleId) {
      const user = allUsers.find((item) => item.id === confirmToggleId);
      if (!user) return;
      try {
        await hostApi(`/host/users/${encodeURIComponent(user.id)}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) });
        toggleUserStatus(confirmToggleId);
        addToast('success', 'User account status updated');
        setConfirmToggleId(null);
      } catch (error) { addToast('error', error instanceof Error ? error.message : 'Unable to update account.'); }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">User Management</h1>
          <p className="text-sm text-text-secondary">
            Manage buyer accounts, verified store suppliers, and account statuses across the platform.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search user name, email, or ID..."
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              roleFilter === 'all' ? 'bg-navy-900 text-white' : 'bg-surface-secondary text-text-secondary hover:text-navy-900'
            }`}
          >
            All ({allUsers.length})
          </button>
          <button
            onClick={() => setRoleFilter('client')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              roleFilter === 'client' ? 'bg-accent text-white' : 'bg-surface-secondary text-text-secondary hover:text-navy-900'
            }`}
          >
            Clients ({clients.length})
          </button>
          <button
            onClick={() => setRoleFilter('seller')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              roleFilter === 'seller' ? 'bg-primary text-white' : 'bg-surface-secondary text-text-secondary hover:text-navy-900'
            }`}
          >
            Sellers ({sellers.length})
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.displayName} size="sm" />
                      <div>
                        <p className="font-bold text-navy-900 text-xs">{u.displayName}</p>
                        <p className="text-[11px] text-text-secondary">{u.subtext}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                      u.role === 'seller' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-secondary">
                    {u.city || 'Location not provided'}, Tunisia
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    {u.isVerified ? (
                      <span className="flex items-center gap-1 text-green-700 font-semibold text-xs">
                        <CheckCircle size={14} /> Verified
                      </span>
                    ) : (
                      <span className="text-text-tertiary text-xs">Pending</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                      u.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-secondary">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setConfirmToggleId(u.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                        u.isActive
                          ? 'border-border text-danger hover:bg-red-50'
                          : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100'
                      }`}
                    >
                      {u.isActive ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!confirmToggleId}
        onClose={() => setConfirmToggleId(null)}
        onConfirm={handleToggle}
        title="Toggle User Status"
        message="Are you sure you want to change this user account status? Suspended users will not be able to transact."
        confirmText="Confirm Status Change"
        variant="primary"
      />
    </div>
  );
};

export default HostUsers;


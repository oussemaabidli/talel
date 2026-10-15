import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput, Avatar, Rating, VerifiedBadge, ConfirmModal } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { Store, Search, CheckCircle, ShieldCheck } from 'lucide-react';
import { hostApi } from '../../api/host';

export const HostSellers: React.FC = () => {
  const { sellers, toggleUserStatus, updateSeller, addToast } = useStore();
  const [search, setSearch] = useState('');
  const [toggleId, setToggleId] = useState<string | null>(null);

  const filteredSellers = sellers.filter(s => {
    if (search) {
      const q = search.toLowerCase();
      return s.shopName.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleVerification = async (sellerId: string, currentVal: boolean) => {
    try {
      await hostApi(`/host/sellers/${encodeURIComponent(sellerId)}/verification`, { method: 'PATCH', body: JSON.stringify({ status: !currentVal ? 'verified' : 'pending_verification' }) });
      useStore.setState((state) => ({ sellers: state.sellers.map((seller) => seller.id === sellerId ? { ...seller, isVerified: !currentVal } : seller) }));
      addToast('success', `Seller verification ${!currentVal ? 'approved' : 'returned to pending'}`);
    } catch (error) { addToast('error', error instanceof Error ? error.message : 'Unable to update verification.'); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Seller & Supplier Directory</h1>
        <p className="text-sm text-text-secondary">
          Monitor approved automotive parts vendors, ratings, revenue volume, and verification badges.
        </p>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Search shop name, city..." />
        </div>
        <span className="text-xs text-text-secondary font-medium">
          Verified Vendors: <strong className="text-navy-900 font-bold">{sellers.length}</strong>
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                <th className="py-3 px-4">Shop & Owner</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Rating</th>
                <th className="py-3 px-4">Total Sales</th>
                <th className="py-3 px-4">Gross Revenue</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredSellers.map((seller) => (
                <tr key={seller.id} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={seller.shopName} size="sm" />
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="font-bold text-navy-900 text-xs">{seller.shopName}</p>
                          {seller.isVerified && <VerifiedBadge />}
                        </div>
                        <p className="text-[11px] text-text-secondary">{seller.name} • {seller.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium text-navy-900">{seller.city}</td>
                  <td className="py-3.5 px-4 text-xs">
                    <Rating rating={seller.rating} reviews={seller.totalReviews} size={11} />
                  </td>
                  <td className="py-3.5 px-4 text-xs font-bold text-navy-900">{seller.totalSales}</td>
                  <td className="py-3.5 px-4 text-xs font-bold text-navy-900">{formatCurrency(seller.revenue)}</td>
                  <td className="py-3.5 px-4 text-xs">
                    <button
                      onClick={() => toggleVerification(seller.id, seller.isVerified)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                        seller.isVerified
                          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {seller.isVerified ? '✓ Verified' : '+ Verify'}
                    </button>
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                      seller.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {seller.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setToggleId(seller.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold ${
                        seller.isActive ? 'border-border text-danger hover:bg-red-50' : 'border-green-200 text-green-700 bg-green-50'
                      }`}
                    >
                      {seller.isActive ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!toggleId}
        onClose={() => setToggleId(null)}
        onConfirm={async () => {
          if (toggleId) {
            const seller = sellers.find((entry) => entry.id === toggleId);
            try {
              await hostApi(`/host/users/${encodeURIComponent(toggleId)}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !seller?.isActive }) });
              toggleUserStatus(toggleId); addToast('success', 'Seller account status updated'); setToggleId(null);
            } catch (error) { addToast('error', error instanceof Error ? error.message : 'Unable to update account.'); }
          }
        }}
        title="Toggle Seller Status"
        message="Are you sure you want to alter this vendor's shop access?"
        confirmText="Confirm"
      />
    </div>
  );
};

export default HostSellers;


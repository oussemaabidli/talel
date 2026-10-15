import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput, StatusBadge } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { Tag, Search, ArrowUpDown } from 'lucide-react';

export const HostOffers: React.FC = () => {
  const { offers, requests } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredOffers = offers.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.id.toLowerCase().includes(q) || o.sellerShop.toLowerCase().includes(q) || o.partName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Offer Supervision</h1>
        <p className="text-sm text-text-secondary">
          Audit quotes submitted by sellers, pricing consistency, warranty terms, and buyer acceptances.
        </p>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Search offer ID, shop, part..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select-field !py-2 !w-auto text-xs"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                <th className="py-3 px-4">Offer ID</th>
                <th className="py-3 px-4">Request Ref</th>
                <th className="py-3 px-4">Seller Shop</th>
                <th className="py-3 px-4">Part Quoted</th>
                <th className="py-3 px-4">Price / Terms</th>
                <th className="py-3 px-4">Warranty</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredOffers.map((o) => (
                <tr key={o.id} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-xs text-navy-900">#{o.id}</td>
                  <td className="py-3.5 px-4 text-xs font-mono text-accent">#{o.requestId}</td>
                  <td className="py-3.5 px-4 font-semibold text-xs text-navy-900">{o.sellerShop}</td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className="font-semibold text-navy-900">{o.partName}</span>
                    <span className="text-[11px] text-text-secondary block">{o.partBrand} • {o.condition}</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-bold text-navy-900">
                    {formatCurrency(o.price)}
                    <span className="text-[10px] text-text-secondary font-normal block">
                      +{o.deliveryCost} TND shipping
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-green-700">{o.warranty}</td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-secondary">
                    {formatDate(o.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HostOffers;


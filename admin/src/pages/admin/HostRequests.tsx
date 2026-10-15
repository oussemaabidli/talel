import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput, StatusBadge } from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import { FileText, Filter, Car, MapPin, Eye } from 'lucide-react';

export const HostRequests: React.FC = () => {
  const { requests, categories } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const filteredRequests = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.id.toLowerCase().includes(q) || r.partName.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q) || r.vehicle.brand.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Request Lifecycle Inspector</h1>
        <p className="text-sm text-text-secondary">
          Monitor all buyer requests, matching velocity, and quote generation across the platform.
        </p>
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search Request ID, buyer, part..." />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select-field text-xs"
        >
          <option value="all">All Statuses</option>
          <option value="published">Published</option>
          <option value="offers_received">Offers Received</option>
          <option value="offer_accepted">Offer Accepted</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="select-field text-xs"
        >
          <option value="all">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Buyer</th>
                <th className="py-3 px-4">Target Vehicle</th>
                <th className="py-3 px-4">Part Needed</th>
                <th className="py-3 px-4">Budget Range</th>
                <th className="py-3 px-4 text-center">Offers</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredRequests.map((r) => (
                <tr key={r.id} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-xs text-navy-900">#{r.id}</td>
                  <td className="py-3.5 px-4 font-semibold text-xs text-navy-900">{r.clientName}</td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className="font-semibold text-navy-900">{r.vehicle.brand} {r.vehicle.model}</span>
                    <span className="text-text-secondary block text-[11px]">{r.vehicle.year} • {r.vehicle.engine}</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-navy-900">
                    {r.partName} <span className="text-text-secondary font-normal">({r.category})</span>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-bold text-navy-900">
                    {r.minBudget.toLocaleString()} - {r.maxBudget.toLocaleString()} TND
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700">
                      {r.offersCount}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-secondary">
                    {formatDate(r.createdAt)}
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

export default HostRequests;


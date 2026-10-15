import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { api, ApiError } from '../../api/client';
import { StatusBadge, SearchInput, Tabs } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import {
  Tag, Search, ArrowRight, Eye, Clock, CheckCircle2,
  XCircle, ArrowUpDown
} from 'lucide-react';
import type { Offer, SparePartRequest } from '../../types';

export const SellerOffers: React.FC = () => {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [requests, setRequests] = useState<SparePartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOffers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ data: Array<Record<string, unknown>> }>('/seller/offers');
      const requestMap = new Map<string, SparePartRequest>();
      const mapped = result.data.map((raw) => {
        const req = raw.request as Record<string, unknown>;
        if (req) requestMap.set(String(req.id), { id: String(req.id), clientId: '', clientName: 'Marketplace request', vehicle: { id: '', brand: String(req.vehicleMake || ''), model: String(req.vehicleModel || ''), year: Number(req.vehicleYear || 0), engine: '' }, category: String(req.category), partName: String(req.partName), referenceNumber: req.oemReference ? String(req.oemReference) : undefined, quantity: Number(req.quantity), condition: String(req.condition).toLowerCase() as SparePartRequest['condition'], description: String(req.description), images: [], minBudget: Number(req.minBudget || 0), maxBudget: Number(req.maxBudget || 0), deliveryMethod: String(req.deliveryMethod || 'unknown').toLowerCase() as SparePartRequest['deliveryMethod'], location: String(req.location || ''), status: String(req.status).toLowerCase() as SparePartRequest['status'], offersCount: Number((req._count as { offers?: number } | undefined)?.offers || 0), createdAt: String(req.createdAt), updatedAt: String(req.updatedAt) });
        return { id: String(raw.id), requestId: String(raw.requestId), sellerId: '', sellerName: '', sellerShop: '', sellerRating: 0, sellerReviews: 0, sellerVerified: true, sellerAvatar: '', partName: String(raw.partName), partBrand: String(raw.brand), referenceNumber: String(raw.referenceNumber), condition: String(raw.condition).toLowerCase() as Offer['condition'], price: Number(raw.price), quantity: Number(raw.quantity), availability: '', warranty: String(raw.warranty), deliveryMethod: 'unknown' as Offer['deliveryMethod'], deliveryCost: Number(raw.deliveryFee), deliveryTime: String(raw.estimatedDelivery), description: String(raw.description), images: [], status: String(raw.status).toLowerCase() as Offer['status'], createdAt: String(raw.createdAt), expiresAt: '' };
      });
      setOffers(mapped); setRequests([...requestMap.values()]); useStore.setState({ offers: mapped, requests: [...requestMap.values()] }); setError('');
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to load offers.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadOffers(); }, [loadOffers]);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'price'>('newest');

  const myOffers = offers;

  const tabs = [
    { id: 'all', label: 'All My Offers', count: myOffers.length },
    { id: 'pending', label: 'Pending', count: myOffers.filter(o => o.status === 'pending').length },
    { id: 'accepted', label: 'Accepted', count: myOffers.filter(o => o.status === 'accepted').length },
    { id: 'rejected', label: 'Rejected', count: myOffers.filter(o => o.status === 'rejected').length },
  ];

  const filteredOffers = myOffers
    .filter((o) => {
      if (activeTab !== 'all' && o.status !== activeTab) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchPart = o.partName.toLowerCase().includes(q);
        const matchBrand = o.partBrand.toLowerCase().includes(q);
        const matchId = o.id.toLowerCase().includes(q);
        return matchPart || matchBrand || matchId;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'price') return b.price - a.price;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">My Sent Offers</h1>
          <p className="text-sm text-text-secondary">
            Track quotation statuses and conversion rates across active client requests.
          </p>
        </div>
        <button
          onClick={() => navigate('/seller/requests')}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto"
        >
          <Tag size={16} /> Browse New Requests
        </button>
      </div>

      {/* Tabs */}
      <div className="card p-2">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search offer ID, part, or brand..."
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-text-secondary flex items-center gap-1 font-medium">
            <ArrowUpDown size={14} /> Sort by:
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="select-field !py-2 !w-auto text-xs"
          >
            <option value="newest">Most Recent</option>
            <option value="price">Highest Price</option>
          </select>
        </div>
      </div>

      {/* Offers Table */}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 font-semibold underline" onClick={() => void loadOffers()}>Retry</button></div>}
      <div className="card overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-text-secondary">Loading offers…</div> : filteredOffers.length === 0 ? (
          <div className="py-16 text-center">
            <Tag size={36} className="text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-navy-900">No offers found</h3>
            <p className="text-xs text-text-secondary mt-0.5">You have no offers matching this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                  <th className="py-3 px-4">Offer ID</th>
                  <th className="py-3 px-4">Part Quoted</th>
                  <th className="py-3 px-4">Brand / Condition</th>
                  <th className="py-3 px-4">Price Quote</th>
                  <th className="py-3 px-4">Warranty</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date Sent</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredOffers.map((o) => {
                  const req = requests.find(r => r.id === o.requestId);

                  return (
                    <tr key={o.id} className="hover:bg-surface-secondary/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-xs text-navy-900">
                        #{o.id}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-navy-900 text-xs">{o.partName}</span>
                        {req && (
                          <p className="text-[11px] text-text-secondary">
                            For {req.vehicle.brand} {req.vehicle.model}
                          </p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs">
                        <span className="font-medium text-navy-900">{o.partBrand}</span>
                        <span className="text-text-secondary capitalize"> • {o.condition}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-xs text-navy-900">
                        {formatCurrency(o.price)}
                        {o.deliveryCost > 0 && (
                          <span className="text-[10px] text-text-secondary block font-normal">
                            + {formatCurrency(o.deliveryCost)} delivery
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-green-700 font-semibold">
                        {o.warranty}
                      </td>
                      <td className="py-3.5 px-4">
                        <StatusBadge status={o.status} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-text-secondary">
                        {formatDate(o.createdAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => navigate(`/seller/requests/${o.requestId}`)}
                          className="px-3 py-1 border border-border text-xs font-semibold rounded-lg text-accent hover:bg-accent-light transition-colors"
                        >
                          View Request
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerOffers;


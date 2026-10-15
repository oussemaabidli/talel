import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { api, ApiError } from '../../api/client';
import { SearchInput, StatusBadge } from '../../components/ui';
import { formatDate, formatCurrency } from '../../utils/helpers';
import type { SparePartRequest } from '../../types';
import { mockCategories, vehicleBrands } from '../../data/mockData';
import {
  FileText, Filter, Car, MapPin, DollarSign,
  ArrowRight, Tag, Clock, Eye, Send
} from 'lucide-react';

export const SellerRequests: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SparePartRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ data: Array<{ id: string; partName: string; category: string; oemReference: string | null; vehicleMake: string | null; vehicleModel: string | null; vehicleYear: number | null; condition: string; quantity: number; minBudget: string | null; maxBudget: string | null; location: string | null; deliveryMethod: string | null; description: string; status: string; createdAt: string; updatedAt: string; _count: { offers: number } }> }>('/seller/requests');
      const mapped = result.data.map((req) => ({ id: req.id, clientId: '', clientName: 'Marketplace request', vehicle: { id: '', brand: req.vehicleMake || '', model: req.vehicleModel || '', year: req.vehicleYear || 0, engine: '' }, category: req.category, partName: req.partName, referenceNumber: req.oemReference || undefined, quantity: req.quantity, condition: req.condition.toLowerCase() as SparePartRequest['condition'], description: req.description, images: [], minBudget: Number(req.minBudget || 0), maxBudget: Number(req.maxBudget || 0), deliveryMethod: (req.deliveryMethod?.toLowerCase() || 'unknown') as SparePartRequest['deliveryMethod'], location: req.location || '', status: req.status.toLowerCase() as SparePartRequest['status'], offersCount: req._count.offers, createdAt: req.createdAt, updatedAt: req.updatedAt }));
      setRequests(mapped);
      useStore.setState({ requests: mapped });
      setError('');
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to load marketplace requests.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadRequests(); }, [loadRequests]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedCondition, setSelectedCondition] = useState('all');

  // Filter requests that are open for offers
  const openRequests = requests.filter(r => r.status !== 'draft' && r.status !== 'cancelled');

  const filteredRequests = openRequests.filter((req) => {
    if (selectedCategory !== 'all' && req.category !== selectedCategory) return false;
    if (selectedBrand !== 'all' && req.vehicle.brand !== selectedBrand) return false;
    if (selectedCondition !== 'all' && req.condition !== selectedCondition && req.condition !== 'either') return false;

    if (search) {
      const q = search.toLowerCase();
      const matchPart = req.partName.toLowerCase().includes(q);
      const matchVehicle = `${req.vehicle.brand} ${req.vehicle.model}`.toLowerCase().includes(q);
      const matchLoc = req.location.toLowerCase().includes(q);
      return matchPart || matchVehicle || matchLoc;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Buyer Request Marketplace</h1>
        <p className="text-sm text-text-secondary">
          Browse verified part requests from car owners and garages. Submit your best quote to win the order.
        </p>
      </div>

      {/* Filter Controls Bar */}
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search part, vehicle, city..."
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="select-field text-xs"
            >
              <option value="all">All Categories</option>
              {mockCategories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Vehicle Brand Filter */}
          <div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="select-field text-xs"
            >
              <option value="all">All Vehicle Brands</option>
              {vehicleBrands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Condition Filter */}
          <div>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="select-field text-xs"
            >
              <option value="all">Any Condition</option>
              <option value="new">New Only</option>
              <option value="used">Used / Secondhand</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 font-semibold underline" onClick={() => void loadRequests()}>Retry</button></div>}
      {/* Results Count */}
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>Showing <strong className="text-navy-900 font-bold">{filteredRequests.length}</strong> available buyer requests</span>
      </div>

      {/* Requests Grid */}
      {loading ? <div className="card p-10 text-center text-sm text-text-secondary">Loading requests…</div> : filteredRequests.length === 0 ? <div className="card p-12 text-center text-sm text-text-secondary">No marketplace requests are available.</div> : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredRequests.map((req) => (
          <div
            key={req.id}
            className="card p-5 flex flex-col justify-between hover:shadow-md border-slate-200 transition-all group"
          >
            <div>
              {/* Top metadata */}
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-border">
                <span className="text-xs font-bold text-navy-900">#{req.id}</span>
                <span className="text-[11px] text-text-tertiary flex items-center gap-1">
                  <Clock size={12} /> {formatDate(req.createdAt)}
                </span>
              </div>

              {/* Vehicle Title */}
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-navy-900">
                    {req.vehicle.brand} {req.vehicle.model} {req.vehicle.year ? `(${req.vehicle.year})` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary">{req.vehicle.engine}</p>
              </div>

              {/* Part Name & Specs */}
              <div className="mt-3 p-3 rounded-xl bg-surface-secondary/70 border border-border space-y-1.5">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-extrabold text-navy-900">{req.partName}</span>
                  <span className="text-xs font-bold text-accent">Qty: {req.quantity}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-white text-text-secondary font-medium border border-border">
                    {req.category}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white text-text-secondary font-medium border border-border capitalize">
                    {req.condition}
                  </span>
                  {req.referenceNumber && (
                    <span className="px-2 py-0.5 rounded bg-white text-text-secondary font-medium border border-border">
                      Ref: {req.referenceNumber}
                    </span>
                  )}
                </div>
              </div>

              {/* Budget & Location */}
              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between text-text-secondary">
                  <span>Buyer Budget:</span>
                  <span className="font-bold text-navy-900">
                    {req.minBudget || req.maxBudget ? `${formatCurrency(req.minBudget)} - ${formatCurrency(req.maxBudget)}` : 'Not specified'}
                  </span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Location:</span>
                  <span className="font-medium text-navy-900 flex items-center gap-1">
                    <MapPin size={12} className="text-accent" /> {req.location} ({req.deliveryMethod === 'unknown' ? 'delivery details not specified' : req.deliveryMethod})
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-2">
              <span className="text-[11px] text-text-secondary font-medium">
                {req.offersCount} quotes sent
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/seller/requests/${req.id}`)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-secondary hover:bg-surface-secondary transition-colors"
                >
                  Details
                </button>
                <button
                  onClick={() => navigate(`/seller/requests/${req.id}/offer`)}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                >
                  <Send size={13} /> Make Offer
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>}
    </div>
  );
};

export default SellerRequests;


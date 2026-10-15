import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { api, ApiError } from '../../api/client';
import type { Order } from '../../types';
import { StatusBadge, SearchInput, Tabs } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import {
  Package, Search, ArrowRight, Clock, CheckCircle2,
  Truck, ArrowUpDown, AlertCircle
} from 'lucide-react';

export const SellerOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<{ data: Array<Record<string, unknown>> }>('/seller/orders');
      const mapped = result.data.map((raw) => {
        const offer = raw.offer as Record<string, unknown>;
        const request = raw.request as Record<string, unknown>;
        const events = (raw.events as Array<Record<string, unknown>>) || [];
        const status = String(raw.status).toLowerCase();
        return { id: String(raw.id), requestId: String(raw.requestId), offerId: String(raw.offerId), clientId: '', clientName: 'Marketplace customer', sellerId: '', sellerName: '', sellerShop: '', partName: String(offer.partName), partBrand: String(offer.brand), referenceNumber: String(offer.referenceNumber), condition: String(offer.condition).toLowerCase() as Order['condition'], quantity: Number(offer.quantity), price: Number(offer.price), deliveryCost: Number(offer.deliveryFee), totalAmount: Number(raw.totalAmount), deliveryMethod: 'unknown' as Order['deliveryMethod'], location: String(request.location || ''), status: (status === 'dispatched' ? 'delivery' : status) as Order['status'], timeline: events.map((event) => { const eventStatus = String(event.status).toLowerCase(); return { status: (eventStatus === 'dispatched' ? 'delivery' : eventStatus) as Order['status'], label: eventStatus.replaceAll('_', ' '), date: String(event.createdAt), description: String(event.note || ''), completed: true }; }), createdAt: String(raw.createdAt), updatedAt: String(raw.updatedAt) };
      });
      setOrders(mapped); useStore.setState({ orders: mapped }); setError('');
    } catch (cause) { setError(cause instanceof ApiError ? cause.message : 'Unable to load orders.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'amount'>('newest');

  const myOrders = orders;

  const tabs = [
    { id: 'all', label: 'All Orders', count: myOrders.length },
    {
      id: 'active',
      label: 'Needs Action',
      count: myOrders.filter(o => ['offer_accepted', 'seller_confirmed', 'preparing', 'ready'].includes(o.status)).length
    },
    { id: 'delivery', label: 'Shipped', count: myOrders.filter(o => o.status === 'delivery').length },
    { id: 'completed', label: 'Completed', count: myOrders.filter(o => o.status === 'completed').length },
  ];

  const filteredOrders = myOrders
    .filter((order) => {
      if (activeTab === 'active' && !['offer_accepted', 'seller_confirmed', 'preparing', 'ready'].includes(order.status)) return false;
      if (activeTab !== 'all' && activeTab !== 'active' && order.status !== activeTab) return false;

      if (search) {
        const q = search.toLowerCase();
        const matchId = order.id.toLowerCase().includes(q);
        const matchPart = order.partName.toLowerCase().includes(q);
        const matchBuyer = order.clientName.toLowerCase().includes(q);
        return matchId || matchPart || matchBuyer;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return b.totalAmount - a.totalAmount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Orders to Fulfill</h1>
          <p className="text-sm text-text-secondary">
            Process client orders, update preparation stages, and dispatch parts.
          </p>
        </div>
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
            placeholder="Search Order ID, part, or buyer..."
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
            <option value="amount">Highest Value</option>
          </select>
        </div>
      </div>

      {/* Orders List */}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<button className="ml-3 font-semibold underline" onClick={() => void loadOrders()}>Retry</button></div>}
      {loading ? <div className="card p-12 text-center text-sm text-text-secondary">Loading orders…</div> : filteredOrders.length === 0 ? (
        <div className="card py-16 text-center">
          <Package size={36} className="text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-navy-900">No orders found</h3>
          <p className="text-xs text-text-secondary mt-0.5">There are no orders matching this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => navigate(`/seller/orders/${order.id}`)}
              className="card p-5 hover:shadow-md transition-all cursor-pointer border-slate-200 hover:border-accent/40 flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-surface-tertiary flex items-center justify-center font-bold text-lg shrink-0">
                  📦
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-navy-900">#{order.id}</span>
                    <StatusBadge status={order.status} />
                    <span className="text-xs text-text-tertiary">• {formatDate(order.createdAt)}</span>
                  </div>

                  <p className="text-sm font-bold text-navy-900 mt-1">
                    {order.partName} <span className="text-xs font-normal text-text-secondary">({order.partBrand})</span>
                  </p>

                  <p className="text-xs text-text-secondary mt-0.5">
                    Customer: <span className="font-semibold text-navy-900">Marketplace customer</span> • Destination: {order.location || 'not specified'} • Qty: {order.quantity}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-border">
                <div className="text-left md:text-right">
                  <p className="text-[11px] text-text-tertiary uppercase font-semibold">Net Payout</p>
                  <p className="text-base font-extrabold text-navy-900">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-accent text-xs font-bold group-hover:translate-x-1 transition-transform">
                  <span>Manage Fulfillment</span>
                  <ArrowRight size={15} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerOrders;


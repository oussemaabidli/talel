import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { StatusBadge, SearchInput, Tabs } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import {
  Package, Search, ArrowRight, Truck, Clock, CheckCircle2,
  AlertCircle, ArrowUpDown
} from 'lucide-react';

export const ClientOrders: React.FC = () => {
  const navigate = useNavigate();
  const { currentClient, orders } = useStore();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'amount'>('newest');

  const myOrders = orders.filter(o => o.clientId === currentClient.id);

  const tabs = [
    { id: 'all', label: 'All Orders', count: myOrders.length },
    {
      id: 'active',
      label: 'Active',
      count: myOrders.filter(o => !['completed', 'cancelled'].includes(o.status)).length
    },
    { id: 'preparing', label: 'Preparing', count: myOrders.filter(o => o.status === 'preparing').length },
    { id: 'ready', label: 'Ready', count: myOrders.filter(o => o.status === 'ready').length },
    { id: 'delivery', label: 'In Delivery', count: myOrders.filter(o => o.status === 'delivery').length },
    { id: 'completed', label: 'Completed', count: myOrders.filter(o => o.status === 'completed').length },
    { id: 'cancelled', label: 'Cancelled', count: myOrders.filter(o => o.status === 'cancelled').length },
  ];

  const filteredOrders = myOrders
    .filter((order) => {
      if (activeTab === 'active' && ['completed', 'cancelled'].includes(order.status)) return false;
      if (activeTab !== 'all' && activeTab !== 'active' && order.status !== activeTab) return false;

      if (search) {
        const query = search.toLowerCase();
        const matchId = order.id.toLowerCase().includes(query);
        const matchPart = order.partName.toLowerCase().includes(query);
        const matchSeller = order.sellerShop.toLowerCase().includes(query);
        return matchId || matchPart || matchSeller;
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
          <h1 className="text-2xl font-extrabold text-navy-900">Orders</h1>
          <p className="text-sm text-text-secondary">
            Monitor real-time fulfillment, delivery timelines, and order-specific supplier messages.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-2">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by Order ID, part, or seller..."
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
            <option value="amount">Highest Amount</option>
          </select>
        </div>
      </div>

      {/* Orders List / Cards */}
      {filteredOrders.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Package size={24} />
          </div>
          <h3 className="text-sm font-bold text-navy-900">No orders found</h3>
          <p className="text-xs text-text-secondary mt-1">
            There are currently no orders in this status category.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              onClick={() => navigate(`/client/orders/${order.id}`)}
              className="card p-5 hover:shadow-md transition-all cursor-pointer border-slate-200 hover:border-accent/40 group flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-surface-tertiary flex items-center justify-center text-navy-900 shrink-0 font-bold text-lg">
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
                    Sold by: <span className="font-semibold text-navy-900">{order.sellerShop}</span> • Qty: {order.quantity} • Ref: {order.referenceNumber || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-border">
                <div className="text-left md:text-right">
                  <p className="text-[11px] text-text-tertiary uppercase font-semibold">Total Price</p>
                  <p className="text-base font-extrabold text-navy-900">
                    {formatCurrency(order.totalAmount)}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-accent text-xs font-bold group-hover:translate-x-1 transition-transform">
                  <span>Track Order</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientOrders;


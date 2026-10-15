import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput, StatusBadge, Modal } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import type { Order } from '../../types';
import {
  Package, Search, Eye, CheckCircle2, Circle, Clock,
  Truck, ArrowRight, ShieldCheck
} from 'lucide-react';

export const HostOrders: React.FC = () => {
  const { orders } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return o.id.toLowerCase().includes(q) || o.clientName.toLowerCase().includes(q) || o.sellerShop.toLowerCase().includes(q) || o.partName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Order Lifecycle Control</h1>
        <p className="text-sm text-text-secondary">
          Track end-to-end fulfillment across buyer purchases, carrier deliveries, and completion timestamps.
        </p>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Search Order ID, buyer, seller..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select-field !py-2 !w-auto text-xs"
        >
          <option value="all">All Statuses</option>
          <option value="offer_accepted">Offer Accepted</option>
          <option value="seller_confirmed">Seller Confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="delivery">In Delivery</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Part / Spec</th>
                <th className="py-3 px-4">Buyer</th>
                <th className="py-3 px-4">Vendor Shop</th>
                <th className="py-3 px-4">Order Value</th>
                <th className="py-3 px-4">Fulfillment Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredOrders.map((o) => (
                <tr key={o.id} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-xs text-navy-900">#{o.id}</td>
                  <td className="py-3.5 px-4 text-xs">
                    <span className="font-semibold text-navy-900">{o.partName}</span>
                    <span className="text-[11px] text-text-secondary block">{o.partBrand} • Qty {o.quantity}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-xs text-navy-900">{o.clientName}</td>
                  <td className="py-3.5 px-4 font-semibold text-xs text-navy-900">{o.sellerShop}</td>
                  <td className="py-3.5 px-4 font-bold text-xs text-navy-900">
                    {formatCurrency(o.totalAmount)}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-secondary">
                    {formatDate(o.createdAt)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setInspectingOrder(o)}
                      className="px-2.5 py-1 rounded-lg border border-border text-xs font-semibold text-accent hover:bg-accent-light transition-colors"
                    >
                      Inspect Timeline
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline Inspector Modal */}
      <Modal
        isOpen={!!inspectingOrder}
        onClose={() => setInspectingOrder(null)}
        title={`Order #${inspectingOrder?.id} Lifecycle Audit`}
        maxWidth="max-w-2xl"
      >
        {inspectingOrder && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-surface-secondary border border-border grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-text-tertiary">Buyer</span>
                <p className="font-bold text-navy-900 mt-0.5">{inspectingOrder.clientName}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Seller Shop</span>
                <p className="font-bold text-navy-900 mt-0.5">{inspectingOrder.sellerShop}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Item</span>
                <p className="font-bold text-navy-900 mt-0.5">{inspectingOrder.partName} ({inspectingOrder.partBrand})</p>
              </div>
              <div>
                <span className="text-text-tertiary">Total Amount</span>
                <p className="font-extrabold text-navy-900 mt-0.5">{formatCurrency(inspectingOrder.totalAmount)}</p>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-4">
                Milestone Execution Timeline
              </h4>

              <div className="space-y-3 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {inspectingOrder.timeline.map((event) => (
                  <div key={event.status} className="relative flex items-start gap-3">
                    <div className={`absolute -left-6 mt-1 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      event.completed ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {event.completed ? <CheckCircle2 size={12} /> : <Circle size={10} />}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${event.completed ? 'text-navy-900' : 'text-text-tertiary'}`}>
                        {event.label}
                      </p>
                      <p className="text-[11px] text-text-secondary">
                        {event.date ? formatDate(event.date) : 'Stage pending execution'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HostOrders;


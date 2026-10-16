import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { SearchInput, StatusBadge } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import { CreditCard, DollarSign, ArrowUpDown, TrendingUp, ShieldCheck } from 'lucide-react';
import { loadHostTransactions } from '../../api/host';

export const HostTransactions: React.FC = () => {
  const { transactions, transactionPagination, transactionTotals } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const totalGMV = Number(transactionTotals.grossOrderValueTnd);
  const completedValue = Number(transactionTotals.completedOrderValueTnd);

  const filteredTransactions = transactions.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.id.toLowerCase().includes(q) || t.orderId.toLowerCase().includes(q) || t.clientName.toLowerCase().includes(q) || t.sellerName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Order Value Summary</h1>
        <p className="text-sm text-text-secondary">
          Order values are shown from marketplace orders. Payment processing, fees, and vendor settlements are not connected yet.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="text-xs font-semibold text-text-secondary uppercase">Gross Marketplace Order Value (GMV)</span>
          <p className="text-2xl font-extrabold text-navy-900 mt-2">{formatCurrency(totalGMV)}</p>
          <span className="text-xs text-text-secondary">Across {transactionTotals.orderCount} orders, excluding cancelled orders</span>
        </div>

        <div className="stat-card bg-green-50/50 border-green-200">
          <span className="text-xs font-semibold text-green-800 uppercase">Payment Ledger</span>
          <p className="text-2xl font-extrabold text-green-900 mt-2">Not connected</p>
          <span className="text-xs font-bold text-primary">No fee or payout records</span>
        </div>

        <div className="stat-card">
          <span className="text-xs font-semibold text-text-secondary uppercase">Completed Order Value</span>
          <p className="text-2xl font-extrabold text-navy-900 mt-2">{formatCurrency(completedValue)}</p>
          <span className="text-xs text-text-secondary">From completed orders</span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="card p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput value={search} onChange={setSearch} placeholder="Search TXN ID, Order ID, buyer..." />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); void loadHostTransactions(1, e.target.value); }}
          className="select-field !py-2 !w-auto text-xs"
        >
          <option value="all">All Statuses</option>
          <option value="offer_accepted">Offer accepted</option>
          <option value="seller_confirmed">Seller confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="ready">Ready</option>
          <option value="dispatched">Dispatched</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Ledger Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                <th className="py-3 px-4">Marketplace Order ID</th>
                <th className="py-3 px-4">Buyer</th>
                <th className="py-3 px-4">Seller</th>
                <th className="py-3 px-4">Gross Amount</th>
                <th className="py-3 px-4 text-green-800">Payment Record</th>
                <th className="py-3 px-4">Payout Record</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-surface-secondary/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-xs text-navy-900 font-mono">
                    #{t.id}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-navy-900">
                    {t.clientName}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold text-navy-900">
                    {t.sellerName}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-bold text-navy-900">
                    {formatCurrency(t.amount)}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-bold text-green-700">
                    Not connected
                  </td>
                  <td className="py-3.5 px-4 text-xs font-bold text-text-secondary">
                    Not connected
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="py-3.5 px-4 text-xs text-text-secondary">
                    {formatDate(t.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-text-secondary">
          <span>Page {transactionPagination.page} of {Math.max(1, Math.ceil(transactionPagination.total / transactionPagination.limit))} · {transactionPagination.total} orders</span>
          <div className="flex gap-2">
            <button className="btn-secondary px-3 py-1.5" disabled={transactionPagination.page <= 1} onClick={() => void loadHostTransactions(transactionPagination.page - 1)}>Previous</button>
            <button className="btn-secondary px-3 py-1.5" disabled={transactionPagination.page * transactionPagination.limit >= transactionPagination.total} onClick={() => void loadHostTransactions(transactionPagination.page + 1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HostTransactions;


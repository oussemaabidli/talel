import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { clientApiRoutes } from '../../api/client';
import { StatusBadge, SearchInput, Tabs, Modal } from '../../components/ui';
import { formatDate } from '../../utils/helpers';
import type { RequestStatus } from '../../types';
import {
  PlusCircle, Filter, ArrowUpDown, ChevronRight,
  Eye, XCircle, FileEdit, AlertTriangle
} from 'lucide-react';

export const ClientRequests: React.FC = () => {
  const navigate = useNavigate();
  const { currentClient, requests, updateRequest, clientDataLoadState, clientDataLoadErrors, addToast } = useStore();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'offers' | 'budget'>('newest');
  const [cancelModalId, setCancelModalId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonDetails, setCancelReasonDetails] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const myRequests = requests.filter(r => r.clientId === currentClient.id);

  const tabs = [
    { id: 'all', label: 'All Requests', count: myRequests.length },
    { id: 'published', label: 'Published', count: myRequests.filter(r => r.status === 'published').length },
    { id: 'offers_received', label: 'Offers Received', count: myRequests.filter(r => r.status === 'offers_received').length },
    { id: 'offer_accepted', label: 'Offer Accepted', count: myRequests.filter(r => r.status === 'offer_accepted').length },
    { id: 'in_progress', label: 'In Progress', count: myRequests.filter(r => r.status === 'in_progress').length },
    { id: 'completed', label: 'Completed', count: myRequests.filter(r => r.status === 'completed').length },
  ];

  const filteredRequests = myRequests
    .filter((req) => {
      if (activeTab !== 'all' && req.status !== activeTab) return false;
      if (search) {
        const query = search.toLowerCase();
        const matchPart = req.partName.toLowerCase().includes(query);
        const matchVehicle = `${req.vehicle.brand} ${req.vehicle.model}`.toLowerCase().includes(query);
        const matchCategory = req.category.toLowerCase().includes(query);
        const matchLocation = `${req.governorate ?? ''} ${req.location}`.toLowerCase().includes(query);
        const matchId = req.id.toLowerCase().includes(query);
        return matchPart || matchVehicle || matchCategory || matchLocation || matchId;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'offers') return b.offersCount - a.offersCount;
      if (sortBy === 'budget') return b.maxBudget - a.maxBudget;
      return 0;
    });

  const selectedRequest = myRequests.find((request) => request.id === cancelModalId);
  const needsCancelReason = selectedRequest?.status === 'offers_received';
  const handleCancelRequest = async () => {
    if (!cancelModalId || cancelling) return;
    const reason = cancelReason === 'Other' ? `Other: ${cancelReasonDetails.trim()}` : cancelReason;
    if (needsCancelReason && (!cancelReason || (cancelReason === 'Other' && !cancelReasonDetails.trim()))) return;
    setCancelling(true);
    try { const updated = await clientApiRoutes.cancelRequest(cancelModalId, reason || undefined); updateRequest(updated.id, { status: String(updated.status).toLowerCase() as any, cancellationReason: updated.cancellationReason ?? reason }); addToast('info', `Request #${cancelModalId} has been cancelled`); setCancelModalId(null); }
    catch (e) { addToast('error', e instanceof Error ? e.message : 'Request could not be cancelled.'); }
    finally { setCancelling(false); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">My Requests</h1>
          <p className="text-sm text-text-secondary">
            Manage your requested automotive parts, review inbound offers, and track statuses.
          </p>
        </div>
        <button
          onClick={() => navigate('/client/requests/new')}
          className="btn-primary shrink-0 flex items-center gap-2"
        >
          <PlusCircle size={18} /> New Part Request
        </button>
      </div>

      {/* Tabs */}
      <div className="card p-2">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="w-full sm:w-80">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by part, vehicle, or ID..."
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
            <option value="offers">Most Offers</option>
            <option value="budget">Highest Budget</option>
          </select>
        </div>
      </div>

      {/* Requests Table / Cards */}
      <div className="card overflow-hidden">
        {clientDataLoadState.requests === 'loading' ? <div className="py-16 text-center text-sm text-text-secondary">Loading requests…</div> : clientDataLoadState.requests === 'error' ? <div role="alert" className="py-16 text-center text-sm text-red-700">{clientDataLoadErrors.requests || 'Requests could not be loaded.'} <button onClick={() => window.location.reload()} className="ml-2 underline font-semibold">Retry</button></div> : filteredRequests.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-sm font-bold text-navy-900">No requests found</h3>
            <p className="text-xs text-text-secondary mt-1 max-w-xs mx-auto">
              No spare part requests matched your current tab or search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold text-text-secondary uppercase bg-surface-secondary/50">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Vehicle</th>
                  <th className="py-3 px-4">Spare Part</th>
                  <th className="py-3 px-4">Budget Range</th>
                  <th className="py-3 px-4 text-center">Inbound Offers</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-surface-secondary/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-xs text-navy-900">
                      #{req.id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-semibold text-navy-900 text-xs">
                          {req.vehicle.brand} {req.vehicle.model}
                        </p>
                        <p className="text-[11px] text-text-secondary">
                          {req.vehicle.year} • {req.vehicle.engine}
                        </p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-navy-900">{req.partName}</span>
                      <p className="text-[11px] text-text-secondary">
                        {req.category} • Qty: {req.quantity}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold text-text-primary">
                      {req.minBudget} - {req.maxBudget} TND
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => navigate(`/client/requests/${req.id}`)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-transform hover:scale-105 ${
                          req.offersCount > 0
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {req.offersCount} {req.offersCount === 1 ? 'Offer' : 'Offers'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="py-3.5 px-4 text-xs text-text-secondary">
                      {formatDate(req.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/client/requests/${req.id}`)}
                          title="View Details"
                          className="p-1.5 rounded-lg border border-border hover:bg-accent-light/50 text-accent transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        {['published', 'offers_received'].includes(req.status) && (
                          <button
                            onClick={() => { setCancelReason(''); setCancelReasonDetails(''); setCancelModalId(req.id); }}
                            title="Cancel Request"
                            className="p-1.5 rounded-lg border border-border hover:bg-red-50 text-danger transition-colors"
                          >
                            <XCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={!!cancelModalId}
        onClose={() => { if (!cancelling) setCancelModalId(null); }}
        title="Cancel Part Request"
      >
        <p className="text-sm text-text-secondary">Sellers will no longer be able to send offers on this request.</p>
        {needsCancelReason && <div className="mt-4 space-y-2"><label className="label" htmlFor="cancel-request-reason">Why are you cancelling? <span aria-hidden="true">*</span></label><select id="cancel-request-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="input-field" required><option value="">Select a reason</option><option value="No longer needed">No longer needed</option><option value="Found the part elsewhere">Found the part elsewhere</option><option value="Request details were incorrect">Request details were incorrect</option><option value="Other">Other</option></select>{cancelReason === 'Other' && <textarea aria-label="Describe another reason" value={cancelReasonDetails} onChange={(event) => setCancelReasonDetails(event.target.value)} maxLength={500} className="input-field min-h-20" placeholder="Briefly explain" required />}</div>}
        <div className="mt-6 flex justify-end gap-3"><button onClick={() => setCancelModalId(null)} disabled={cancelling} className="btn-secondary">Keep request</button><button onClick={() => void handleCancelRequest()} disabled={cancelling || (needsCancelReason && (!cancelReason || (cancelReason === 'Other' && !cancelReasonDetails.trim())))} className="btn-danger">{cancelling ? 'Cancelling…' : 'Cancel request'}</button></div>
      </Modal>
    </div>
  );
};

export default ClientRequests;


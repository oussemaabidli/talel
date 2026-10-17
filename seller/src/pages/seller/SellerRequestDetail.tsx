import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { SparePartRequest } from '../../types';
import { StatusBadge } from '../../components/ui';
import { formatDate, formatCurrency } from '../../utils/helpers';
import {
  ChevronLeft, Car, Box, MapPin, DollarSign, Send,
  Calendar, AlertCircle, FileText, ShieldAlert
} from 'lucide-react';

export const SellerRequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [request, setRequest] = useState<SparePartRequest | null>(null);
  const [myExistingOffer, setMyExistingOffer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([api.get<{ data: { id: string; partName: string; category: string; oemReference: string | null; referenceUnavailable: boolean; vehicleMake: string | null; vehicleModel: string | null; vehicleYear: number | null; condition: string; quantity: number; minBudget: string | null; maxBudget: string | null; location: string | null; deliveryMethod: string | null; description: string; status: string; createdAt: string; updatedAt: string; _count: { offers: number } } }>(`/seller/requests/${id}`), api.get<{ data: unknown[] }>(`/seller/offers?requestId=${encodeURIComponent(id)}`)])
      .then(([result, offers]) => {
        const data = result.data;
        const mapped: SparePartRequest = { id: data.id, clientId: '', clientName: 'Marketplace request', vehicle: { id: '', brand: data.vehicleMake || '', model: data.vehicleModel || '', year: data.vehicleYear || 0, engine: '' }, category: data.category, partName: data.partName, referenceNumber: data.oemReference || undefined, referenceUnavailable: data.referenceUnavailable, quantity: data.quantity, condition: data.condition.toLowerCase() as SparePartRequest['condition'], description: data.description, images: [], minBudget: Number(data.minBudget || 0), maxBudget: Number(data.maxBudget || 0), deliveryMethod: (data.deliveryMethod?.toLowerCase() || 'unknown') as SparePartRequest['deliveryMethod'], location: data.location || '', status: data.status.toLowerCase() as SparePartRequest['status'], offersCount: data._count?.offers ?? 0, createdAt: data.createdAt, updatedAt: data.updatedAt };
        setRequest(mapped); setMyExistingOffer(offers.data.some((offer) => (offer as { status: string }).status === 'PENDING')); setError('');
      }).catch((cause) => setError(cause instanceof ApiError ? cause.message : 'Unable to load the marketplace request.')).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="card p-10 text-center text-sm text-text-secondary">Loading request…</div>;

  if (!request) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle size={36} className="text-danger mx-auto mb-3" />
        <h2 className="text-lg font-bold text-navy-900">{error || 'Request Not Found'}</h2>
        <p className="text-xs text-text-secondary mt-1">This request may be unavailable or no longer accepting offers.</p>
        <button onClick={() => navigate('/seller/requests')} className="btn-secondary mt-4">
          Back to Marketplace
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/seller/requests')}
          className="text-xs font-semibold text-text-secondary hover:text-navy-900 flex items-center gap-1 mb-2 transition-colors"
        >
          <ChevronLeft size={16} /> Back to Marketplace
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-navy-900">
              Request #{request.id}
            </h1>
            <StatusBadge status={request.status} />
          </div>

          <button
            onClick={() => navigate(`/seller/requests/${request.id}/offer`)}
            disabled={myExistingOffer || !['published', 'offers_received'].includes(request.status)}
            className="btn-primary self-start sm:self-auto flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} /> {myExistingOffer ? 'Offer Already Submitted' : 'Submit Offer Quote'}
          </button>
        </div>
      </div>

      {/* Details Card */}
      <div className="card p-6 sm:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-border">
          {/* Vehicle */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-accent flex items-center justify-center shrink-0">
              <Car size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-tertiary uppercase">Vehicle Model</p>
              <p className="text-sm font-bold text-navy-900">
                {request.vehicle.brand} {request.vehicle.model} {request.vehicle.year ? `(${request.vehicle.year})` : ''}
              </p>
              <p className="text-xs text-text-secondary">{request.vehicle.engine}</p>
            </div>
          </div>

          {/* Part */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Box size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-tertiary uppercase">Required Part</p>
              <p className="text-sm font-bold text-navy-900">{request.partName}</p>
              <p className="text-xs text-text-secondary">
                Qty: {request.quantity} • Condition: <span className="capitalize font-semibold">{request.condition}</span>
              </p>
            </div>
          </div>

          {/* Budget */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-primary flex items-center justify-center shrink-0">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-tertiary uppercase">Buyer Budget</p>
              <p className="text-sm font-bold text-navy-900">
                {request.minBudget || request.maxBudget ? `${formatCurrency(request.minBudget)} - ${formatCurrency(request.maxBudget)}` : 'Not specified'}
              </p>
              <p className="text-xs text-text-secondary">{request.location} ({request.deliveryMethod === 'unknown' ? 'delivery details not specified' : request.deliveryMethod})</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
            Buyer Description & Symptoms
          </h3>
          <p className="text-sm text-text-primary leading-relaxed bg-surface-secondary p-4 rounded-xl border border-border">
            {request.description}
          </p>
          {request.referenceNumber ? (
            <p className="text-xs text-text-secondary mt-2">
              <strong className="text-navy-900">Buyer Reference / OEM Tag:</strong> {request.referenceNumber}
            </p>
          ) : request.referenceUnavailable ? <p className="text-xs text-text-secondary mt-2"><strong className="text-navy-900">Buyer Reference / OEM Tag:</strong> Client does not have one</p> : null}
        </div>

        {/* Compliance notice */}
        <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Automotive Parts Marketplace Policy</p>
            <p className="text-amber-800 mt-0.5">
              Quote details should clearly state warranty duration and OEM/aftermarket brand. Marketplace messages reject contact details; payment processing and seller payment protection are not available.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerRequestDetail;


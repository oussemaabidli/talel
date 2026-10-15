import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { StatusBadge, Rating, VerifiedBadge, Avatar, EmptyState } from '../../components/ui';
import { formatDate, formatCurrency } from '../../utils/helpers';
import {
  ChevronLeft, Car, Calendar, MapPin, Tag, ShieldCheck,
  Truck, ArrowRight, Clock, MessageSquare, AlertCircle, Box
} from 'lucide-react';

export const ClientRequestDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { requests, offers } = useStore();

  const request = requests.find((r) => r.id === id);
  const requestOffers = offers.filter((o) => o.requestId === id);

  if (!request) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle size={36} className="text-danger mx-auto mb-3" />
        <h2 className="text-lg font-bold text-navy-900">Request Not Found</h2>
        <p className="text-xs text-text-secondary mt-1">This spare part request does not exist or was removed.</p>
        <button onClick={() => navigate('/client/requests')} className="btn-secondary mt-4">
          Back to Requests
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/client/requests')}
          className="text-xs font-semibold text-text-secondary hover:text-navy-900 flex items-center gap-1 mb-2 transition-colors"
        >
          <ChevronLeft size={16} /> Back to Requests
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-navy-900">
              Request #{request.id}
            </h1>
            <StatusBadge status={request.status} />
          </div>
          <span className="text-xs text-text-secondary flex items-center gap-1">
            <Calendar size={14} /> Created {formatDate(request.createdAt)}
          </span>
        </div>
      </div>

      {/* Main Request Details Card */}
      <div className="card p-6 sm:p-8 space-y-6">
        {/* Top Info Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-6 border-b border-border">
          {/* Vehicle info */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-accent flex items-center justify-center shrink-0">
              <Car size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-tertiary uppercase">Target Vehicle</p>
              <p className="text-sm font-bold text-navy-900">
                {request.vehicle.brand} {request.vehicle.model} ({request.vehicle.year})
              </p>
              <p className="text-xs text-text-secondary">{request.vehicle.engine}</p>
            </div>
          </div>

          {/* Part info */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Box size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-tertiary uppercase">Requested Part</p>
              <p className="text-sm font-bold text-navy-900">{request.partName}</p>
              <p className="text-xs text-text-secondary">
                {request.category} • Condition: <span className="capitalize font-semibold">{request.condition}</span>
              </p>
            </div>
          </div>

          {/* Budget & Location */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 text-primary flex items-center justify-center shrink-0">
              <MapPin size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-text-tertiary uppercase">Budget & Region</p>
              <p className="text-sm font-bold text-navy-900">{request.minBudget} - {request.maxBudget} DA</p>
              <p className="text-xs text-text-secondary">
                {request.location} • Qty: {request.quantity} ({request.deliveryMethod})
              </p>
            </div>
          </div>
        </div>

        {/* Description & Reference */}
        <div>
          <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
            Description & Notes
          </h3>
          <p className="text-sm text-text-primary leading-relaxed bg-surface-secondary p-4 rounded-xl border border-border">
            {request.description}
          </p>
          {request.referenceNumber && (
            <p className="text-xs text-text-secondary mt-2">
              <span className="font-semibold text-navy-900">Reference / OEM:</span> {request.referenceNumber}
            </p>
          )}
          {request.additionalRequirements && (
            <p className="text-xs text-text-secondary mt-1">
              <span className="font-semibold text-navy-900">Special Notes:</span> {request.additionalRequirements}
            </p>
          )}
        </div>
      </div>

      {/* Received Offers Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-navy-900">
              Received Inbound Offers ({requestOffers.length})
            </h2>
            <p className="text-xs text-text-secondary">
              Review quotes from verified auto-parts suppliers. Transactions and guarantees are protected on platform.
            </p>
          </div>
        </div>

        {requestOffers.length === 0 ? (
          <div className="card p-12 text-center">
            <Clock size={36} className="text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-navy-900">Waiting for Supplier Offers</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mt-1">
              Suppliers in our marketplace network have been notified about your request. You will receive competitive quotes soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requestOffers.map((offer) => (
              <div
                key={offer.id}
                className="card p-5 hover:shadow-md transition-all flex flex-col justify-between border-slate-200 group"
              >
                <div>
                  {/* Seller Header */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={offer.sellerShop} size="sm" />
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold text-navy-900">{offer.sellerShop}</p>
                          {offer.sellerVerified && <VerifiedBadge />}
                        </div>
                        <Rating rating={offer.sellerRating} reviews={offer.sellerReviews} size={12} />
                      </div>
                    </div>
                    <StatusBadge status={offer.status} />
                  </div>

                  {/* Part Details */}
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <h4 className="text-sm font-bold text-navy-900">{offer.partName}</h4>
                      <span className="text-base font-extrabold text-navy-900">
                        {formatCurrency(offer.price)}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary pt-1">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium">
                        Brand: {offer.partBrand}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium capitalize">
                        {offer.condition}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-green-50 text-green-700 font-medium">
                        Warranty: {offer.warranty}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium">
                        {offer.availability}
                      </span>
                    </div>

                    <p className="text-xs text-text-secondary line-clamp-2 mt-2">
                      {offer.description}
                    </p>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                  <div className="text-[11px] text-text-tertiary flex items-center gap-1">
                    <Truck size={13} />
                    <span>Delivery: {offer.deliveryCost === 0 ? 'Free' : `${offer.deliveryCost} DA`} ({offer.deliveryTime})</span>
                  </div>

                  <button
                    onClick={() => navigate(`/client/offers/${offer.id}`)}
                    className="btn-accent text-xs py-2 px-3.5"
                  >
                    View Offer <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientRequestDetail;


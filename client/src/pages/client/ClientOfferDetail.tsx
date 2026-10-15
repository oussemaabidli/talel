import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { clientApiRoutes } from '../../api/client';
import { StatusBadge, Rating, VerifiedBadge, Avatar, ConfirmModal, Modal } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import {
  ChevronLeft, CheckCircle2, XCircle, MessageSquare, ShieldCheck,
  Truck, Clock, Tag, Box, Car, AlertCircle, HelpCircle, Send
} from 'lucide-react';

export const ClientOfferDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { offers, requests, addToast } = useStore();

  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [messageText, setMessageText] = useState('');

  const offer = offers.find((o) => o.id === id);
  const parentRequest = requests.find((r) => r.id === offer?.requestId);

  if (!offer) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle size={36} className="text-danger mx-auto mb-3" />
        <h2 className="text-lg font-bold text-navy-900">Offer Not Found</h2>
        <p className="text-xs text-text-secondary mt-1">This offer does not exist or was expired.</p>
        <button onClick={() => navigate('/client/offers')} className="btn-secondary mt-4">
          Back to Offers
        </button>
      </div>
    );
  }

  const handleConfirmAccept = async () => {
    try { await clientApiRoutes.acceptOffer(offer.id); addToast('success', 'Offer accepted. The order is ready to track.'); window.location.assign('/client/orders'); }
    catch (e) { addToast('error', e instanceof Error ? e.message : 'Could not accept this offer.'); setIsAcceptModalOpen(false); }
  };

  const handleConfirmReject = async () => {
    try { await clientApiRoutes.rejectOffer(offer.id); addToast('info', 'Offer rejected.'); window.location.reload(); }
    catch (e) { addToast('error', e instanceof Error ? e.message : 'Could not reject this offer.'); setIsRejectModalOpen(false); }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    try {
      const conversation = await clientApiRoutes.offerConversation(offer.id);
      await clientApiRoutes.sendMessage(conversation.id, messageText.trim());
      addToast('success', 'Message sent to seller.'); setMessageText(''); setIsMessageModalOpen(false); window.location.assign('/client/messages');
    } catch (e) { addToast('error', e instanceof Error ? e.message : 'Message could not be sent.'); }
  };

  const totalAmount = offer.price + offer.deliveryCost;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/client/offers')}
          className="text-xs font-semibold text-text-secondary hover:text-navy-900 flex items-center gap-1 mb-2 transition-colors"
        >
          <ChevronLeft size={16} /> Back to Offers
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-navy-900">
              Offer #{offer.id}
            </h1>
            <StatusBadge status={offer.status} />
          </div>
          <span className="text-xs text-text-secondary">
            Received {formatDate(offer.createdAt)}
          </span>
        </div>
      </div>

      {/* Main Grid: Offer Details & Price Checkout Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Offer details & Seller info */}
        <div className="lg:col-span-8 space-y-6">
          {/* Supplier Card */}
          <div className="card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar name={offer.sellerShop} size="lg" />
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-bold text-navy-900">{offer.sellerShop}</h2>
                  {offer.sellerVerified && <VerifiedBadge />}
                </div>
                <Rating rating={offer.sellerRating} reviews={offer.sellerReviews} size={14} />
                <p className="text-xs text-text-secondary mt-1">Verified Marketplace Supplier</p>
              </div>
            </div>

            <button
              onClick={() => setIsMessageModalOpen(true)}
              className="px-3.5 py-2 border border-border rounded-xl text-xs font-semibold text-navy-900 hover:bg-surface-secondary flex items-center gap-2 self-start sm:self-auto transition-colors"
            >
              <MessageSquare size={15} className="text-accent" /> Message about Part
            </button>
          </div>

          {/* Part Specifications */}
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider pb-2 border-b border-border">
              Part Specifications
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-text-tertiary">Part Name</span>
                <p className="font-bold text-navy-900 mt-0.5">{offer.partName}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Brand</span>
                <p className="font-bold text-navy-900 mt-0.5">{offer.partBrand}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Reference Number</span>
                <p className="font-bold text-navy-900 mt-0.5">{offer.referenceNumber || 'OEM Standard'}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Condition</span>
                <p className="font-bold text-navy-900 mt-0.5 capitalize">{offer.condition}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Warranty</span>
                <p className="font-bold text-green-700 mt-0.5">{offer.warranty}</p>
              </div>
              <div>
                <span className="text-text-tertiary">Stock Status</span>
                <p className="font-bold text-accent mt-0.5">{offer.availability}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-border">
              <span className="text-xs font-semibold text-text-tertiary">Seller Description & Warranty Notes</span>
              <p className="text-xs text-text-primary mt-1.5 leading-relaxed bg-surface-secondary p-3.5 rounded-xl border border-border">
                {offer.description}
              </p>
            </div>
          </div>

          {/* Target Vehicle Reference */}
          {parentRequest && (
            <div className="card p-5 bg-slate-50 border-slate-200">
              <div className="flex items-center gap-2 text-xs font-bold text-navy-900 mb-2">
                <Car size={16} className="text-accent" />
                Target Vehicle Context
              </div>
              <p className="text-xs text-text-secondary">
                This quote was provided in response to your request for{' '}
                <span className="font-semibold text-navy-900">
                  {parentRequest.vehicle.brand} {parentRequest.vehicle.model} ({parentRequest.vehicle.year}) - {parentRequest.vehicle.engine}
                </span>.
              </p>
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Pricing Breakdown & Action Buttons */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card p-6 border-slate-300 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-navy-900">Price Breakdown</h3>

            <div className="space-y-2.5 text-xs pb-4 border-b border-border">
              <div className="flex justify-between text-text-secondary">
                <span>Part Price (Qty {offer.quantity}):</span>
                <span className="font-bold text-navy-900">{formatCurrency(offer.price)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Delivery ({offer.deliveryTime}):</span>
                <span className="font-bold text-navy-900">
                  {offer.deliveryCost === 0 ? 'Free' : formatCurrency(offer.deliveryCost)}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Platform payment protection:</span>
                <span className="font-semibold text-slate-600">Not enabled</span>
              </div>
            </div>

            <div className="flex justify-between items-baseline pt-1">
              <span className="text-sm font-bold text-navy-900">Total Amount:</span>
              <span className="text-2xl font-extrabold text-navy-900">
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {/* Actions */}
            {offer.status === 'pending' ? (
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={() => setIsAcceptModalOpen(true)}
                  className="w-full btn-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow"
                >
                  <CheckCircle2 size={18} /> Accept Offer & Order
                </button>

                <button
                  onClick={() => setIsRejectModalOpen(true)}
                  className="w-full btn-secondary text-xs py-2.5 text-danger hover:bg-red-50 flex items-center justify-center gap-1.5"
                >
                  <XCircle size={15} /> Reject Offer
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-surface-secondary text-center">
                <p className="text-xs font-bold capitalize text-navy-900">
                  This offer is {offer.status}
                </p>
              </div>
            )}

            {/* Protection Notice */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
              <ShieldCheck size={16} className="text-accent shrink-0 mt-0.5" />
              <span>
                Funds and order fulfillment are tracked through the AutoParts Pro platform warranty system.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Accept Confirmation Modal */}
      <ConfirmModal
        isOpen={isAcceptModalOpen}
        onClose={() => setIsAcceptModalOpen(false)}
        onConfirm={handleConfirmAccept}
        title="Confirm Offer Acceptance"
        message={`Are you sure you want to accept this offer from ${offer.sellerShop} for ${formatCurrency(totalAmount)}? This will convert the offer into an active order.`}
        confirmText="Confirm & Create Order"
        variant="primary"
      />

      {/* Reject Confirmation Modal */}
      <ConfirmModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleConfirmReject}
        title="Reject Supplier Offer"
        message="Are you sure you want to reject this quote? The seller will be notified."
        confirmText="Reject Offer"
        variant="danger"
      />

      {/* Contextual Messaging Modal */}
      <Modal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        title={`Inquire about Offer #${offer.id}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            Send a contextual technical inquiry to <span className="font-bold text-navy-900">{offer.sellerShop}</span> regarding part compatibility or delivery schedule.
          </p>
          <textarea
            rows={4}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="e.g. Can you confirm if this matches the 2.5L engine specification?"
            className="input-field resize-none text-xs"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsMessageModalOpen(false)} className="btn-secondary text-xs">
              Cancel
            </button>
            <button onClick={handleSendMessage} className="btn-accent text-xs flex items-center gap-1.5">
              <Send size={14} /> Send Inquiry
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientOfferDetail;


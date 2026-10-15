import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import type { PartCondition, DeliveryMethod, SparePartRequest } from '../../types';
import { api, ApiError } from '../../api/client';
import { formatCurrency } from '../../utils/helpers';
import {
  ChevronLeft, Send, DollarSign, ShieldCheck, Truck,
  Tag, Box, CheckCircle2, AlertCircle, Wrench
} from 'lucide-react';

export const SellerCreateOffer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addToast = useStore((state) => state.addToast);
  const [request, setRequest] = useState<SparePartRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [partName, setPartName] = useState('');
  const [partBrand, setPartBrand] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [condition, setCondition] = useState<PartCondition | ''>('');
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [availability, setAvailability] = useState('');
  const [warranty, setWarranty] = useState('');
  const [deliveryCost, setDeliveryCost] = useState<number>(0);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<{ data: { id: string; partName: string; category: string; oemReference: string | null; vehicleMake: string | null; vehicleModel: string | null; vehicleYear: number | null; condition: string; quantity: number; minBudget: string | null; maxBudget: string | null; location: string | null; deliveryMethod: string | null; description: string; status: string; createdAt: string; updatedAt: string; _count: { offers: number } } }>(`/seller/requests/${id}`)
      .then(({ data }) => {
        const mapped: SparePartRequest = { id: data.id, clientId: '', clientName: 'Marketplace request', vehicle: { id: '', brand: data.vehicleMake || '', model: data.vehicleModel || '', year: data.vehicleYear || 0, engine: '' }, category: data.category, partName: data.partName, referenceNumber: data.oemReference || undefined, quantity: data.quantity, condition: data.condition.toLowerCase() as SparePartRequest['condition'], description: data.description, images: [], minBudget: Number(data.minBudget || 0), maxBudget: Number(data.maxBudget || 0), deliveryMethod: (data.deliveryMethod?.toLowerCase() || 'unknown') as DeliveryMethod, location: data.location || '', status: data.status.toLowerCase() as SparePartRequest['status'], offersCount: data._count?.offers ?? 0, createdAt: data.createdAt, updatedAt: data.updatedAt };
        setRequest(mapped); setPartName(mapped.partName); setReferenceNumber(mapped.referenceNumber || ''); setQuantity(mapped.quantity);
      }).catch((error) => setLoadError(error instanceof ApiError ? error.message : 'Unable to load the marketplace request.')).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="card p-10 text-center text-sm text-text-secondary">Loading request…</div>;
  if (!request) {
    return (
      <div className="card p-12 text-center max-w-lg mx-auto my-12">
        <AlertCircle size={36} className="text-danger mx-auto mb-3" />
        <h2 className="text-lg font-bold text-navy-900">{loadError || 'Request Not Found'}</h2>
        <button onClick={() => navigate('/seller/requests')} className="btn-secondary mt-4">
          Back to Marketplace
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!partName.trim() || !condition || price <= 0) {
      addToast('error', 'Please specify the actual part condition and a valid quote price.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/seller/offers', { requestId: request.id, partName: partName.trim(), brand: partBrand.trim(), referenceNumber: referenceNumber.trim(), condition: condition.toUpperCase(), price, quantity, warranty, deliveryFee: deliveryCost, estimatedDelivery: [availability, deliveryTime].filter(Boolean).join(' · '), description: description.trim() });
      addToast('success', 'Offer submitted successfully.');
      navigate('/seller/offers');
    } catch (error) { addToast('error', error instanceof ApiError ? error.message : 'Could not submit the offer.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate(`/seller/requests/${request.id}`)}
          className="text-xs font-semibold text-text-secondary hover:text-navy-900 flex items-center gap-1 mb-2 transition-colors"
        >
          <ChevronLeft size={16} /> Back to Request #{request.id}
        </button>
        <h1 className="text-2xl font-extrabold text-navy-900">
          Submit Quote for {request.partName}
        </h1>
        <p className="text-sm text-text-secondary">
          For {request.vehicle.brand} {request.vehicle.model} {request.vehicle.year ? `(${request.vehicle.year})` : ''} • Buyer Budget: {request.minBudget || request.maxBudget ? `${formatCurrency(request.minBudget)} - ${formatCurrency(request.maxBudget)}` : 'Not specified'}
        </p>
      </div>

      {/* Offer Form */}
      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-6">
        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider pb-2 border-b border-border">
          Part Specifications
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Part Name *</label>
            <input
              type="text"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="label">Part Brand / Manufacturer *</label>
            <input
              type="text"
              placeholder="e.g. Bosch, Brembo, Valeo, OEM"
              value={partBrand}
              onChange={(e) => setPartBrand(e.target.value)}
              className="input-field"
              required
            />
          </div>

          <div>
            <label className="label">Reference / Part Number</label>
            <input
              type="text"
              placeholder="e.g. BP-3211-F"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as PartCondition | '')}
              className="select-field"
              required
            >
              <option value="" disabled>Choose actual condition</option>
              <option value="new">Brand New</option>
              <option value="used">Used / Tested Working</option>
            </select>
          </div>
        </div>

        <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider pt-4 pb-2 border-b border-border">
          Pricing & Commercial Terms
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Price per Unit (TND) *</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className="input-field font-bold text-navy-900"
              required
            />
          </div>

          <div>
            <label className="label">Quantity Offered</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Stock Availability</label>
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="select-field"
              required
            >
              <option value="" disabled>Choose availability</option>
              <option value="In Stock">In Stock (Immediate)</option>
              <option value="1-2 Days">1-2 Days</option>
              <option value="3-5 Days">3-5 Days (Backorder)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Warranty Duration</label>
            <select
              value={warranty}
              onChange={(e) => setWarranty(e.target.value)}
              className="select-field"
              required
            >
              <option value="" disabled>Choose warranty</option>
              <option value="3 months">3 Months</option>
              <option value="6 months">6 Months</option>
              <option value="12 months">12 Months (1 Year)</option>
              <option value="24 months">24 Months (2 Years)</option>
              <option value="36 months">36 Months</option>
              <option value="None">No Warranty</option>
            </select>
          </div>

          <div>
            <label className="label">Delivery Fee (TND)</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={deliveryCost}
              onChange={(e) => setDeliveryCost(parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">Delivery Speed</label>
            <input
              type="text"
              placeholder="e.g. 1-2 business days"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        <div>
          <label className="label">Description & Fitment Notes</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-field resize-none text-xs"
          />
        </div>

        {/* Total calculation preview */}
        <div className="p-4 rounded-xl bg-surface-secondary border border-border flex items-center justify-between">
          <div>
            <span className="text-xs text-text-secondary">Total Quote to Buyer:</span>
            <p className="text-xl font-extrabold text-navy-900">
              {formatCurrency(price * quantity + deliveryCost)}
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary py-3 px-6 rounded-xl font-bold flex items-center gap-2 shadow disabled:opacity-60"
          >
            <Send size={16} /> {busy ? 'Submitting…' : 'Send Offer Now'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SellerCreateOffer;


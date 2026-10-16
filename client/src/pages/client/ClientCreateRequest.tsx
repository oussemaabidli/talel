import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { clientApiRoutes } from '../../api/client';
import { vehicleBrands, vehicleModels } from '../../data/mockData';
import type { Vehicle, PartCondition, DeliveryMethod } from '../../types';
import {
  Car, Wrench, FileText, DollarSign, CheckCircle2,
  ChevronLeft, ChevronRight, Upload, Plus, Check
} from 'lucide-react';

export const ClientCreateRequest: React.FC = () => {
  const navigate = useNavigate();
  const { currentClient, addRequest, addToast } = useStore();

  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(currentClient.savedVehicles[0] || null);
  const [customVehicle, setCustomVehicle] = useState<Vehicle>({
    id: `v-custom-${Date.now()}`,
    brand: 'Toyota',
    model: 'Camry',
    year: 2021,
    engine: '2.5L 4-Cylinder',
  });
  const [isUsingCustomVehicle, setIsUsingCustomVehicle] = useState(false);

  // Step 2: Part
  const [category, setCategory] = useState<string>('');
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [partName, setPartName] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [condition, setCondition] = useState<PartCondition>('new');

  // Step 3: Details
  const [description, setDescription] = useState<string>('');
  const [additionalRequirements, setAdditionalRequirements] = useState<string>('');

  // Step 4: Budget & Delivery
  const [minBudget, setMinBudget] = useState<number>(2000);
  const [maxBudget, setMaxBudget] = useState<number>(6000);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
  const [location, setLocation] = useState<string>(currentClient.city || 'Algiers');

  useEffect(() => { clientApiRoutes.categories().then(setCategories).catch((e) => addToast('error', e instanceof Error ? e.message : 'Could not load categories.')); }, [addToast]);

  // Available models based on selected brand
  const activeBrand = isUsingCustomVehicle ? customVehicle.brand : selectedVehicle?.brand || 'Toyota';
  const modelsForBrand = vehicleModels[activeBrand] || ['Standard'];

  const handlePublish = async () => {
    const finalVehicle = isUsingCustomVehicle ? customVehicle : selectedVehicle;

    if (!finalVehicle || !partName.trim()) {
      addToast('error', 'Please complete the vehicle and spare part details');
      return;
    }

    try {
      const saved = await clientApiRoutes.createRequest({ partName: partName.trim(), category, oemReference: referenceNumber.trim() || undefined, vehicleMake: finalVehicle.brand, vehicleModel: finalVehicle.model, vehicleYear: finalVehicle.year, condition: condition.toUpperCase(), quantity, description: [description.trim(), additionalRequirements.trim()].filter(Boolean).join('\n\nAdditional requirements: '), minBudget, maxBudget, deliveryMethod, location: location.trim() || currentClient.city || undefined });
      addRequest({ id: saved.id, clientId: currentClient.id, clientName: currentClient.name, vehicle: finalVehicle, category: saved.category, partName: saved.partName, referenceNumber: saved.oemReference, quantity: saved.quantity, condition: String(saved.condition).toLowerCase() as PartCondition, description: saved.description, images: [], minBudget: Number(saved.minBudget ?? 0), maxBudget: Number(saved.maxBudget ?? 0), deliveryMethod: (saved.deliveryMethod ?? deliveryMethod) as DeliveryMethod, location: saved.location ?? '', status: String(saved.status).toLowerCase() as any, offersCount: saved._count?.offers ?? 0, createdAt: saved.createdAt, updatedAt: saved.updatedAt });
      addToast('success', 'Request published successfully.'); navigate('/client/requests');
    } catch (e) { addToast('error', e instanceof Error ? e.message : 'Request could not be published.'); }
  };

  const steps = [
    { num: 1, label: 'Vehicle', icon: Car },
    { num: 2, label: 'Spare Part', icon: Wrench },
    { num: 3, label: 'Details', icon: FileText },
    { num: 4, label: 'Budget & Delivery', icon: DollarSign },
    { num: 5, label: 'Review', icon: CheckCircle2 },
  ];

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Page Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/client/dashboard')}
          className="text-xs font-semibold text-text-secondary hover:text-navy-900 flex items-center gap-1 mb-2 transition-colors"
        >
          <ChevronLeft size={16} /> Back to Dashboard
        </button>
        <h1 className="text-2xl font-extrabold text-navy-900">Request a Spare Part</h1>
        <p className="text-sm text-text-secondary">
          Broadcast your part requirement directly to verified suppliers across the platform.
        </p>
      </div>

      {/* Stepper Bar */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-6 right-6 -translate-y-1/2 h-0.5 bg-border -z-0" />
          {steps.map((s) => {
            const Icon = s.icon;
            const isDone = currentStep > s.num;
            const isCurrent = currentStep === s.num;

            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <button
                  onClick={() => s.num < currentStep && setCurrentStep(s.num)}
                  disabled={s.num > currentStep}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    isDone
                      ? 'bg-primary text-white shadow'
                      : isCurrent
                      ? 'bg-accent text-white ring-4 ring-accent/20 shadow-md'
                      : 'bg-white border-2 border-border text-text-tertiary'
                  }`}
                >
                  {isDone ? <Check size={16} /> : <Icon size={16} />}
                </button>
                <span className={`text-[11px] mt-1.5 font-medium hidden sm:block ${
                  isCurrent ? 'text-accent font-bold' : isDone ? 'text-navy-900' : 'text-text-tertiary'
                }`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Form Container */}
      <div className="card p-6 sm:p-8">
        {/* STEP 1: VEHICLE */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-navy-900">Step 1: Select or Specify Your Vehicle</h2>
              <p className="text-xs text-text-secondary mt-1">
                Choose from your saved garage or configure a vehicle for this request.
              </p>
            </div>

            {/* Saved Vehicles Selection */}
            {currentClient.savedVehicles.length > 0 && (
              <div>
                <label className="label">Select from Saved Vehicles</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {currentClient.savedVehicles.map((v) => (
                    <div
                      key={v.id}
                      onClick={() => {
                        setSelectedVehicle(v);
                        setIsUsingCustomVehicle(false);
                      }}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        !isUsingCustomVehicle && selectedVehicle?.id === v.id
                          ? 'border-accent bg-accent-light/20 shadow-sm'
                          : 'border-border hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-navy-900">{v.brand} {v.model}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700">{v.year}</span>
                      </div>
                      <p className="text-xs text-text-secondary mt-1">{v.engine}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Custom vehicle toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsUsingCustomVehicle(!isUsingCustomVehicle)}
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1.5"
              >
                {isUsingCustomVehicle ? '← Use Saved Vehicle Instead' : '+ Enter A Different Vehicle Manually'}
              </button>
            </div>

            {/* Manual Vehicle Entry if selected */}
            {isUsingCustomVehicle && (
              <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-4">
                <p className="text-xs font-bold text-navy-900 uppercase">Manual Vehicle Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Brand</label>
                    <select
                      value={customVehicle.brand}
                      onChange={(e) => setCustomVehicle({ ...customVehicle, brand: e.target.value, model: vehicleModels[e.target.value]?.[0] || 'Standard' })}
                      className="select-field"
                    >
                      {vehicleBrands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Model</label>
                    <select
                      value={customVehicle.model}
                      onChange={(e) => setCustomVehicle({ ...customVehicle, model: e.target.value })}
                      className="select-field"
                    >
                      {modelsForBrand.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Year</label>
                    <input
                      type="number"
                      min="1990"
                      max="2026"
                      value={customVehicle.year}
                      onChange={(e) => setCustomVehicle({ ...customVehicle, year: parseInt(e.target.value) || 2020 })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label">Engine / Version</label>
                    <input
                      type="text"
                      placeholder="e.g. 2.0L Turbo Diesel"
                      value={customVehicle.engine}
                      onChange={(e) => setCustomVehicle({ ...customVehicle, engine: e.target.value })}
                      className="input-field"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: SPARE PART */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-navy-900">Step 2: Spare Part Information</h2>
              <p className="text-xs text-text-secondary mt-1">Specify what part you need so sellers can quote accurately.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Category *</label>
                <input
                  list="client-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                  placeholder="Choose or enter a category"
                  required
                />
                <datalist id="client-categories">{categories.map((c) => <option key={c.id} value={c.name} />)}</datalist>
              </div>

              <div>
                <label className="label">Part Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Front Brake Pads, Alternator, Oil Filter"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="label">OEM / Reference Number (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 04465-06200, FL-500S"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Quantity</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="label">Condition Required</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'new', label: 'New Only' },
                  { id: 'used', label: 'Used / Secondhand' },
                  { id: 'either', label: 'Either (New or Used)' },
                ].map((cond) => (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => setCondition(cond.id as PartCondition)}
                    className={`py-3 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      condition === cond.id
                        ? 'border-accent bg-accent-light/20 text-accent font-bold'
                        : 'border-border text-text-secondary hover:border-slate-300'
                    }`}
                  >
                    {cond.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DETAILS & IMAGES */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-navy-900">Step 3: Description & Photos</h2>
              <p className="text-xs text-text-secondary mt-1">Provide clear specifications and attach photos of the broken part or vehicle label.</p>
            </div>

            <div>
              <label className="label">Description / Symptoms</label>
              <textarea
                rows={4}
                placeholder="Explain the specific issue, sub-model compatibility, or what you're looking for..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field resize-none"
              />
            </div>

            <div>
              <label className="label">Reference Images</label>
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:bg-slate-50 transition-colors">
                <Upload size={28} className="mx-auto text-text-tertiary mb-2" />
                <p className="text-xs font-semibold text-navy-900">Reference image uploads are not configured yet.</p>
                <p className="text-[11px] text-text-secondary mt-1">Your request can still be published with a written description.</p>
                <p className="mt-3 text-xs text-text-secondary">Image uploads will be available when secure request-image storage is configured.</p>
              </div>
            </div>

            <div>
              <label className="label">Additional Requirements (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Must include mounting hardware, ceramic compound only, etc."
                value={additionalRequirements}
                onChange={(e) => setAdditionalRequirements(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        )}

        {/* STEP 4: BUDGET & DELIVERY */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-navy-900">Step 4: Budget & Delivery</h2>
              <p className="text-xs text-text-secondary mt-1">Indicate your target budget range and preferred fulfillment mode.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Minimum Budget (DZD)</label>
                <input
                  type="number"
                  step="500"
                  value={minBudget}
                  onChange={(e) => setMinBudget(parseInt(e.target.value) || 0)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Maximum Budget (DZD)</label>
                <input
                  type="number"
                  step="500"
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(parseInt(e.target.value) || 0)}
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="label">Fulfillment Method</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'delivery', label: 'Delivery to Door' },
                  { id: 'pickup', label: 'In-Store Pickup' },
                  { id: 'both', label: 'Either is Fine' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setDeliveryMethod(mode.id as DeliveryMethod)}
                    className={`py-3 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                      deliveryMethod === mode.id
                        ? 'border-accent bg-accent-light/20 text-accent font-bold'
                        : 'border-border text-text-secondary hover:border-slate-300'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Your City / Location</label>
              <input
                type="text"
                placeholder="e.g. Algiers, Oran, Constantine"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        )}

        {/* STEP 5: REVIEW */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-navy-900">Step 5: Review & Confirm</h2>
              <p className="text-xs text-text-secondary mt-1">Verify all request details before broadcasting to sellers.</p>
            </div>

            <div className="bg-surface-secondary rounded-xl p-5 border border-border space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-border">
                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold">Vehicle</span>
                  <p className="text-sm font-bold text-navy-900">
                    {(isUsingCustomVehicle ? customVehicle : selectedVehicle)?.brand}{' '}
                    {(isUsingCustomVehicle ? customVehicle : selectedVehicle)?.model}{' '}
                    ({(isUsingCustomVehicle ? customVehicle : selectedVehicle)?.year})
                  </p>
                  <p className="text-xs text-text-secondary">{(isUsingCustomVehicle ? customVehicle : selectedVehicle)?.engine}</p>
                </div>

                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold">Spare Part</span>
                  <p className="text-sm font-bold text-navy-900">{partName || 'Not specified'}</p>
                  <p className="text-xs text-text-secondary">{category} • Qty: {quantity}</p>
                </div>

                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold">Condition</span>
                  <p className="text-sm font-bold text-navy-900 capitalize">{condition}</p>
                  <p className="text-xs text-text-secondary">Ref: {referenceNumber || 'None'}</p>
                </div>

                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold">Budget Range</span>
                  <p className="text-sm font-bold text-navy-900">{minBudget} - {maxBudget} DA</p>
                  <p className="text-xs text-text-secondary">{deliveryMethod} in {location}</p>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-text-tertiary uppercase font-semibold">Description</span>
                <p className="text-xs text-text-secondary mt-1">{description || 'No additional description provided.'}</p>
              </div>

              {additionalRequirements && (
                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold">Special Requirements</span>
                  <p className="text-xs text-text-secondary mt-1">{additionalRequirements}</p>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5">
              <span className="text-base">ℹ️</span>
              <div>
                <p className="font-bold">Transaction Integrity Rule</p>
                <p className="text-blue-800 mt-0.5">
                  Offers will be received directly inside your portal. Direct contact outside the platform is restricted to protect your guarantee.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="btn-secondary"
            >
              <ChevronLeft size={16} /> Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 2 && !partName.trim()) {
                    addToast('error', 'Please enter the spare part name');
                    return;
                  }
                  setCurrentStep(currentStep + 1);
                }}
                className="btn-accent"
              >
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handlePublish()}
                className="btn-primary px-6"
              >
                <CheckCircle2 size={16} /> Publish Request
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientCreateRequest;


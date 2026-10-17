import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { clientApiRoutes } from '../../api/client';
import type { Vehicle, PartCondition, DeliveryMethod } from '../../types';
import {
  Car, Wrench, FileText, DollarSign, CheckCircle2,
  ChevronLeft, ChevronRight, Upload, Plus, Check, Camera, X
} from 'lucide-react';

export const ClientCreateRequest: React.FC = () => {
  const navigate = useNavigate();
  const { currentClient, addRequest, addToast } = useStore();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const submissionKey = useRef(crypto.randomUUID());
  const [isPublishing, setIsPublishing] = useState(false);

  // Form State
  const [customVehicle, setCustomVehicle] = useState<Vehicle>({
    id: `v-custom-${Date.now()}`,
    brand: '',
    model: '',
    year: 0,
    engine: '',
  });

  // Step 2: Part
  const [category, setCategory] = useState<string>('');
  const [partName, setPartName] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [referenceUnavailable, setReferenceUnavailable] = useState(false);
  const [quantity, setQuantity] = useState<number>(1);
  const [condition, setCondition] = useState<PartCondition>('new');

  // Step 3: Details
  const [description, setDescription] = useState<string>('');
  const [additionalRequirements, setAdditionalRequirements] = useState<string>('');
  const [requestPhotos, setRequestPhotos] = useState<Array<{ id: string; originalName: string; previewUrl: string }>>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  // Step 4: Budget & Delivery
  const [minBudget, setMinBudget] = useState<number>(2000);
  const [maxBudget, setMaxBudget] = useState<number>(6000);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('delivery');
  const [location, setLocation] = useState<string>(currentClient.city || '');
  const [governorate, setGovernorate] = useState('');
  const [governorates, setGovernorates] = useState<string[]>([]);

  useEffect(() => { clientApiRoutes.governorates().then(setGovernorates).catch((e) => addToast('error', e instanceof Error ? e.message : 'Could not load Tunisian governorates.')); }, [addToast]);

  const handlePhotoSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    if (files.length > 5 - requestPhotos.length) {
      addToast('error', 'A request can include up to five photos.');
      return;
    }
    setIsUploadingPhotos(true);
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          addToast('error', `${file.name}: use a JPEG, PNG, or WebP photo.`);
          continue;
        }
        if (file.size === 0 || file.size > 5 * 1024 * 1024) {
          addToast('error', `${file.name}: each photo must be smaller than 5 MB.`);
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        try {
          const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
            image.onerror = () => reject(new Error('This image could not be opened. Choose a valid photo file.'));
            image.src = previewUrl;
          });
          if (!dimensions.width || !dimensions.height || dimensions.width > 10000 || dimensions.height > 10000 || dimensions.width * dimensions.height > 40000000) {
            throw new Error('This photo has unsupported dimensions. Choose an image up to 40 megapixels.');
          }
          const uploaded = await clientApiRoutes.uploadRequestPhoto(file);
          setRequestPhotos((previous) => [...previous, { id: uploaded.id, originalName: uploaded.originalName, previewUrl }]);
        } catch (error) {
          URL.revokeObjectURL(previewUrl);
          addToast('error', error instanceof Error ? `${file.name}: ${error.message}` : `${file.name}: photo upload failed.`);
        }
      }
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleRemovePhoto = async (photo: (typeof requestPhotos)[number]) => {
    try {
      await clientApiRoutes.deleteRequestPhoto(photo.id);
      setRequestPhotos((previous) => previous.filter((item) => item.id !== photo.id));
      URL.revokeObjectURL(photo.previewUrl);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Photo could not be removed.');
    }
  };

  const handlePublish = async () => {
    const finalVehicle = customVehicle;

    if (!finalVehicle.brand.trim()) {
      addToast('error', 'Enter the vehicle make.');
      setCurrentStep(1);
      return;
    }
    if (!finalVehicle.model.trim()) {
      addToast('error', 'Enter the vehicle model.');
      setCurrentStep(1);
      return;
    }
    if (finalVehicle.year && (!Number.isInteger(finalVehicle.year) || finalVehicle.year < 1900 || finalVehicle.year > 2100)) {
      addToast('error', 'Enter a valid vehicle year between 1900 and 2100, or leave it blank.');
      setCurrentStep(1);
      return;
    }
    if (!category.trim()) {
      addToast('error', 'Enter a part category.');
      setCurrentStep(2);
      return;
    }
    if (!partName.trim()) {
      addToast('error', 'Enter the spare part name.');
      setCurrentStep(2);
      return;
    }
    if (!referenceNumber.trim() && !referenceUnavailable) {
      addToast('error', 'Enter a reference number or choose “I don’t have it.”');
      setCurrentStep(2);
      return;
    }
    if (!location.trim()) {
      addToast('error', 'Enter your city or address.');
      setCurrentStep(4);
      return;
    }
    if (!governorates.includes(governorate)) {
      addToast('error', 'Select a Tunisian governorate.');
      setCurrentStep(4);
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || minBudget < 0 || maxBudget < 0 || minBudget > maxBudget) {
      addToast('error', 'Enter a positive whole-number quantity and a valid budget range.');
      return;
    }

    setIsPublishing(true);
    try {
      const saved = await clientApiRoutes.createRequest({ partName: partName.trim(), category: category.trim(), oemReference: referenceUnavailable ? undefined : referenceNumber.trim(), referenceUnavailable, vehicleMake: finalVehicle.brand.trim(), vehicleModel: finalVehicle.model.trim(), vehicleEngine: finalVehicle.engine.trim() || undefined, vehicleYear: finalVehicle.year || undefined, governorate, location: location.trim(), photoIds: requestPhotos.map((photo) => photo.id), condition: condition.toUpperCase(), quantity, description: [description.trim(), additionalRequirements.trim()].filter(Boolean).join('\n\nAdditional requirements: '), minBudget, maxBudget, deliveryMethod }, submissionKey.current);
      addRequest({ id: saved.id, clientId: currentClient.id, clientName: currentClient.name, vehicle: { ...finalVehicle, brand: saved.vehicleMake, model: saved.vehicleModel, engine: saved.vehicleEngine ?? '', year: saved.vehicleYear ?? 0 }, category: saved.category, partName: saved.partName, referenceNumber: saved.oemReference, referenceUnavailable: saved.referenceUnavailable, quantity: saved.quantity, condition: String(saved.condition).toLowerCase() as PartCondition, description: saved.description, images: (saved.images ?? []).map((image: { id: string }) => image.id), minBudget: Number(saved.minBudget ?? 0), maxBudget: Number(saved.maxBudget ?? 0), deliveryMethod: (saved.deliveryMethod ?? deliveryMethod) as DeliveryMethod, location: saved.location ?? '', governorate: saved.governorate, status: String(saved.status).toLowerCase() as any, offersCount: saved._count?.offers ?? 0, createdAt: saved.createdAt, updatedAt: saved.updatedAt });
      addToast('success', 'Request published successfully.'); navigate('/client/requests');
    } catch (e) { addToast('error', e instanceof Error ? e.message : 'Request could not be published.'); }
    finally { setIsPublishing(false); }
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
              <h2 className="text-lg font-bold text-navy-900">Step 1: Enter Your Vehicle</h2>
              <p className="text-xs text-text-secondary mt-1">
                Enter the make and model in your own words. Year and engine are optional; unfamiliar vehicles are accepted.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-surface-secondary border border-border space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="vehicle-make">Make <span aria-hidden="true">*</span></label>
                    <input id="vehicle-make" type="text" autoComplete="off" maxLength={80} placeholder="e.g. Peugeot" value={customVehicle.brand} onChange={(e) => setCustomVehicle({ ...customVehicle, brand: e.target.value })} className="input-field" required aria-required="true" />
                  </div>
                  <div>
                    <label className="label" htmlFor="vehicle-model">Model <span aria-hidden="true">*</span></label>
                    <input id="vehicle-model" type="text" autoComplete="off" maxLength={80} placeholder="e.g. 308" value={customVehicle.model} onChange={(e) => setCustomVehicle({ ...customVehicle, model: e.target.value })} className="input-field" required aria-required="true" />
                  </div>
                  <div>
                    <label className="label" htmlFor="vehicle-year">Year (optional)</label>
                    <input id="vehicle-year" type="number" min="1900" max="2100" value={customVehicle.year || ''} onChange={(e) => setCustomVehicle({ ...customVehicle, year: Number(e.target.value) || 0 })} className="input-field" />
                  </div>
                  <div>
                    <label className="label" htmlFor="vehicle-engine">Engine / Version (optional)</label>
                    <input id="vehicle-engine" type="text" maxLength={80} placeholder="e.g. 2.0L BlueHDi" value={customVehicle.engine} onChange={(e) => setCustomVehicle({ ...customVehicle, engine: e.target.value })} className="input-field" />
                  </div>
                </div>
            </div>
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
                <label className="label" htmlFor="part-category">Category *</label>
                <input
                  id="part-category"
                  type="text"
                  maxLength={80}
                  placeholder="e.g. Brakes, Engine, Electrical"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-field"
                  required
                  autoComplete="off"
                />
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
                <label className="label" htmlFor="part-reference">OEM / Reference Number</label>
                <input
                  id="part-reference"
                  type="text"
                  placeholder="e.g. 04465-06200, FL-500S"
                  value={referenceNumber}
                  onChange={(e) => { setReferenceNumber(e.target.value); if (e.target.value) setReferenceUnavailable(false); }}
                  className="input-field"
                  maxLength={100}
                  required={!referenceUnavailable}
                  disabled={referenceUnavailable}
                />
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={referenceUnavailable} onChange={(e) => { setReferenceUnavailable(e.target.checked); if (e.target.checked) setReferenceNumber(''); }} />I don’t have the reference number</label>
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
                <p className="text-xs font-semibold text-navy-900">Add photos of the part or vehicle label</p>
                <p className="text-[11px] text-text-secondary mt-1">JPEG, PNG, or WebP · up to 5 MB each · maximum 5 photos</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <label className="btn-secondary cursor-pointer text-xs">
                    <Upload size={14} /> Choose photos
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={isUploadingPhotos || requestPhotos.length >= 5} onChange={handlePhotoSelection} className="sr-only" />
                  </label>
                  <label className="btn-secondary cursor-pointer text-xs">
                    <Camera size={14} /> Take a photo
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={isUploadingPhotos || requestPhotos.length >= 5} onChange={handlePhotoSelection} className="sr-only" />
                  </label>
                </div>
                {isUploadingPhotos && <p role="status" className="mt-3 text-xs text-accent">Validating and securely uploading photo…</p>}
                {requestPhotos.length > 0 && <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {requestPhotos.map((photo) => <div key={photo.id} className="relative overflow-hidden rounded-lg border border-border bg-white">
                    <img src={photo.previewUrl} alt={`Preview: ${photo.originalName}`} className="h-32 w-full object-cover" />
                    <p className="truncate px-2 py-1 text-[11px] text-text-secondary">{photo.originalName}</p>
                    <button type="button" onClick={() => void handleRemovePhoto(photo)} aria-label={`Remove ${photo.originalName}`} className="absolute right-2 top-2 rounded-full bg-white p-1 text-red-700 shadow hover:bg-red-50"><X size={14} /></button>
                  </div>)}
                </div>}
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
                <label className="label">Minimum Budget (TND)</label>
                <input
                  type="number"
                  step="500"
                  value={minBudget}
                  onChange={(e) => setMinBudget(parseInt(e.target.value) || 0)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Maximum Budget (TND)</label>
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
              <label className="label" htmlFor="request-governorate">Governorate <span aria-hidden="true">*</span></label>
              <select id="request-governorate" value={governorate} onChange={(e) => setGovernorate(e.target.value)} className="input-field" required aria-required="true">
                <option value="">Select a governorate</option>
                {governorates.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="request-location">City or address <span aria-hidden="true">*</span></label>
              <input
                id="request-location"
                type="text"
                placeholder="Enter the city or delivery address"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-field"
                required
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
                    {[customVehicle.brand, customVehicle.model].filter(Boolean).join(' ') || 'Not specified'}{' '}
                    {customVehicle.year ? `(${customVehicle.year})` : ''}
                  </p>
                  <p className="text-xs text-text-secondary">{customVehicle.engine || 'No engine/version specified'}</p>
                </div>

                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold">Spare Part</span>
                  <p className="text-sm font-bold text-navy-900">{partName || 'Not specified'}</p>
                  <p className="text-xs text-text-secondary">{category} • Qty: {quantity}</p>
                </div>

                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold">Condition</span>
                  <p className="text-sm font-bold text-navy-900 capitalize">{condition}</p>
                  <p className="text-xs text-text-secondary">Ref: {referenceUnavailable ? 'Client does not have one' : referenceNumber || 'Not entered'}</p>
                </div>

                <div>
                  <span className="text-[11px] text-text-tertiary uppercase font-semibold">Budget Range</span>
                  <p className="text-sm font-bold text-navy-900">{minBudget} - {maxBudget} TND</p>
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
                  Offers and messages stay in your portal. Contact details are blocked in marketplace messages; Talel does not currently provide payment processing or buyer guarantees.
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
                  if (currentStep === 1 && customVehicle.year && (!Number.isInteger(customVehicle.year) || customVehicle.year < 1900 || customVehicle.year > 2100)) {
                    addToast('error', 'Enter a valid vehicle year between 1900 and 2100, or leave it blank.');
                    return;
                  }
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
                disabled={isUploadingPhotos || isPublishing}
                className="btn-primary px-6"
              >
                <CheckCircle2 size={16} /> {isPublishing ? 'Publishing…' : 'Publish Request'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientCreateRequest;


import React, { useEffect, useState } from 'react';
import { Check, Download, FileText, LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { Modal } from './ui';
import { downloadSellerDocument, getHostRegistration, hostApi, listSellerDocuments, reviewSellerDocument } from '../api/host';
import type { HostRegistration, HostSellerDocument } from '../api/host';

type Props = {
  userId: string;
  role: 'CLIENT' | 'SELLER';
  onClose: () => void;
  onSellerVerified: (userId: string) => void;
};

const fieldValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return 'Not provided';
  if (Array.isArray(value)) return value.length ? value.map((item) => item && typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ') : 'Not provided';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
};

const Field: React.FC<{ label: string; value: unknown; wide?: boolean }> = ({ label, value, wide }) => (
  <div className={wide ? 'sm:col-span-2' : ''}>
    <dt className="text-xs font-semibold text-text-secondary">{label}</dt>
    <dd className="mt-1 text-sm text-navy-900 whitespace-pre-wrap break-words">{fieldValue(value)}</dd>
  </div>
);

const documentLabel: Record<string, string> = {
  rneDoc: 'RNE extract', taxDoc: 'Tax identification document', addressDoc: 'Professional address proof', authorizationDoc: 'Representation authorization',
};

export const RegistrationDetailsModal: React.FC<Props> = ({ userId, role, onClose, onSellerVerified }) => {
  const [registration, setRegistration] = useState<HostRegistration | null>(null);
  const [documents, setDocuments] = useState<HostSellerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getHostRegistration(userId), role === 'SELLER' ? listSellerDocuments(userId) : Promise.resolve([])])
      .then(([details, files]) => {
        if (!active) return;
        setRegistration(details);
        setDocuments(files);
      })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load registration details.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, role]);

  const download = async (document: HostSellerDocument) => {
    setBusyId(document.id); setError('');
    try {
      const blob = await downloadSellerDocument(userId, document.id);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url; anchor.download = document.originalName; anchor.rel = 'noreferrer';
      window.document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to download this document.'); }
    finally { setBusyId(null); }
  };

  const review = async (document: HostSellerDocument, status: 'approved' | 'rejected') => {
    const reason = rejectionReasons[document.id]?.trim();
    if (status === 'rejected' && !reason) { setError('Enter a reason before rejecting a document.'); return; }
    setBusyId(document.id); setError('');
    try {
      const updated = await reviewSellerDocument(userId, document.id, status, reason);
      setDocuments((current) => current.map((item) => item.id === updated.id ? { ...item, status: updated.status, rejectionReason: updated.rejectionReason, reviewedAt: updated.reviewedAt } : item));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to review this document.'); }
    finally { setBusyId(null); }
  };

  const profile = registration?.profile;
  const client = registration?.clientProfile;
  const canVerifySeller = !!profile && documents.length > 0 && documents.every((document) => document.status === 'approved') && documents.some((document) => document.kind === 'addressDoc' && document.status === 'approved');

  const verifySeller = async () => {
    setBusyId('verification'); setError('');
    try {
      await hostApi(`/host/sellers/${encodeURIComponent(userId)}/verification`, { method: 'PATCH', body: JSON.stringify({ status: 'verified' }) });
      setRegistration((current) => current?.profile ? { ...current, profile: { ...current.profile, verificationStatus: 'verified', verificationRejectionReason: null } } : current);
      onSellerVerified(userId);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to verify this seller.'); }
    finally { setBusyId(null); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${role === 'SELLER' ? 'Seller' : 'Client'} registration`} maxWidth="max-w-3xl">
      {loading ? <div className="flex items-center gap-2 py-8 text-sm text-text-secondary"><LoaderCircle className="animate-spin" size={18} /> Loading registration…</div> : null}
      {!loading && !registration ? <p className="text-sm text-danger">{error || 'Registration details could not be found.'}</p> : null}
      {registration ? (
        <div className="space-y-6">
          {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <section>
            <h4 className="mb-3 text-sm font-bold text-navy-900">Account</h4>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email" value={registration.email} />
              <Field label="Phone" value={registration.phone} />
              <Field label="Registered" value={new Date(registration.createdAt).toLocaleString()} />
              <Field label="Account status" value={registration.isActive ? 'Active' : 'Suspended'} />
            </dl>
          </section>

          {role === 'CLIENT' && client ? (
            <section className="border-t border-border pt-5">
              <h4 className="mb-3 text-sm font-bold text-navy-900">Client registration details</h4>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full name" value={client.name} />
                <Field label="Phone" value={client.phone} />
                <Field label="Address" value={client.address} wide />
                <Field label="City" value={client.city} />
                <Field label="Saved vehicles" value={client.vehicles} wide />
              </dl>
              <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-text-secondary">Client identity verification is not part of the current registration workflow.</p>
            </section>
          ) : null}

          {role === 'SELLER' && profile ? (
            <>
              <section className="border-t border-border pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-navy-900">Seller business registration</h4>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Verification: {profile.verificationStatus.replaceAll('_', ' ')}</span>
                </div>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Contact name" value={profile.name} />
                  <Field label="Legal business name" value={profile.legalName} />
                  <Field label="Commercial name" value={profile.commercialName} />
                  <Field label="Shop name" value={profile.shopName} />
                  <Field label="Legal form" value={profile.legalForm} />
                  <Field label="RNE number" value={profile.rneNumber} />
                  <Field label="Tax identifier" value={profile.taxIdentifier} />
                  <Field label="Business address" value={profile.address} />
                  <Field label="Governorate" value={profile.governorate} />
                  <Field label="City" value={profile.city} />
                  <Field label="Postal code" value={profile.postalCode} />
                  <Field label="Business phone" value={profile.businessPhone} />
                  <Field label="Business email" value={profile.businessEmail} />
                  <Field label="Website" value={profile.website} />
                  <Field label="Parts categories" value={profile.categories} wide />
                  <Field label="Products sold" value={profile.productsSold} />
                  <Field label="Sales type" value={profile.salesType} />
                  <Field label="Business location" value={profile.locationType} />
                  <Field label="Years of experience" value={profile.experienceYears} />
                  <Field label="Business hours" value={profile.businessHours} />
                  <Field label="Vehicle makes supported" value={profile.supportedMakes} wide />
                  <Field label="Specialties" value={profile.specialties} wide />
                  <Field label="Payment terms" value={profile.paymentTerms} wide />
                  <Field label="Business description" value={profile.description} wide />
                  {profile.verificationRejectionReason ? <Field label="Verification feedback" value={profile.verificationRejectionReason} wide /> : null}
                </dl>
              </section>

              <section className="border-t border-border pt-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">Submitted documents</h4>
                    <p className="mt-1 text-xs text-text-secondary">Open each file and review it before recording a decision.</p>
                  </div>
                  {profile.verificationStatus === 'verified' ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-700"><ShieldCheck size={16} /> Seller verified</span> : canVerifySeller ? (
                    <button disabled={busyId !== null} onClick={verifySeller} className="btn-primary inline-flex items-center gap-2"><ShieldCheck size={16} /> Verify seller</button>
                  ) : null}
                </div>
                {documents.length === 0 ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No documents have been submitted.</p> : (
                  <div className="space-y-3">
                    {documents.map((document) => (
                      <article key={document.id} className="rounded-lg border border-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <FileText size={18} className="mt-0.5 text-accent" />
                            <div>
                              <p className="text-sm font-semibold text-navy-900">{documentLabel[document.kind] ?? document.kind}</p>
                              <p className="mt-1 text-xs text-text-secondary">{document.originalName} · {(document.size / 1024).toFixed(0)} KB · {document.mimeType}</p>
                              <p className="mt-1 text-xs text-text-secondary">Submitted {new Date(document.submittedAt).toLocaleString()}</p>
                            </div>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${document.status === 'approved' ? 'bg-green-50 text-green-700' : document.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>{document.status}</span>
                        </div>
                        {document.rejectionReason ? <p className="mt-3 text-sm text-red-700">Reason: {document.rejectionReason}</p> : null}
                        {document.status === 'pending' ? (
                          <div className="mt-4 space-y-3">
                            <button disabled={busyId === document.id} onClick={() => download(document)} className="btn-secondary inline-flex items-center gap-2"><Download size={15} /> {busyId === document.id ? 'Loading…' : 'Download and review'}</button>
                            <div className="flex flex-wrap items-end gap-2">
                              <button disabled={busyId !== null} onClick={() => review(document, 'approved')} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Check size={15} className="mr-1 inline" /> Approve document</button>
                              <div className="min-w-[220px] flex-1">
                                <label className="mb-1 block text-xs font-semibold text-text-secondary" htmlFor={`reject-${document.id}`}>Rejection reason</label>
                                <input id={`reject-${document.id}`} value={rejectionReasons[document.id] ?? ''} onChange={(event) => setRejectionReasons((current) => ({ ...current, [document.id]: event.target.value }))} className="input w-full" placeholder="Explain what needs correction" />
                              </div>
                              <button disabled={busyId !== null} onClick={() => review(document, 'rejected')} className="btn-danger"><X size={15} className="mr-1 inline" /> Reject</button>
                            </div>
                          </div>
                        ) : <p className="mt-3 text-xs text-text-secondary">Reviewed {document.reviewedAt ? new Date(document.reviewedAt).toLocaleString() : ''}{document.reviewer?.email ? ` by ${document.reviewer.email}` : ''}</p>}
                      </article>
                    ))}
                  </div>
                )}
                {documents.length > 0 && !canVerifySeller && profile.verificationStatus !== 'verified' ? <p className="mt-3 text-xs text-text-secondary">Seller verification is enabled after the professional address proof and every submitted document are approved.</p> : null}
              </section>
            </>
          ) : null}
          <div className="flex justify-end border-t border-border pt-4"><button className="btn-secondary" onClick={onClose}>Close</button></div>
        </div>
      ) : null}
    </Modal>
  );
};

export default RegistrationDetailsModal;

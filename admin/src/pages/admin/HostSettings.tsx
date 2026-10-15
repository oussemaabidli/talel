import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Save, ShieldCheck, DollarSign, Bell, Lock } from 'lucide-react';
import { hostApi } from '../../api/host';

export const HostSettings: React.FC = () => {
  const { addToast } = useStore();

  const [platformName, setPlatformName] = useState('AutoParts Pro');
  const [supportEmail, setSupportEmail] = useState('support@autopartspro.dz');
  const [currency, setCurrency] = useState('TND');
  const [commissionRate, setCommissionRate] = useState(5);
  const [escrowHoldHours, setEscrowHoldHours] = useState(48);
  const [restrictDirectContact, setRestrictDirectContact] = useState(true);
  const [requireSellerVerification, setRequireSellerVerification] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);

  useEffect(() => {
    hostApi<Array<{ key: string; value: unknown }>>('/host/settings').then((settings) => {
      const values = Object.fromEntries(settings.map((setting) => [setting.key, setting.value]));
      if (typeof values.platformName === 'string') setPlatformName(values.platformName);
      if (typeof values.supportEmail === 'string') setSupportEmail(values.supportEmail);
      if (typeof values.currency === 'string') setCurrency(values.currency);
      if (typeof values.commissionRate === 'number') setCommissionRate(values.commissionRate);
      if (typeof values.escrowHoldHours === 'number') setEscrowHoldHours(values.escrowHoldHours);
      if (typeof values.restrictDirectContact === 'boolean') setRestrictDirectContact(values.restrictDirectContact);
      if (typeof values.requireSellerVerification === 'boolean') setRequireSellerVerification(values.requireSellerVerification);
      if (typeof values.emailAlerts === 'boolean') setEmailAlerts(values.emailAlerts);
    }).catch((error) => addToast('error', error instanceof Error ? error.message : 'Unable to load settings.'));
  }, [addToast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const settings = { platformName, supportEmail, currency, commissionRate, escrowHoldHours, restrictDirectContact, requireSellerVerification, emailAlerts };
    try {
      await Promise.all(Object.entries(settings).map(([key, value]) => hostApi(`/host/settings/${key}`, { method: 'PATCH', body: JSON.stringify({ value }) })));
      addToast('success', 'Marketplace platform settings saved');
    } catch (error) { addToast('error', error instanceof Error ? error.message : 'Unable to save settings.'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900">Platform Settings & Policies</h1>
        <p className="text-sm text-text-secondary">
          Save platform policy values. Payment and notification integrations are not connected, so several settings are stored but not yet applied.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Marketplace Commission & Financial Parameters */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <DollarSign size={18} className="text-primary" />
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              Financial & Commission Rules
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Platform Fee Commission (%)</label>
              <input
                type="number"
                min="0"
                max="25"
                step="0.5"
                value={commissionRate}
                onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                className="input-field font-bold text-navy-900"
              />
              <p className="text-[11px] text-text-secondary mt-1">
                Stored as policy only; payout deductions require a payment integration.
              </p>
            </div>

            <div>
              <label className="label">Escrow Guarantee Duration (Hours)</label>
              <input
                type="number"
                min="12"
                max="168"
                value={escrowHoldHours}
                onChange={(e) => setEscrowHoldHours(parseInt(e.target.value) || 48)}
                className="input-field"
              />
              <p className="text-[11px] text-text-secondary mt-1">
                Stored as policy only; escrow release is not connected.
              </p>
            </div>
          </div>
        </div>

        {/* Transaction Security & Anti-Disintermediation Rules */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <ShieldCheck size={18} className="text-accent" />
            <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">
              Safety & Disintermediation Protection
            </h2>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-secondary/50">
              <input
                type="checkbox"
                checked={restrictDirectContact}
                onChange={(e) => setRestrictDirectContact(e.target.checked)}
                className="mt-0.5 rounded text-accent"
              />
              <div>
                <p className="text-xs font-bold text-navy-900">Enforce Contextual Communication Only</p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Strictly hide buyer/seller phone numbers, WhatsApp, and external links to keep transactions guaranteed on-platform.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-secondary/50">
              <input
                type="checkbox"
                checked={requireSellerVerification}
                onChange={(e) => setRequireSellerVerification(e.target.checked)}
                className="mt-0.5 rounded text-accent"
              />
              <div>
                <p className="text-xs font-bold text-navy-900">Require Business Verification for Sellers</p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Only vendors approved by admin can submit quotations on client requests.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* General Details */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider pb-2 border-b border-border">
            General Platform Parameters
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Platform Brand Name</label>
              <input
                type="text"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
                className="input-field"
              />
            </div>

            <div>
              <label className="label">Official Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary py-3 px-6 rounded-xl font-bold flex items-center gap-2">
            <Save size={16} /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

export default HostSettings;


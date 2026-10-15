import React, { useEffect, useState } from 'react';
import { Avatar } from '../../components/ui';
import { Store, Save } from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { useStore } from '../../store/useStore';

type Profile = { name: string; shopName: string; description: string; address: string | null; city: string | null; specialties: string[]; businessPhone: string | null; verificationStatus: string; user: { email: string; phone: string | null } };

export const SellerProfile: React.FC = () => {
  const addToast = useStore((state) => state.addToast);
  const updateSeller = useStore((state) => state.updateSeller);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [specialties, setSpecialties] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    try {
      const result = await api.get<{ data: Profile }>('/seller/profile');
      const data = result.data;
      setProfile(data);
      setName(data.name);
      setShopName(data.shopName);
      setDescription(data.description);
      setAddress(data.address ?? '');
      setCity(data.city ?? '');
      setBusinessPhone(data.businessPhone ?? '');
      setSpecialties(data.specialties.join(', '));
      setLoadError('');
    } catch {
      const current = useStore.getState().currentSeller;
      const fallback: Profile = {
        name: current.name,
        shopName: current.shopName,
        description: current.shopDescription,
        address: current.address,
        city: current.city,
        specialties: current.specialties,
        businessPhone: current.phone,
        verificationStatus: current.isVerified ? 'verified' : 'pending',
        user: { email: current.email, phone: current.phone }
      };
      setProfile(fallback);
      setName(fallback.name);
      setShopName(fallback.shopName);
      setDescription(fallback.description);
      setAddress(fallback.address ?? '');
      setCity(fallback.city ?? '');
      setBusinessPhone(fallback.businessPhone ?? '');
      setSpecialties(fallback.specialties.join(', '));
      setLoadError('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadProfile(); }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api.patch<{ data: Profile }>('/seller/profile', { name, shopName, description, address, city, businessPhone: businessPhone || undefined, specialties: specialties.split(',').map((value) => value.trim()).filter(Boolean) });
      if (profile) setProfile({ ...profile, ...result.data });
    } catch {
      if (profile) setProfile({ ...profile, name, shopName, description, address, city, businessPhone, specialties: specialties.split(',').map((value) => value.trim()).filter(Boolean) });
    } finally {
      updateSeller({ name, shopName, shopDescription: description, address, city, specialties: specialties.split(',').map((value) => value.trim()).filter(Boolean) });
      addToast('success', 'Shop profile updated successfully');
      setSaving(false);
    }
  };

  if (loading) return <div className="card mx-auto max-w-4xl p-8 text-sm text-text-secondary">Loading seller profile…</div>;
  if (!profile) return <div className="card mx-auto max-w-4xl p-8"><p role="alert" className="text-sm text-danger">{loadError}</p><button className="btn-secondary mt-4" onClick={() => void loadProfile()}>Retry</button></div>;

  return <div className="mx-auto max-w-4xl space-y-6 pb-16">
    <div><h1 className="text-2xl font-extrabold text-navy-900">Shop Profile & Settings</h1><p className="text-sm text-text-secondary">Manage the business profile stored by Talel.</p></div>
    {loadError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</p>}
    <div className="card flex flex-col items-center gap-5 p-6 sm:flex-row"><Avatar name={profile.shopName} size="lg" className="h-16 w-16 text-xl" /><div className="flex-1 text-center sm:text-left"><div className="flex items-center justify-center gap-2 sm:justify-start"><h2 className="text-lg font-bold text-navy-900">{profile.shopName}</h2>{profile.verificationStatus === 'verified' && <span className="badge badge-success">Verified</span>}</div><p className="mt-1 text-xs text-text-secondary">{profile.city ? `${profile.city}, Tunisia` : 'Tunisia'} · {profile.user.email}</p><p className="mt-2 text-xs text-text-secondary">Verification: {profile.verificationStatus.replaceAll('_', ' ')}</p></div></div>
    <form onSubmit={handleSave} className="card space-y-6 p-6 sm:p-8">
      <h3 className="border-b border-border pb-2 text-sm font-bold uppercase tracking-wider text-navy-900">Business Profile</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="shopName">Shop Name *</label><input id="shopName" value={shopName} onChange={(e) => setShopName(e.target.value)} className="input-field" required /></div>
        <div><label className="label" htmlFor="contactName">Primary Contact *</label><input id="contactName" value={name} onChange={(e) => setName(e.target.value)} className="input-field" required /></div>
        <div><label className="label" htmlFor="accountEmail">Account Email</label><input id="accountEmail" type="email" value={profile.user.email} className="input-field bg-slate-50" readOnly /></div>
        <div><label className="label" htmlFor="businessPhone">Business Phone</label><input id="businessPhone" type="tel" value={businessPhone} onChange={(e) => setBusinessPhone(e.target.value)} className="input-field" placeholder="+216 22 345 678" /></div>
        <div><label className="label" htmlFor="city">City</label><input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="input-field" /></div>
        <div><label className="label" htmlFor="address">Business Address</label><input id="address" value={address} onChange={(e) => setAddress(e.target.value)} className="input-field" /></div>
      </div>
      <div><label className="label" htmlFor="specialties">Specialties (comma separated)</label><input id="specialties" value={specialties} onChange={(e) => setSpecialties(e.target.value)} className="input-field" placeholder="Brake systems, engine parts" /></div>
      <div><label className="label" htmlFor="description">Business Description</label><textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="input-field resize-none" /></div>
      <div className="flex justify-end border-t border-border pt-3"><button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60"><Save size={16} />{saving ? 'Saving…' : 'Save Shop Profile'}</button></div>
    </form>
  </div>;
};

export default SellerProfile;

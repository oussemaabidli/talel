import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Store } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useStore } from '../store/useStore';

const LoginPage: React.FC = () => {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const login = useStore((state) => state.login);
  const updateSeller = useStore((state) => state.updateSeller);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const values = new FormData(event.currentTarget);
    try {
      const result = await api.post<{ data: { verificationStatus: string } }>('/auth/login', { email: values.get('email'), password: values.get('password') });
      const account = await api.get<{ data: { id: string; email: string; profile: { name: string; shopName: string; description: string; address: string | null; city: string | null; specialties: string[]; verificationStatus: string } | null } }>('/auth/me');
      if (account.data.profile) updateSeller({ id: account.data.id, name: account.data.profile.name, email: account.data.email, shopName: account.data.profile.shopName, shopDescription: account.data.profile.description, address: account.data.profile.address || '', city: account.data.profile.city || '', specialties: account.data.profile.specialties, isVerified: account.data.profile.verificationStatus === 'verified' });
      const verified = result.data.verificationStatus === 'verified';
      login('seller', verified);
      navigate(verified ? '/seller/dashboard' : '/seller/status');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Unable to sign in. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="flex items-center gap-3 text-xl font-bold"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500"><Store size={22} /></span>Talel<span className="text-emerald-400">Seller</span></Link>
        <div className="relative z-10 max-w-xl pb-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[.22em] text-emerald-300">L’espace professionnel</p>
          <h1 className="text-5xl font-bold leading-tight">Les bonnes pièces. Les bons clients.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">Gérez votre activité de pièces automobiles et développez votre présence sur Talel.</p>
        </div>
        <p className="text-sm text-slate-500">Talel · Marketplace tunisienne de pièces automobiles</p>
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full border border-white/10" />
        <div className="absolute -bottom-24 -right-8 h-[20rem] w-[20rem] rounded-full border border-emerald-400/20" />
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-12 flex items-center gap-2 font-bold text-slate-900 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-white"><Store size={20} /></span>Talel Seller</Link>
          <p className="text-sm font-semibold text-emerald-700">Bon retour</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Connexion vendeur</h2>
          <p className="mt-2 text-slate-600">Accédez à votre espace professionnel Talel.</p>
          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
            <div><label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">Adresse e-mail professionnelle</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@entreprise.tn" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" /></div>
            <div><div className="mb-1.5 flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium text-slate-700">Mot de passe</label><button type="button" className="text-sm font-medium text-emerald-700" onClick={() => setMessage('La réinitialisation du mot de passe sera disponible avec le serveur Talel.')}>Mot de passe oublié ?</button></div><input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Votre mot de passe" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10" /></div>
            {message && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"><LockKeyhole size={18} />{busy ? 'Connexion…' : 'Se connecter'}<ArrowRight size={17} /></button>
          </form>
          <p className="mt-8 text-center text-sm text-slate-600">Vous n’avez pas encore de compte ? <Link to="/register" className="font-semibold text-emerald-700 hover:text-emerald-800">Créer un compte vendeur</Link></p>
          <p className="mt-10 text-center text-xs leading-5 text-slate-500">Connexion sécurisée au serveur Talel.</p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;

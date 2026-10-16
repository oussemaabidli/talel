import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Store } from 'lucide-react';
import { useStore } from '../store/useStore';
import { clientAuth, ApiError } from '../api/client';

const LoginPage: React.FC = () => {
  const { login, updateClient } = useStore();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setBusy(true);
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email') ?? '');
    const password = String(values.get('password') ?? '');
    try {
      const result = await clientAuth.login(email, password);
      const user = result.user;
      updateClient({ id: user.id, name: user.name ?? '', email: user.email, phone: user.phone ?? '' });
      login('client');
      window.location.assign('/client/dashboard');
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Unable to continue. Please try again.');
    } finally { setBusy(false); }
  };

  const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
  const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

  return (
    <main className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <a href="/" className="flex items-center gap-3 text-xl font-bold"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500"><Store size={22} /></span>Talel<span className="text-emerald-400">Client</span></a>
        <div className="relative z-10 max-w-xl pb-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[.22em] text-emerald-300">L’espace client</p>
          <h1 className="text-5xl font-bold leading-tight">La bonne pièce, en quelques clics.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">Trouvez vos pièces automobiles, comparez les offres et suivez vos commandes sur Talel.</p>
        </div>
        <p className="text-sm text-slate-500">Talel · Marketplace tunisienne de pièces automobiles</p>
        <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full border border-white/10" />
        <div className="absolute -bottom-24 -right-8 h-[20rem] w-[20rem] rounded-full border border-emerald-400/20" />
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <a href="/" className="mb-12 flex items-center gap-2 font-bold text-slate-900 lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-white"><Store size={20} /></span>Talel Client</a>
          <p className="text-sm font-semibold text-emerald-700">Bon retour</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Connexion client</h2>
          <p className="mt-2 text-slate-600">Accédez à votre espace client Talel.</p>
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <div><label htmlFor="email" className={labelClass}>Adresse e-mail</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="vous@exemple.tn" className={fieldClass} /></div>
            <div><label htmlFor="password" className={labelClass}>Mot de passe</label><input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Votre mot de passe" className={fieldClass} /></div>
            {message && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{message}</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"><LockKeyhole size={18} />{busy ? 'Veuillez patienter…' : 'Se connecter'}<ArrowRight size={17} /></button>
          </form>
          <p className="mt-8 text-center text-sm text-slate-600">Vous n’avez pas encore de compte ? <Link to="/register" className="font-semibold text-emerald-700 hover:text-emerald-800">Créer un compte client</Link></p>
          <p className="mt-8 text-center text-xs leading-5 text-slate-500">Connexion sécurisée au serveur Talel.</p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;

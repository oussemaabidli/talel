import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Store } from 'lucide-react';
import { ApiError, clientAuth } from '../api/client';
import { useStore } from '../store/useStore';

const steps = ['Vos informations', 'Compte'];
const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

const RegisterPage: React.FC = () => {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState({ name: '', phone: '', email: '', password: '', confirmPassword: '' });
  const formRef = useRef<HTMLFormElement>(null);
  const login = useStore((state) => state.login);
  const updateClient = useStore((state) => state.updateClient);

  const continueStep = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    const current = new FormData(event.currentTarget);
    const next = { ...values };
    current.forEach((value, key) => { if (key in next) next[key as keyof typeof next] = String(value); });
    if (step === 1 && next.password !== next.confirmPassword) {
      setValues(next);
      setMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    setValues(next);
    setMessage('');
    if (step === 0) { setStep(1); return; }

    setBusy(true);
    try {
      const result = await clientAuth.register({ name: next.name, email: next.email, password: next.password, phone: next.phone || undefined });
      const user = result.user;
      updateClient({ id: user.id, name: next.name, email: user.email, phone: next.phone });
      login('client');
      setSubmitted(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Impossible de créer le compte. Réessayez.');
    } finally { setBusy(false); }
  };

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white"><Store size={18} /></span>Talel Client</Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-9">
          {submitted ? <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={27} /></div>
            <h1 className="mt-5 text-center text-2xl font-bold text-slate-900">Votre compte est créé</h1>
            <p className="mx-auto mt-3 max-w-xl text-center leading-7 text-slate-600">Bienvenue sur Talel. Votre compte client est prêt ; vous pouvez commencer à rechercher des pièces et envoyer vos demandes.</p>
            <div className="mt-7 flex justify-center"><Link to="/client/dashboard" className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">Accéder à mon espace<ArrowRight size={17} /></Link></div>
          </> : <>
            <p className="text-sm font-semibold text-emerald-700">Rejoindre Talel</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Inscription client</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Créez votre compte pour demander des pièces, comparer les offres et suivre vos commandes.</p>
            <div className="mt-8" aria-label={`Étape ${step + 1} sur ${steps.length}`}>
              <div className="mb-3 flex justify-between text-xs font-medium text-slate-500"><span>Étape {step + 1} sur {steps.length}</span><span>{Math.round(progress)} %</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="mt-3 grid grid-cols-2 gap-2">{steps.map((title, index) => <div key={title} className={`text-[11px] sm:text-xs ${index === step ? 'font-semibold text-emerald-700' : index < step ? 'text-slate-700' : 'text-slate-400'}`}>{title}</div>)}</div>
            </div>
            <form ref={formRef} onSubmit={continueStep} className="mt-8">
              {step === 0 && <section className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="name">Nom complet</label><input className={fieldClass} id="name" name="name" required maxLength={100} autoComplete="name" placeholder="Votre nom et prénom" defaultValue={values.name} /></div>
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="phone">Téléphone <span className="text-slate-400">(facultatif)</span></label><input className={fieldClass} id="phone" name="phone" type="tel" maxLength={32} autoComplete="tel" placeholder="+216 22 345 678" defaultValue={values.phone} /></div>
                <p className="sm:col-span-2 text-xs leading-5 text-slate-500">Vos coordonnées servent à gérer vos demandes et commandes sur Talel.</p>
              </section>}
              {step === 1 && <section className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="email">Adresse e-mail</label><input className={fieldClass} id="email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="vous@exemple.tn" defaultValue={values.email} /></div>
                <div><label className={labelClass} htmlFor="password">Mot de passe</label><input className={fieldClass} id="password" name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" defaultValue={values.password} /></div>
                <div><label className={labelClass} htmlFor="confirmPassword">Confirmer le mot de passe</label><input className={fieldClass} id="confirmPassword" name="confirmPassword" type="password" minLength={10} maxLength={128} required autoComplete="new-password" defaultValue={values.confirmPassword} /></div>
                <p className="sm:col-span-2 text-xs leading-5 text-slate-500">Choisissez au moins 10 caractères. Le serveur stocke uniquement une empreinte sécurisée du mot de passe.</p>
              </section>}
              {message && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</p>}
              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">{step > 0 ? <button type="button" onClick={() => { setMessage(''); setStep((current) => current - 1); }} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"><ArrowLeft size={17} />Précédent</button> : <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">Déjà inscrit ? Se connecter</Link>}<button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Création…' : step === steps.length - 1 ? 'Créer mon compte' : 'Continuer'}<ArrowRight size={17} /></button></div>
            </form>
          </>}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Vos informations sont transmises de manière sécurisée au serveur Talel.</p>
      </div>
    </main>
  );
};

export default RegisterPage;

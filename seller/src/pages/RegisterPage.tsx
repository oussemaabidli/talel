import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileUp, Store } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useStore } from '../store/useStore';

const steps = ['Compte', 'Entreprise', 'Activité', 'Documents & envoi'];
const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

const RegisterPage: React.FC = () => {
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, FormDataEntryValue | string[]>>({});
  const [documents, setDocuments] = useState<Record<string, File>>({});
  const [documentErrors, setDocumentErrors] = useState<Record<string, string>>({});
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const login = useStore((state) => state.login);

  const selectDocument = (id: string, file?: File) => {
    if (!file) return true;
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const validExtensions = /\.(pdf|jpe?g|png|webp)$/i.test(file.name);
    if ((!validTypes.includes(file.type) && !validExtensions) || file.size > 10 * 1024 * 1024) {
      setDocumentErrors((current) => ({
        ...current,
        [id]: file.size > 10 * 1024 * 1024
          ? 'Chaque fichier doit faire 10 Mo maximum.'
          : 'Choisissez un fichier PDF, JPG, PNG ou WebP.',
      }));
      return false;
    }
    setDocuments((current) => ({ ...current, [id]: file }));
    setDocumentErrors((current) => ({ ...current, [id]: '' }));
    setUploadedDocuments((current) => ({ ...current, [id]: '' }));
    setMessage('');
    return true;
  };

  const removeDocument = async (id: string) => {
    if (accountCreated && uploadedDocuments[id]) {
      try { await api.delete(`/seller/documents/${encodeURIComponent(id)}`); }
      catch (error) { setMessage(error instanceof ApiError ? error.message : 'Impossible de retirer le document du serveur.'); return; }
    }
    setDocuments((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setUploadedDocuments((current) => ({ ...current, [id]: '' }));
    setDocumentErrors((current) => ({ ...current, [id]: '' }));
  };

  const continueStep = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formRef.current?.reportValidity()) return;
    const current = new FormData(event.currentTarget);
    const nextValues = { ...values };
    current.forEach((value, key) => { if (!(value instanceof File) && key !== 'categories') nextValues[key] = value; });
    if (step === 2) nextValues.categories = current.getAll('categories').map(String);
    if (step === 0 && nextValues.password !== nextValues.confirmPassword) { setMessage('Les mots de passe ne correspondent pas.'); return; }
    setMessage('');
    setValues(nextValues);
    if (step < steps.length - 1) { setStep((currentStep) => currentStep + 1); return; }
    setBusy(true);
    let wasAccountCreated = accountCreated;
    try {
      if (!wasAccountCreated) await api.post('/auth/register', {
        email: nextValues.email,
        phone: nextValues.phone,
        password: nextValues.password,
        name: `${nextValues.firstName ?? ''} ${nextValues.lastName ?? ''}`.trim(),
        shopName: nextValues.commercialName || nextValues.legalName,
        legalName: nextValues.legalName,
        commercialName: nextValues.commercialName,
        legalForm: nextValues.legalForm,
        rneNumber: nextValues.rne,
        taxIdentifier: nextValues.taxId,
        address: nextValues.address,
        city: nextValues.city,
        governorate: nextValues.governorate,
        postalCode: nextValues.postalCode,
        businessPhone: nextValues.businessPhone || undefined,
        businessEmail: nextValues.businessEmail || undefined,
        website: nextValues.website || undefined,
        categories: Array.isArray(nextValues.categories) ? nextValues.categories : [],
        productsSold: nextValues.products,
        salesType: nextValues.salesType,
        locationType: nextValues.locationType,
        experienceYears: nextValues.experience ? Number(nextValues.experience) : undefined,
        supportedMakes: typeof nextValues.brands === 'string' ? nextValues.brands.split(',').map((brand) => brand.trim()).filter(Boolean) : [],
        description: nextValues.description,
      });
      if (!wasAccountCreated) {
        wasAccountCreated = true;
        setAccountCreated(true);
        login('seller', false);
      }
      for (const [id, file] of Object.entries(documents)) {
        const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
        if (uploadedDocuments[id] === fingerprint) continue;
        await api.upload(`/seller/documents/${encodeURIComponent(id)}`, file);
        setUploadedDocuments((current) => ({ ...current, [id]: fingerprint }));
      }
      setMessage('');
      setSubmitted(true);
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Impossible de créer le compte. Réessayez.');
      if (wasAccountCreated) setSubmitted(true);
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white"><Store size={18} /></span>Talel Seller</Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-9">
          {submitted ? <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check size={27} /></div>
            <h1 className="mt-5 text-center text-2xl font-bold text-slate-900">Compte créé · vérification en attente</h1>
            <p className="mx-auto mt-3 max-w-xl text-center leading-7 text-slate-600">Votre compte et les informations d’entreprise ont été transmis au serveur Talel. La création du compte ne signifie pas que l’entreprise est vérifiée.</p>
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Votre compte est créé. {Object.keys(uploadedDocuments).some((id) => uploadedDocuments[id]) ? 'Les fichiers sélectionnés ont été transmis au stockage privé local du serveur et restent accessibles uniquement à vous et aux vérificateurs autorisés.' : 'Aucun document n’a été ajouté.'} Le statut de votre dossier est « en attente de vérification ».</div>
            {message && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p>}
            <div className="mt-7 flex justify-center gap-3"><button onClick={() => { setSubmitted(false); setStep(3); }} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Revoir le dossier</button><Link to="/" className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">Retour à la connexion</Link></div>
          </> : <>
            <p className="text-sm font-semibold text-emerald-700">Rejoindre Talel</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">Inscription vendeur</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Présentez votre entreprise et votre activité de pièces automobiles.</p>
            <div className="mt-8" aria-label={`Étape ${step + 1} sur ${steps.length}`}>
              <div className="mb-3 flex justify-between text-xs font-medium text-slate-500"><span>Étape {step + 1} sur {steps.length}</span><span>{Math.round(((step + 1) / steps.length) * 100)} %</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
              <div className="mt-3 grid grid-cols-4 gap-2">{steps.map((title, index) => <div key={title} className={`text-[11px] sm:text-xs ${index === step ? 'font-semibold text-emerald-700' : index < step ? 'text-slate-700' : 'text-slate-400'}`}>{title}</div>)}</div>
            </div>
            <form ref={formRef} onSubmit={continueStep} className="mt-8">
              {step === 0 && <section className="grid gap-4 sm:grid-cols-2">
                <div><label className={labelClass} htmlFor="firstName">Prénom</label><input className={fieldClass} id="firstName" name="firstName" required autoComplete="given-name" /></div>
                <div><label className={labelClass} htmlFor="lastName">Nom</label><input className={fieldClass} id="lastName" name="lastName" required autoComplete="family-name" /></div>
                <div><label className={labelClass} htmlFor="representativeRole">Fonction</label><select className={fieldClass} id="representativeRole" name="representativeRole" required defaultValue=""><option value="" disabled>Choisir une fonction</option><option>Propriétaire</option><option>Gérant(e)</option><option>Représentant(e) autorisé(e)</option><option>Autre</option></select></div>
                <div><label className={labelClass} htmlFor="phone">Téléphone (+216)</label><input className={fieldClass} id="phone" name="phone" type="tel" required pattern="(?:\+216\s*)?[2-9](?:\s?\d){7}" placeholder="+216 22 345 678" autoComplete="tel" /></div>
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="email">E-mail professionnel</label><input className={fieldClass} id="email" name="email" type="email" required placeholder="vous@entreprise.tn" autoComplete="email" /></div>
                <div><label className={labelClass} htmlFor="password">Mot de passe</label><input className={fieldClass} id="password" name="password" type="password" minLength={10} required autoComplete="new-password" /></div>
                <div><label className={labelClass} htmlFor="confirmPassword">Confirmer le mot de passe</label><input className={fieldClass} id="confirmPassword" name="confirmPassword" type="password" minLength={10} required autoComplete="new-password" /></div>
                <p className="sm:col-span-2 text-xs leading-5 text-slate-500">Choisissez au moins 10 caractères. Le serveur stocke uniquement une empreinte sécurisée du mot de passe.</p>
              </section>}
              {step === 1 && <section className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="legalName">Raison sociale</label><input className={fieldClass} id="legalName" name="legalName" required /></div>
                <div><label className={labelClass} htmlFor="commercialName">Nom commercial</label><input className={fieldClass} id="commercialName" name="commercialName" /></div>
                <div><label className={labelClass} htmlFor="legalForm">Forme juridique</label><select className={fieldClass} id="legalForm" name="legalForm" required defaultValue=""><option value="" disabled>Choisir</option><option>Personne physique</option><option>Entreprise individuelle</option><option>SUARL</option><option>SARL</option><option>Autre</option></select></div>
                <div><label className={labelClass} htmlFor="rne">Matricule RNE <span className="text-slate-400">(si applicable)</span></label><input className={fieldClass} id="rne" name="rne" /></div>
                <div><label className={labelClass} htmlFor="taxId">Identifiant fiscal <span className="text-slate-400">(si applicable)</span></label><input className={fieldClass} id="taxId" name="taxId" /></div>
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="address">Adresse professionnelle</label><input className={fieldClass} id="address" name="address" required autoComplete="street-address" /></div>
                <div><label className={labelClass} htmlFor="governorate">Gouvernorat</label><input className={fieldClass} id="governorate" name="governorate" required /></div>
                <div><label className={labelClass} htmlFor="city">Ville</label><input className={fieldClass} id="city" name="city" required autoComplete="address-level2" /></div>
                <div><label className={labelClass} htmlFor="postalCode">Code postal</label><input className={fieldClass} id="postalCode" name="postalCode" inputMode="numeric" /></div>
                <div><label className={labelClass} htmlFor="businessPhone">Téléphone de l’entreprise</label><input className={fieldClass} id="businessPhone" name="businessPhone" type="tel" pattern="(?:\+216\s*)?[2-9](?:\s?\d){7}" placeholder="+216 22 345 678" /></div>
                <div><label className={labelClass} htmlFor="businessEmail">E-mail de l’entreprise</label><input className={fieldClass} id="businessEmail" name="businessEmail" type="email" /></div>
                <div><label className={labelClass} htmlFor="storeCount">Nombre de points de vente</label><input className={fieldClass} id="storeCount" name="storeCount" type="number" min="0" /></div>
                <div><label className={labelClass} htmlFor="website">Site web ou page professionnelle</label><input className={fieldClass} id="website" name="website" type="url" placeholder="https://" /></div>
              </section>}
              {step === 2 && <section className="space-y-5">
                <fieldset><legend className={labelClass}>Catégories de pièces</legend><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{['Mécanique','Carrosserie','Électricité','Filtres','Pneus','Lubrifiants','Accessoires','Autre'].map((item) => <label key={item} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" name="categories" value={item} className="accent-emerald-600" />{item}</label>)}</div></fieldset>
                <div className="grid gap-4 sm:grid-cols-2"><div><label className={labelClass} htmlFor="products">État des produits</label><select id="products" name="products" className={fieldClass} required defaultValue=""><option value="" disabled>Choisir</option><option>Neuf</option><option>Occasion</option><option>Neuf et occasion</option></select></div><div><label className={labelClass} htmlFor="salesType">Type de vente</label><select id="salesType" name="salesType" className={fieldClass} required defaultValue=""><option value="" disabled>Choisir</option><option>Détail</option><option>Gros</option><option>Détail et gros</option></select></div>
                <div><label className={labelClass} htmlFor="locationType">Lieu d’activité</label><select id="locationType" name="locationType" className={fieldClass} required defaultValue=""><option value="" disabled>Choisir</option><option>Magasin physique</option><option>Entrepôt</option><option>En ligne uniquement</option><option>Plusieurs emplacements</option></select></div><div><label className={labelClass} htmlFor="experience">Années d’expérience</label><input id="experience" name="experience" type="number" min="0" className={fieldClass} /></div>
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="brands">Marques de véhicules prises en charge</label><input id="brands" name="brands" className={fieldClass} placeholder="Ex. Renault, Peugeot, Volkswagen" /></div><div className="sm:col-span-2"><label className={labelClass} htmlFor="description">Description de l’activité</label><textarea id="description" name="description" rows={4} maxLength={1000} className={fieldClass} placeholder="Présentez votre entreprise et vos spécialités." /></div></div>
              </section>}
              {step === 3 && <section className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h2 className="font-semibold text-slate-900">Documents de l’entreprise</h2><p className="mt-1 text-sm leading-6 text-slate-600">Les fichiers seront transmis au serveur privé après la création du compte. Formats acceptés : PDF, JPG, PNG et WebP ; 10 Mo maximum par fichier.</p></div>
                {[['rneDoc','Extrait RNE (si applicable)'],['taxDoc','Document d’identification fiscale (si applicable)'],['addressDoc','Justificatif d’adresse professionnelle (requis pour la validation)'],['authorizationDoc','Justificatif de représentation (si requis)']].map(([id, title]) => <div key={id}>
                  <label htmlFor={id} className={labelClass}>{title}</label>
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 hover:border-emerald-500">
                    <FileUp className="shrink-0 text-emerald-600" size={20} />
                    <span>{documents[id] ? 'Remplacer le fichier' : 'Sélectionner un PDF ou une image'}</span>
                    <input className="sr-only" id={id} name={id} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { if (!selectDocument(id, event.target.files?.[0])) event.currentTarget.value = ''; }} />
                  </label>
                  {documents[id] && <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><span className="min-w-0 truncate">{documents[id].name} · {(documents[id].size / (1024 * 1024)).toFixed(2)} Mo {uploadedDocuments[id] ? '· Transmis' : ''}</span><button type="button" onClick={() => void removeDocument(id)} className="shrink-0 font-medium underline">Retirer</button></div>}
                  {documentErrors[id] && <p role="alert" className="mt-1 text-sm text-red-700">{documentErrors[id]}</p>}
                </div>)}
                <label className="flex items-start gap-3 text-sm leading-6 text-slate-700"><input className="mt-1 accent-emerald-600" type="checkbox" required />J’accepte les conditions d’utilisation et la politique de confidentialité de Talel.</label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Les documents seront examinés par l’équipe Talel. Un justificatif d’adresse professionnelle approuvé est nécessaire avant l’activation des fonctions de vente.</div>
                {message && <p role="alert" className="text-sm text-red-700">{message}</p>}
              </section>}
              {message && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</p>}
              <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">{step > 0 ? <button type="button" onClick={() => setStep((currentStep) => currentStep - 1)} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"><ArrowLeft size={17} />Précédent</button> : <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">Déjà inscrit ? Se connecter</Link>}<button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60">{busy ? 'Création…' : step === steps.length - 1 ? 'Créer mon compte' : 'Continuer'}<ArrowRight size={17} /></button></div>
            </form>
          </>}
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Vos données et documents nécessitent une transmission sécurisée au serveur avant toute création de compte.</p>
      </div>
    </main>
  );
};

export default RegisterPage;

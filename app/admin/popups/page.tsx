'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Calendar, Check, Eye, EyeOff, ImagePlus, Link as LinkIcon, Loader2, Plus, Save, Sparkles, Sprout, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from '@/components/site/toast-provider';
import type { PromotionalPopup } from '@/lib/supabase/types';
import { processLocalImage, processUrlImage, uploadProcessedFile } from '@/lib/image-processing';
import { getPopupCopy, isAllowedPopupHref, type PopupLanguage } from '@/lib/promotional-popup';

type PopupLocaleContent = NonNullable<PromotionalPopup['localized_content'][PopupLanguage]>;
type AdminLocale = { code: PopupLanguage; label: string; hint: string };

const LOCALES: Record<'BD' | 'IN', AdminLocale[]> = {
  BD: [
    { code: 'bn', label: 'বাংলা', hint: 'Bangladesh storefront' },
    { code: 'en', label: 'English', hint: 'Bangladesh storefront' },
  ],
  IN: [
    { code: 'bn', label: 'বাংলা', hint: 'India storefront' },
    { code: 'en', label: 'English', hint: 'India storefront' },
    { code: 'hi', label: 'हिन्दी', hint: 'India storefront' },
  ],
};

const FREQ_OPTIONS = [
  { value: 'once_per_day', label: 'Once per day' },
  { value: 'once_per_session', label: 'Once per browser session' },
  { value: 'once_until_closed', label: 'Once until the customer closes it' },
  { value: 'every_visit', label: 'Every visit' },
] as const;

function localDateTimeValue(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function copyForLocale(popup: PromotionalPopup, language: PopupLanguage): PopupLocaleContent {
  const copy = getPopupCopy(popup, language);
  return {
    title: copy.title,
    description: copy.description,
    offer: copy.offer,
    cta_text: copy.cta_text,
  };
}

function initialLocaleMap(popup: PromotionalPopup, locales: AdminLocale[]) {
  const current = popup.localized_content || {};
  const hasSavedCopy = Object.values(current).some((copy) =>
    Boolean(copy?.title || copy?.description || copy?.offer || copy?.cta_text),
  );
  if (hasSavedCopy) return current;
  const fallbackLocale = locales.some((locale) => locale.code === 'bn') ? 'bn' : locales[0].code;
  return { ...current, [fallbackLocale]: copyForLocale(popup, fallbackLocale) };
}

function newPopup(country: 'BD' | 'IN'): PromotionalPopup {
  const now = new Date();
  return {
    id: '',
    country_code: country,
    title: '',
    description: '',
    image: '',
    offer: '',
    cta_text: '',
    cta_link: '/all-products',
    localized_content: {},
    display_delay: 3,
    start_date: now.toISOString(),
    end_date: null,
    is_active: false,
    show_on_main: true,
    show_on_offers: false,
    show_close_button: true,
    auto_close: false,
    auto_close_seconds: 10,
    display_frequency: 'once_per_day',
    created_at: '',
    updated_at: '',
  };
}

export default function AdminPopupsPage() {
  const [popups, setPopups] = useState<PromotionalPopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState<PromotionalPopup | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [adminCountry, setAdminCountry] = useState<'BD' | 'IN'>('BD');
  const [branchVerified, setBranchVerified] = useState(false);
  const [activeLocale, setActiveLocale] = useState<PopupLanguage>('bn');
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const locales = LOCALES[adminCountry];
  const activeLocaleInfo = locales.find((locale) => locale.code === activeLocale) || locales[0];

  const fetchPopups = useCallback(async (country: 'BD' | 'IN') => {
    setLoadError(false);
    const { data, error } = await supabase
      .from('promotional_popups')
      .select('*')
      .eq('country_code', country)
      .order('created_at', { ascending: false });
    if (error) {
      setPopups([]);
      setLoadError(true);
      setLoading(false);
      toast('Popup list could not be loaded. Check your branch access and try again.', 'error');
      return;
    }
    setPopups((data || []) as PromotionalPopup[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const { data, error } = await supabase.rpc('current_admin_country');
      if (cancelled) return;
      if (error) {
        setLoadError(true);
        setLoading(false);
        toast('Admin branch could not be verified. Popup editing is disabled.', 'error');
        return;
      }
      const country = String(data).toUpperCase() === 'IN' ? 'IN' : 'BD';
      setAdminCountry(country);
      setBranchVerified(true);
      setActiveLocale('bn');
      await fetchPopups(country);
    };
    void init();
    return () => { cancelled = true; };
  }, [fetchPopups]);

  const uploadImage = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    try {
      const processed = await processLocalImage(file, { maxWidth: 1600, maxHeight: 1200 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      setEditing((current) => current ? { ...current, image: url } : current);
      toast('Popup image processed and uploaded.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      toast(`Image upload failed: ${message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const importFromUrl = async () => {
    if (!urlInput.trim() || !editing) return;
    setUploading(true);
    try {
      const processed = await processUrlImage(urlInput.trim(), { maxWidth: 1600, maxHeight: 1200 });
      const url = await uploadProcessedFile(processed, 'product-images', supabase);
      setEditing((current) => current ? { ...current, image: url } : current);
      setUrlInput('');
      toast('Popup image imported and processed.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown import error';
      toast(`Image import failed: ${message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const beginNew = () => {
    setActiveLocale('bn');
    setEditing(newPopup(adminCountry));
  };

  const beginEdit = (popup: PromotionalPopup) => {
    setActiveLocale('bn');
    setEditing({ ...popup, localized_content: initialLocaleMap(popup, locales) });
  };

  const setLocaleField = (field: keyof PopupLocaleContent, value: string) => {
    if (!editing) return;
    setEditing((current) => {
      if (!current) return current;
      const localeContent = current.localized_content?.[activeLocale] || {};
      return {
        ...current,
        localized_content: {
          ...(current.localized_content || {}),
          [activeLocale]: { ...localeContent, [field]: value },
        },
      };
    });
  };

  const preview = useMemo(() => editing ? getPopupCopy(editing, activeLocale) : null, [editing, activeLocale]);
  const previewImage = editing?.image?.trim();

  const validate = (popup: PromotionalPopup) => {
    const hasTitle = locales.some((locale) => Boolean(popup.localized_content?.[locale.code]?.title?.trim()));
    if (!hasTitle) return 'Add a title in at least one storefront language.';
    if (!popup.show_on_main && !popup.show_on_offers) return 'Choose at least one popup placement.';
    const href = popup.cta_link.trim();
    if (href && !isAllowedPopupHref(href)) return 'Enter a valid site path or an http/https URL for the CTA.';
    const start = new Date(popup.start_date).getTime();
    const end = popup.end_date ? new Date(popup.end_date).getTime() : null;
    if (!Number.isFinite(start)) return 'Enter a valid start date and time.';
    if (end !== null && (!Number.isFinite(end) || end <= start)) return 'End date must be later than the start date.';
    if (!Number.isInteger(popup.display_delay) || popup.display_delay < 0 || popup.display_delay > 30) return 'Display delay must be between 0 and 30 seconds.';
    if (popup.auto_close && (!Number.isInteger(popup.auto_close_seconds) || popup.auto_close_seconds < 3 || popup.auto_close_seconds > 60)) return 'Auto-close must be between 3 and 60 seconds.';
    return null;
  };

  const save = async () => {
    if (!editing || saving) return;
    const validationError = validate(editing);
    if (validationError) {
      toast(validationError, 'error');
      return;
    }

    const primaryCopy = editing.localized_content?.bn || editing.localized_content?.en || editing.localized_content?.hi || {};
    const payload = {
      country_code: adminCountry,
      title: primaryCopy.title?.trim() || editing.title || '',
      description: primaryCopy.description?.trim() || editing.description || '',
      offer: primaryCopy.offer?.trim() || editing.offer || '',
      cta_text: primaryCopy.cta_text?.trim() || editing.cta_text || '',
      cta_link: editing.cta_link.trim() || '/all-products',
      image: editing.image?.trim() || null,
      localized_content: editing.localized_content || {},
      start_date: dateTimeToIso(editing.start_date),
      end_date: editing.end_date ? dateTimeToIso(editing.end_date) : null,
      is_active: editing.is_active,
      show_on_main: editing.show_on_main,
      show_on_offers: editing.show_on_offers,
      show_close_button: true,
      auto_close: editing.auto_close,
      display_delay: Math.min(30, Math.max(0, Number(editing.display_delay) || 0)),
      auto_close_seconds: Math.min(60, Math.max(3, Number(editing.auto_close_seconds) || 8)),
      display_frequency: editing.display_frequency,
    };
    if (!payload.start_date) {
      toast('Start date is invalid.', 'error');
      return;
    }

    setSaving(true);
    try {
      let error;
      if (editing.id) {
        const result = await supabase
          .from('promotional_popups')
          .update(payload)
          .eq('id', editing.id)
          .eq('country_code', adminCountry)
          .select('id')
          .maybeSingle();
        error = result.error;
        if (!error && !result.data) error = new Error('Popup was not found in this branch. Refresh the list and try again.');
      } else {
        const result = await supabase.from('promotional_popups').insert(payload).select('id').single();
        error = result.error;
      }
      if (error) {
        toast(`Popup could not be saved: ${error.message}`, 'error');
        return;
      }
      toast(editing.id ? 'Popup updated successfully.' : 'Popup created successfully.');
      setEditing(null);
      await fetchPopups(adminCountry);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown save error';
      toast(`Popup could not be saved: ${message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (popup: PromotionalPopup) => {
    setMutatingId(popup.id);
    const { data, error } = await supabase
      .from('promotional_popups')
      .update({ is_active: !popup.is_active })
      .eq('id', popup.id)
      .eq('country_code', adminCountry)
      .select('id')
      .maybeSingle();
    if (error) toast(`Popup status could not be changed: ${error.message}`, 'error');
    else if (!data) toast('Popup was not found in this branch. Refresh the list and try again.', 'error');
    else toast(popup.is_active ? 'Popup paused.' : 'Popup activated.');
    await fetchPopups(adminCountry);
    setMutatingId(null);
  };

  const del = async (popup: PromotionalPopup) => {
    if (!window.confirm(`Delete “${popup.title || 'this popup'}” from the ${adminCountry === 'IN' ? 'India' : 'Bangladesh'} branch?`)) return;
    setMutatingId(popup.id);
    const { data, error } = await supabase
      .from('promotional_popups')
      .delete()
      .eq('id', popup.id)
      .eq('country_code', adminCountry)
      .select('id')
      .maybeSingle();
    if (error) toast(`Popup could not be deleted: ${error.message}`, 'error');
    else if (!data) toast('Popup was not found in this branch. Refresh the list and try again.', 'error');
    else toast('Popup deleted.');
    await fetchPopups(adminCountry);
    setMutatingId(null);
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" aria-label="Loading popup settings" />;

  return (
    <div className="mx-auto w-full max-w-6xl px-1 pb-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-primary">Promotion settings</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Promotional Popups</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a timed, branch-specific offer customers can close at any time.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground">
            {adminCountry === 'IN' ? '🇮🇳 India · INR' : '🇧🇩 Bangladesh · BDT'}
          </span>
          <button disabled={!branchVerified || loadError} onClick={beginNew} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50">
            <Plus className="h-4 w-4" /> New popup
          </button>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-foreground">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <p><strong>Customer-friendly by design:</strong> one eligible popup is shown at a time; the newest eligible popup is selected. A visible close control is always kept available.</p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-foreground">
          <p className="font-semibold">Popup list could not be loaded.</p>
          <button onClick={() => fetchPopups(adminCountry)} className="mt-3 rounded-lg border border-border bg-card px-3 py-2 font-semibold hover:bg-secondary">Try again</button>
        </div>
      ) : (
        <div className="space-y-3">
          {popups.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-6 w-6" /></div>
              <h2 className="font-bold">No popups for this branch yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Create one popup, add the branch languages, set its dates and placement, then activate it when ready.</p>
              <button onClick={beginNew} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Create popup</button>
            </div>
          )}
          {popups.map((popup) => {
            const title = popup.localized_content?.bn?.title || popup.localized_content?.en?.title || popup.localized_content?.hi?.title || popup.title || '(Untitled popup)';
            const activeLocales = locales.filter((locale) => Boolean(popup.localized_content?.[locale.code]?.title?.trim())).map((locale) => locale.label);
            return (
              <article key={popup.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  {popup.image ? (
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary"><Image src={popup.image} alt="" fill sizes="80px" unoptimized className="object-cover" /></div>
                  ) : (
                    <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ImagePlus className="h-6 w-6" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">{title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${popup.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-secondary text-muted-foreground'}`}>{popup.is_active ? 'Active' : 'Paused'}</span>
                      <span>·</span><span>{popup.display_frequency.replace(/_/g, ' ')}</span>
                      <span>·</span><span>{popup.show_on_main ? 'Main site' : ''}{popup.show_on_main && popup.show_on_offers ? ' + ' : ''}{popup.show_on_offers ? 'Offer pages' : ''}</span>
                      {activeLocales.length > 0 && <><span>·</span><span>{activeLocales.join(' / ')}</span></>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Starts {new Date(popup.start_date).toLocaleString()} {popup.end_date ? `· Ends ${new Date(popup.end_date).toLocaleString()}` : '· No end date'}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                  <button disabled={mutatingId === popup.id} onClick={() => void toggleActive(popup)} aria-label={popup.is_active ? 'Pause popup' : 'Activate popup'} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background transition hover:bg-secondary disabled:opacity-50">
                    {mutatingId === popup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : popup.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={() => beginEdit(popup)} aria-label="Edit popup" className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold transition hover:bg-secondary"><Save className="h-4 w-4" /> Edit</button>
                  <button disabled={mutatingId === popup.id} onClick={() => void del(popup)} aria-label="Delete popup" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/5 text-destructive transition hover:bg-destructive/10 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-5" onClick={(event) => { if (event.target === event.currentTarget && !saving && !uploading) setEditing(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="popup-editor-title" className="max-h-[96dvh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/20 bg-background shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-5 py-4 backdrop-blur sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">{adminCountry === 'IN' ? 'India popup' : 'Bangladesh popup'}</p>
                <h2 id="popup-editor-title" className="mt-0.5 text-lg font-extrabold">{editing.id ? 'Edit popup' : 'Create popup'}</h2>
              </div>
              <button type="button" disabled={saving || uploading} onClick={() => setEditing(null)} aria-label="Close editor" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border hover:bg-secondary disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-6 p-4 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.85fr)]">
              <div className="space-y-6">
                <section>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div><h3 className="font-bold">Popup message</h3><p className="text-xs text-muted-foreground">Fill the languages your customers use. Missing language copy falls back to the next available version.</p></div>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2" aria-label="Popup language">
                    {locales.map((locale) => (
                      <button key={locale.code} type="button" aria-pressed={activeLocale === locale.code} onClick={() => setActiveLocale(locale.code)} className={`min-h-10 rounded-xl px-3.5 text-sm font-bold transition ${activeLocale === locale.code ? 'bg-primary text-primary-foreground shadow-sm' : 'border border-border bg-card text-foreground hover:bg-secondary'}`}>
                        {locale.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <label className="block text-sm font-semibold">Title <span className="text-destructive">*</span>
                      <input value={editing.localized_content?.[activeLocale]?.title || ''} onChange={(event) => setLocaleField('title', event.target.value)} maxLength={120} className="input-bangla mt-1.5" placeholder={activeLocale === 'hi' ? 'अपना ऑफ़र शीर्षक लिखें' : activeLocale === 'en' ? 'Write a clear offer headline' : 'অফারের শিরোনাম লিখুন'} />
                      <span className="mt-1 block text-right text-[11px] font-normal text-muted-foreground">{editing.localized_content?.[activeLocale]?.title?.length || 0}/120</span>
                    </label>
                    <label className="block text-sm font-semibold">Description
                      <textarea value={editing.localized_content?.[activeLocale]?.description || ''} onChange={(event) => setLocaleField('description', event.target.value)} maxLength={280} rows={3} className="input-bangla mt-1.5 min-h-[90px]" placeholder="A short, helpful explanation of the offer" />
                      <span className="mt-1 block text-right text-[11px] font-normal text-muted-foreground">{editing.localized_content?.[activeLocale]?.description?.length || 0}/280</span>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-semibold">Offer badge
                        <input value={editing.localized_content?.[activeLocale]?.offer || ''} onChange={(event) => setLocaleField('offer', event.target.value)} maxLength={48} className="input-bangla mt-1.5" placeholder="Limited-time offer" />
                      </label>
                      <label className="block text-sm font-semibold">Button label
                        <input value={editing.localized_content?.[activeLocale]?.cta_text || ''} onChange={(event) => setLocaleField('cta_text', event.target.value)} maxLength={40} className="input-bangla mt-1.5" placeholder="Shop this offer" />
                      </label>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-1 font-bold">Popup image</h3>
                  <p className="mb-3 text-xs text-muted-foreground">Use a clear 16:9 campaign image. It will be cropped to fit and compressed before upload.</p>
                  <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50"><ImagePlus className="h-4 w-4" /> Upload image</button>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { if (event.target.files?.[0]) void uploadImage(event.target.files[0]); event.target.value = ''; }} />
                    <input value={urlInput} onChange={(event) => setUrlInput(event.target.value)} className="input-bangla min-w-0 flex-1" placeholder="Or import an image URL" aria-label="Image URL to import" />
                    <button type="button" onClick={() => void importFromUrl()} disabled={uploading || !urlInput.trim()} aria-label="Import image URL" className="inline-flex h-10 items-center justify-center rounded-xl border border-border px-3 hover:bg-secondary disabled:opacity-50"><LinkIcon className="h-4 w-4" /></button>
                  </div>
                  {uploading && <p className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing image…</p>}
                  {editing.image && <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-card p-2"><div className="relative h-16 w-28 overflow-hidden rounded-lg bg-secondary"><Image src={editing.image} alt="Popup image preview" fill sizes="112px" unoptimized className="object-cover" /></div><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Image ready</span><button type="button" onClick={() => setEditing({ ...editing, image: '' })} className="rounded-lg px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5">Remove</button></div>}
                </section>

                <section>
                  <h3 className="mb-3 font-bold">Button destination</h3>
                  <label className="block text-sm font-semibold">CTA link
                    <input value={editing.cta_link || ''} onChange={(event) => setEditing({ ...editing, cta_link: event.target.value })} className="input-bangla mt-1.5" placeholder="/all-products or https://example.com/offer" />
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">Use a site path such as /all-products or a secure https:// link.</span>
                  </label>
                </section>

                <section>
                  <h3 className="mb-3 font-bold">Schedule and display</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold">Starts at
                      <input type="datetime-local" value={localDateTimeValue(editing.start_date)} onChange={(event) => setEditing({ ...editing, start_date: event.target.value })} className="input-bangla mt-1.5" />
                    </label>
                    <label className="block text-sm font-semibold">Ends at (optional)
                      <input type="datetime-local" value={localDateTimeValue(editing.end_date)} onChange={(event) => setEditing({ ...editing, end_date: event.target.value || null })} className="input-bangla mt-1.5" />
                    </label>
                    <label className="block text-sm font-semibold">Show after (seconds)
                      <input type="number" min={0} max={30} step={1} value={editing.display_delay} onChange={(event) => setEditing({ ...editing, display_delay: Number(event.target.value) })} className="input-bangla mt-1.5" />
                    </label>
                    <label className="block text-sm font-semibold">Display frequency
                      <select value={editing.display_frequency} onChange={(event) => setEditing({ ...editing, display_frequency: event.target.value })} className="input-bangla mt-1.5">
                        {FREQ_OPTIONS.map((frequency) => <option key={frequency.value} value={frequency.value}>{frequency.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-4">
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={editing.is_active} onChange={(event) => setEditing({ ...editing, is_active: event.target.checked })} className="h-4 w-4 accent-primary" /> Activate this popup</label>
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={editing.show_on_main} onChange={(event) => setEditing({ ...editing, show_on_main: event.target.checked })} className="h-4 w-4 accent-primary" /> Show on main storefront</label>
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={editing.show_on_offers} onChange={(event) => setEditing({ ...editing, show_on_offers: event.target.checked })} className="h-4 w-4 accent-primary" /> Show on offer landing pages</label>
                    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={editing.auto_close} onChange={(event) => setEditing({ ...editing, auto_close: event.target.checked })} className="h-4 w-4 accent-primary" /> Close automatically</label>
                    {editing.auto_close && <label className="ml-6 block max-w-xs text-sm font-semibold">Auto-close after (3–60 seconds)
                      <input type="number" min={3} max={60} step={1} value={editing.auto_close_seconds} onChange={(event) => setEditing({ ...editing, auto_close_seconds: Number(event.target.value) })} className="input-bangla mt-1.5" />
                    </label>}
                    <p className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><Check className="h-4 w-4 text-emerald-600" /> A visible close button is always shown for customer control.</p>
                  </div>
                </section>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-[88px] lg:self-start">
                <div>
                  <h3 className="font-bold">Live preview</h3>
                  <p className="text-xs text-muted-foreground">Preview for {activeLocaleInfo.label} · {adminCountry === 'IN' ? 'India' : 'Bangladesh'}</p>
                </div>
                <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_20px_55px_-32px_rgba(0,0,0,.55)]">
                  <div className={`relative isolate overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-lime-700 ${previewImage ? 'aspect-[16/9]' : 'flex min-h-40 items-center justify-center text-lime-100'}`}>
                    {previewImage ? <Image src={previewImage} alt="" fill sizes="(max-width: 1024px) 90vw, 400px" unoptimized className="object-cover" /> : <Sprout className="h-14 w-14" strokeWidth={1.4} aria-hidden="true" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/65 via-transparent to-emerald-950/10" />
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-emerald-950/65 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-white"><Sparkles className="h-3 w-3 text-lime-300" /> GAZI SEED</span>
                    <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/95 text-slate-700 shadow"><X className="h-4 w-4" /></span>
                  </div>
                  <div className="px-5 pb-6 pt-5 text-center">
                    {preview?.offer && <span className="mb-3 inline-flex rounded-full border border-amber-300/70 bg-amber-50 px-3.5 py-1.5 text-xs font-extrabold text-amber-900">{preview.offer}</span>}
                    <h4 className="text-xl font-extrabold leading-tight text-foreground">{preview?.title || 'Your offer headline will appear here'}</h4>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{preview?.description || 'Add a short description to help customers understand this offer.'}</p>
                    <div className="mt-5"><span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">{preview?.cta_text || 'Shop this offer'}<span aria-hidden="true">→</span></span></div>
                    <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground/70">GAZI SEED · {adminCountry === 'IN' ? 'India' : 'Bangladesh'}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-xs leading-5 text-muted-foreground">
                  <div className="mb-1 flex items-center gap-2 font-bold text-foreground"><Calendar className="h-4 w-4 text-primary" /> Display summary</div>
                  {editing.is_active ? 'Active' : 'Paused'} · {editing.show_on_main ? 'Main storefront' : ''}{editing.show_on_main && editing.show_on_offers ? ' + ' : ''}{editing.show_on_offers ? 'Offer pages' : ''} · waits {editing.display_delay || 0}s · {editing.display_frequency.replace(/_/g, ' ')}
                </div>
              </aside>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:flex-row sm:justify-end sm:px-7">
              <button type="button" disabled={saving || uploading} onClick={() => setEditing(null)} className="min-h-11 rounded-xl border border-border px-5 text-sm font-bold hover:bg-secondary disabled:opacity-50">Cancel</button>
              <button type="button" disabled={saving || uploading} onClick={() => void save()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving…' : editing.id ? 'Save popup' : 'Create popup'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

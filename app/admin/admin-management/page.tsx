'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, X, Copy, Check, Mail, ShieldCheck, Shield, Loader2, RefreshCw, Trash2, Power, AlertTriangle, UserCog, Lock, History, Globe2 } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-management`;
const COUNTRY_OPTIONS = [
  { code: 'BD', label: '🇧🇩 Bangladesh' },
  { code: 'IN', label: '🇮🇳 India' },
];

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createType, setCreateType] = useState<'admin' | 'master_admin'>('admin');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordEmail, setTempPasswordEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);

  useEffect(() => {
    loadAdmins();
    checkRole();
  }, []);

  const checkRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setCurrentUserId(session.user.id);
      const { data: masterData } = await supabase.rpc('is_master_admin');
      setIsMasterAdmin(!!masterData);
    }
  };

  const loadAdmins = async () => {
    setLoading(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setLoading(false); return; }

    try {
      const res = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'list_admins' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error || 'লোড ব্যর্থ', 'error');
        setAdmins([]);
      } else {
        const data = await res.json();
        setAdmins(data.admins || []);
      }
    } catch {
      toast('লোড ব্যর্থ', 'error');
    }
    setLoading(false);
  };

  const callAdminApi = async (action: string, extra?: Record<string, any>) => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return null;

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, ...extra }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  };

  const handleToggleActive = async (admin: any) => {
    const isMaster = admin.role === 'master_admin';
    const action = isMaster ? 'update_master_admin' : 'update_admin';
    const confirmMsg = isMaster
      ? `"${admin.email}" ${admin.is_active ? 'নিষ্ক্রিয়' : 'সক্রিয়'} করতে চান? নিশ্চিত করুন।`
      : `"${admin.email}" এর অ্যাডমিন অ্যাক্সেস ${admin.is_active ? 'নিষ্ক্রিয়' : 'সক্রিয়'} করতে চান?`;
    if (!confirm(confirmMsg)) return;

    setActionLoading(`toggle-${admin.id}`);
    try {
      await callAdminApi(action, { admin_id: admin.id, is_active: !admin.is_active });
      toast(admin.is_active ? 'নিষ্ক্রিয় করা হয়েছে' : 'সক্রিয় করা হয়েছে');
      loadAdmins();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevoke = async (admin: any) => {
    if (admin.role === 'master_admin') { toast('MASTER_ADMIN অ্যাক্সেস বাতিল করা যাবে না', 'error'); return; }
    if (!confirm(`"${admin.email}" এর অ্যাডমিন অ্যাক্সেস বাতিল করতে চান?`)) return;
    setActionLoading(`revoke-${admin.id}`);
    try {
      await callAdminApi('revoke_admin', { admin_id: admin.id });
      toast('অ্যাডমিন অ্যাক্সেস বাতিল করা হয়েছে');
      loadAdmins();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (admin: any) => {
    const isMaster = admin.role === 'master_admin';
    if (isMaster) {
      if (!confirm(`"${admin.email}" এর পাসওয়ার্ড রিসেট করতে চান? নতুন টেম্পোরারি পাসওয়ার্ড তৈরি হবে।`)) return;
      setActionLoading(`reset-${admin.id}`);
      try {
        const result = await callAdminApi('force_reset_master_admin', { admin_id: admin.id });
        if (result?.temp_password) {
          setTempPassword(result.temp_password);
          setTempPasswordEmail(admin.email);
        }
        toast('পাসওয়ার্ড রিসেট করা হয়েছে');
      } catch (err: any) {
        toast(err.message, 'error');
      } finally {
        setActionLoading(null);
      }
    } else {
      if (!confirm(`"${admin.email}" এ পাসওয়ার্ড রিসেট লিংক পাঠাতে চান?`)) return;
      setActionLoading(`reset-${admin.id}`);
      try {
        await callAdminApi('send_password_reset', { email: admin.email });
        toast('পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে');
      } catch (err: any) {
        toast(err.message, 'error');
      } finally {
        setActionLoading(null);
      }
    }
  };

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">এডমিন ম্যানেজমেন্ট</h1>
          <p className="mt-1 text-sm text-muted-foreground">Branch অনুযায়ী Admin access নির্ধারণ করুন</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button onClick={() => setShowAuditLog(true)} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary">
            <History className="h-4 w-4" /> অডিট লগ
          </button>
          <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-secondary">
            <UserCog className="h-4 w-4" /> আমার প্রোফাইল
          </button>
          <button onClick={() => { setCreateType('admin'); setShowCreateForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-5 w-5" /> নতুন এডমিন
          </button>
          {isMasterAdmin && (
            <button onClick={() => { setCreateType('master_admin'); setShowCreateForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90">
              <ShieldCheck className="h-5 w-5" /> মাস্টার অ্যাডমিন
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Total Admin</span><UserCog className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-2 text-2xl font-bold">{admins.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Bangladesh</span><span>🇧🇩</span></div>
          <p className="mt-2 text-2xl font-bold">{admins.filter(a => a.role !== 'master_admin' && (a.country_code || 'BD') === 'BD').length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">India</span><span>🇮🇳</span></div>
          <p className="mt-2 text-2xl font-bold">{admins.filter(a => a.role !== 'master_admin' && a.country_code === 'IN').length}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3">নাম / ইমেইল</th>
              <th className="p-3">রোল</th>
              <th className="p-3">Branch</th>
              <th className="p-3">স্ট্যাটাস</th>
              <th className="p-3">তৈরির তারিখ</th>
              <th className="p-3">শেষ লগইন</th>
              <th className="p-3">অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="p-3">
                  <p className="font-medium">{a.email}</p>
                </td>
                <td className="p-3">
                  {a.role === 'master_admin' ? (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      <ShieldCheck className="h-3 w-3" /> MASTER ADMIN
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      <Shield className="h-3 w-3" /> ADMIN
                    </span>
                  )}
                </td>
                <td className="p-3">
                  {a.role === 'master_admin' || !a.country_code ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      <Globe2 className="h-3.5 w-3.5" /> সব দেশ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs font-semibold">
                      {a.country_code === 'IN' ? '🇮🇳 India' : '🇧🇩 Bangladesh'}
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {a.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">{formatDate(a.created_at)}</td>
                <td className="p-3 text-muted-foreground">{formatDate(a.last_login_at || '')}</td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={() => setEditingAdmin(a)} className="rounded-lg p-1.5 hover:bg-secondary" title="এডিট">
                      <UserCog className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleToggleActive(a)} disabled={actionLoading === `toggle-${a.id}`} className="rounded-lg p-1.5 hover:bg-secondary" title={a.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}>
                      {actionLoading === `toggle-${a.id}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    </button>
                    <button onClick={() => handleResetPassword(a)} disabled={actionLoading === `reset-${a.id}`} className="rounded-lg p-1.5 hover:bg-secondary" title="পাসওয়ার্ড রিসেট">
                      {actionLoading === `reset-${a.id}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    </button>
                    {a.role !== 'master_admin' && (
                      <button onClick={() => handleRevoke(a)} disabled={actionLoading === `revoke-${a.id}`} className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10" title="অ্যাডমিন অ্যাক্সেস বাতিল করুন">
                        {actionLoading === `revoke-${a.id}` ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {admins.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন এডমিন নেই</p>}
      </div>

      {showCreateForm && (
        <CreateAdminModal
          createType={createType}
          onClose={() => setShowCreateForm(false)}
          onCreate={async (data) => {
            setActionLoading('create');
            try {
              const action = createType === 'master_admin' ? 'create_master_admin' : 'create_admin';
              const result = await callAdminApi(action, data);
              if (result?.temp_password) {
                setTempPassword(result.temp_password);
                setTempPasswordEmail(data.email);
              }
              toast(createType === 'master_admin' ? 'মাস্টার অ্যাডমিন তৈরি হয়েছে' : 'নতুন এডমিন তৈরি হয়েছে');
              loadAdmins();
              setShowCreateForm(false);
            } catch (err: any) {
              toast(err.message, 'error');
            } finally {
              setActionLoading(null);
            }
          }}
          loading={actionLoading === 'create'}
        />
      )}

      {editingAdmin && (
        <EditAdminModal
          admin={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSave={async (data) => {
            setActionLoading(`edit-${editingAdmin.id}`);
            try {
              const action = editingAdmin.role === 'master_admin' ? 'update_master_admin' : 'update_admin';
              await callAdminApi(action, { admin_id: editingAdmin.id, ...data });
              toast('আপডেট হয়েছে');
              loadAdmins();
              setEditingAdmin(null);
            } catch (err: any) {
              toast(err.message, 'error');
            } finally {
              setActionLoading(null);
            }
          }}
          loading={actionLoading === `edit-${editingAdmin.id}`}
        />
      )}

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showAuditLog && <AuditLogModal onClose={() => setShowAuditLog(false)} />}

      {tempPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setTempPassword(null); setTempPasswordEmail(''); }} />
          <div className="relative z-10 max-w-md rounded-2xl bg-background p-6">
            <div className="mb-4 flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold">টেম্পোরারি পাসওয়ার্ড</h3>
            </div>
            <p className="mb-2 text-sm text-muted-foreground"><strong>{tempPasswordEmail}</strong> এর জন্য টেম্পোরারি পাসওয়ার্ড:</p>
            <p className="mb-4 text-sm text-muted-foreground">এই পাসওয়ার্ডটি একবারই দেখানো হবে। কপি করে নতুন অ্যাডমিনকে দিন। প্রথম লগইনে নতুন পাসওয়ার্ড সেট করতে বাধ্য থাকবেন।</p>
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <code className="flex-1 text-lg font-mono font-bold tracking-wider">{tempPassword}</code>
              <button onClick={copyPassword} className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700">
                {copied ? <><Check className="h-4 w-4" /> কপি হয়েছে</> : <><Copy className="h-4 w-4" /> কপি</>}
              </button>
            </div>
            <button onClick={() => { setTempPassword(null); setTempPasswordEmail(''); }} className="mt-4 w-full rounded-xl border border-border py-2.5 hover:bg-secondary">ঠিক আছে</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateAdminModal({ createType, onClose, onCreate, loading }: { createType: string; onClose: () => void; onCreate: (data: any) => Promise<void>; loading: boolean }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', country_code: 'BD' });
  const isMaster = createType === 'master_admin';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    onCreate(isMaster ? { ...form, country_code: 'MASTER' } : form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            {isMaster ? <ShieldCheck className="h-5 w-5 text-primary" /> : <UserCog className="h-5 w-5" />}
            {isMaster ? 'নতুন মাস্টার অ্যাডমিন তৈরি করুন' : 'নতুন এডমিন তৈরি করুন'}
          </h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">নাম *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">ইমেইল *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">ফোন (ঐচ্ছিক)</label><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-bangla" placeholder="01XXXXXXXXX" /></div>
          {!isMaster && (
            <div>
              <label className="mb-1 block text-sm font-medium">Branch *</label>
              <div className="relative">
                <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} className="input-bangla w-full appearance-none pl-10" required>
                  {COUNTRY_OPTIONS.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <div className={`rounded-lg border p-3 text-sm ${isMaster ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/20'}`}>
            <p className={`font-medium ${isMaster ? 'text-primary' : 'text-foreground'}`}>রোল: {isMaster ? 'MASTER_ADMIN' : 'ADMIN'}</p>
            <p className="mt-1 text-muted-foreground">{isMaster ? 'মাস্টার অ্যাডমিন সব দেশের data access করতে পারবেন।' : 'নির্বাচিত Branch-এর data-তেই এই admin-এর access থাকবে।'}</p>
          </div>
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : isMaster ? 'মাস্টার অ্যাডমিন তৈরি করুন' : 'এডমিন তৈরি করুন'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditAdminModal({ admin, onClose, onSave, loading }: { admin: any; onClose: () => void; onSave: (data: any) => Promise<void>; loading: boolean }) {
  const [name, setName] = useState(admin.name || admin.full_name || '');
  const [phone, setPhone] = useState(admin.phone || '');
  const [countryCode, setCountryCode] = useState(admin.role === 'master_admin' ? 'MASTER' : (admin.country_code || 'BD'));
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [countryTouched, setCountryTouched] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {};
    if (nameTouched && name.trim()) data.name = name.trim();
    if (phoneTouched) data.phone = phone.trim();
    if (countryTouched && admin.role !== 'master_admin') data.country_code = countryCode;
    if (Object.keys(data).length === 0) { toast('কোন পরিবর্তন করা হয়নি', 'error'); return; }
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold"><UserCog className="h-5 w-5" /> এডমিন এডিট করুন</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">ইমেইল</label><p className="font-medium text-muted-foreground">{admin.email}</p></div>
          <div><label className="mb-1 block text-sm font-medium">নাম</label><input type="text" value={name} onChange={(e) => { setName(e.target.value); setNameTouched(true); }} className="input-bangla" placeholder="নতুন নাম লিখুন" /></div>
          <div><label className="mb-1 block text-sm font-medium">ফোন</label><input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneTouched(true); }} className="input-bangla" placeholder="নতুন ফোন লিখুন" /></div>
          {admin.role !== 'master_admin' && (
            <div>
              <label className="mb-1 block text-sm font-medium">Branch</label>
              <div className="relative">
                <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setCountryTouched(true); }} className="input-bangla w-full appearance-none pl-10">
                  {COUNTRY_OPTIONS.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'আপডেট করুন'}</button>
        </form>
      </div>
    </div>
  );
}

function ProfileModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user);
        setName(data.session.user.user_metadata?.name || '');
        setPhone(data.session.user.user_metadata?.phone || '');
      }
    });
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ data: { name, phone } });
      if (error) throw error;
      toast('প্রোফাইল আপডেট হয়েছে');
    } catch (err: any) {
      toast(err.message || 'আপডেট ব্যর্থ', 'error');
    } finally { setProfileLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (pwForm.newPassword.length < 8) { setPwError('পাসওয়ার্ড কমপক্ষি ৮ অক্ষরের হতে হবে'); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('নতুন পাসওয়ার্ড মিলছে না'); return; }
    setPwLoading(true);
    try {
      if (user?.email) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: pwForm.currentPassword });
        if (signInError) { setPwError('বর্তমান পাসওয়ার্ড ভুল'); setPwLoading(false); return; }
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: pwForm.newPassword });
      if (updateError) throw updateError;
      setPwSuccess(true);
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast('Password successfully changed');
    } catch (err: any) { setPwError(err.message || 'পাসওয়ার্ড পরিবর্তন ব্যর্থ'); }
    finally { setPwLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold"><UserCog className="h-5 w-5" /> আমার প্রোফাইল</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        <div className="mb-4 flex gap-2 border-b border-border"><button onClick={() => setTab('profile')} className={`px-4 py-2 text-sm font-medium ${tab === 'profile' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>প্রোফাইল</button><button onClick={() => setTab('password')} className={`px-4 py-2 text-sm font-medium ${tab === 'password' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}>পাসওয়ার্ড পরিবর্তন</button></div>
        {tab === 'profile' && <form onSubmit={handleUpdateProfile} className="space-y-4"><div><label className="mb-1 block text-sm font-medium">ইমেইল</label><p className="font-medium text-muted-foreground">{user?.email}</p></div><div><label className="mb-1 block text-sm font-medium">নাম</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-bangla" /></div><div><label className="mb-1 block text-sm font-medium">ফোন</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-bangla" placeholder="01XXXXXXXXX" /></div><button type="submit" disabled={profileLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{profileLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'প্রোফাইল আপডেট করুন'}</button></form>}
        {tab === 'password' && <>{pwSuccess ? <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center"><Check className="mx-auto mb-2 h-8 w-8 text-green-600" /><p className="font-medium text-green-800">Password successfully changed</p><button onClick={onClose} className="mt-4 rounded-xl border border-border px-6 py-2 text-sm hover:bg-secondary">ঠিক আছে</button></div> : <form onSubmit={handleChangePassword} className="space-y-4"><div><label className="mb-1 block text-sm font-medium">বর্তমান পাসওয়ার্ড</label><input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} className="input-bangla" required /></div><div><label className="mb-1 block text-sm font-medium">নতুন পাসওয়ার্ড</label><input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} className="input-bangla" placeholder="কমপক্ষি ৮ অক্ষর" required /></div><div><label className="mb-1 block text-sm font-medium">নতুন পাসওয়ার্ড নিশ্চিত করুন</label><input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} className="input-bangla" required /></div>{pwError && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{pwError}</p>}<button type="submit" disabled={pwLoading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{pwLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Lock className="h-5 w-5" /> পাসওয়ার্ড পরিবর্তন করুন</>}</button></form>}</>}
      </div>
    </div>
  );
}

function AuditLogModal({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { loadLogs(); }, []);
  const loadLogs = async () => {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(FUNCTION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'list_audit_log' }) });
      if (res.ok) { const data = await res.json(); setLogs(data.logs || []); }
    } catch { toast('অডিট লগ লোড ব্যর্থ', 'error'); }
    setLoading(false);
  };
  const actionLabels: Record<string, string> = { master_admin_created: 'মাস্টার অ্যাডমিন তৈরি', master_admin_enabled: 'মাস্টার অ্যাডমিন সক্রিয়', master_admin_disabled: 'মাস্টার অ্যাডমিন নিষ্ক্রিয়', master_admin_updated: 'মাস্টার অ্যাডমিন আপডেট', master_admin_password_reset: 'মাস্টার অ্যাডমিন পাসওয়ার্ড রিসেট', admin_created: 'অ্যাডমিন তৈরি', admin_enabled: 'অ্যাডমিন সক্রিয়', admin_disabled: 'অ্যাডমিন নিষ্ক্রিয়', admin_revoked: 'অ্যাডমিন অ্যাক্সেস বাতিল', password_reset_requested: 'পাসওয়ার্ড রিসেট অনুরোধ', role_changed: 'রোল পরিবর্তন', permission_changed: 'পারমিশন পরিবর্তন' };
  const formatDateTime = (d: string) => d ? new Date(d).toLocaleString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-bold"><History className="h-5 w-5" /> অডিট লগ</h3><button onClick={onClose}><X className="h-5 w-5" /></button></div>
        {loading ? <div className="h-32 animate-pulse rounded-xl bg-secondary" /> : logs.length === 0 ? <p className="py-8 text-center text-muted-foreground">কোন অডিট লগ নেই</p> : <div className="space-y-2">{logs.map((log) => <div key={log.id} className="rounded-xl border border-border p-3 text-sm"><div className="flex items-center justify-between"><span className="font-medium">{actionLabels[log.action] || log.action}</span><span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span></div><div className="mt-1 text-xs text-muted-foreground"><span>অ্যাক্টর: {log.admin_email || '-'}</span>{log.target_email && <span className="ml-3">টার্গেট: {log.target_email}</span>}</div></div>)}</div>}
      </div>
    </div>
  );
}

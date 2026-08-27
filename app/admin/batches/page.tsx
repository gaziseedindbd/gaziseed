'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Trash2, X, AlertTriangle, Calendar, Package } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminBatchesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name_bn, name_en, stock').eq('is_ads_only', false).order('name_bn');
    setProducts(data || []);
    setLoading(false);
  };

  const loadBatches = async (productId: string) => {
    setSelectedProduct(productId);
    const { data } = await supabase.from('product_batches').select('*').eq('product_id', productId).order('received_date', { ascending: false });
    setBatches(data || []);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ব্যাচ মুছতে চান?')) return;
    await supabase.from('product_batches').delete().eq('id', id);
    toast('ব্যাচ মুছে ফেলা হয়েছে');
    if (selectedProduct) loadBatches(selectedProduct);
  };

  const today = new Date();
  const isExpired = (d: string) => d && new Date(d) < today;
  const isExpiringSoon = (d: string) => { if (!d) return false; const diff = (new Date(d).getTime() - today.getTime()) / (1000 * 60 * 60 * 24); return diff > 0 && diff <= 30; };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">ব্যাচ / এক্সপায়রি ম্যানেজমেন্ট</h1>

      <div className="mb-4">
        <label className="mb-1 block text-sm font-medium">প্রোডাক্ট নির্বাচন করুন</label>
        <select value={selectedProduct} onChange={(e) => loadBatches(e.target.value)} className="input-bangla">
          <option value="">— নির্বাচন করুন —</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name_bn || p.name_en} (স্টক: {p.stock})</option>)}
        </select>
      </div>

      {selectedProduct && (
        <>
          <button onClick={() => setShowForm(true)} className="mb-4 flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-5 w-5" /> নতুন ব্যাচ
          </button>

          <div className="space-y-3">
            {batches.map((b) => (
              <div key={b.id} className={`rounded-2xl border p-4 ${isExpired(b.expiry_date) ? 'border-red-300 bg-red-50' : isExpiringSoon(b.expiry_date) ? 'border-amber-300 bg-amber-50' : 'border-border bg-card'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">ব্যাচ: {b.batch_number || '-'}</p>
                      {b.lot_number && <span className="text-sm text-muted-foreground">লট: {b.lot_number}</span>}
                      {isExpired(b.expiry_date) && <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"><AlertTriangle className="h-3 w-3" /> মেয়াদোত্তীর্ণ</span>}
                      {isExpiringSoon(b.expiry_date) && <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"><Calendar className="h-3 w-3" /> শীঘ্র মেয়াদ শেষ</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-muted-foreground sm:grid-cols-4">
                      <span>স্টক: {b.batch_stock}</span>
                      {b.packing_date && <span>প্যাকিং: {new Date(b.packing_date).toLocaleDateString('bn-BD')}</span>}
                      {b.best_before && <span>বেস্ট বিফোর: {new Date(b.best_before).toLocaleDateString('bn-BD')}</span>}
                      {b.expiry_date && <span>মেয়াদ: {new Date(b.expiry_date).toLocaleDateString('bn-BD')}</span>}
                      {b.supplier && <span>সাপ্লায়ার: {b.supplier}</span>}
                      {b.received_date && <span>গ্রহণ: {new Date(b.received_date).toLocaleDateString('bn-BD')}</span>}
                    </div>
                    {b.notes && <p className="mt-1 text-xs text-muted-foreground">নোট: {b.notes}</p>}
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
            {batches.length === 0 && <p className="p-4 text-center text-muted-foreground">কোন ব্যাচ নেই</p>}
          </div>

          {showForm && <BatchForm productId={selectedProduct} onSave={async (data) => {
            const { error } = await supabase.from('product_batches').insert(data);
            if (error) { toast('যোগ করা ব্যর্থ', 'error'); return; }
            toast('ব্যাচ যোগ করা হয়েছে');
            setShowForm(false);
            loadBatches(selectedProduct);
          }} onClose={() => setShowForm(false)} />}
        </>
      )}
    </div>
  );
}

function BatchForm({ productId, onSave, onClose }: { productId: string; onSave: (data: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    batch_number: '', lot_number: '', supplier: '', received_date: '', packing_date: '', best_before: '', expiry_date: '', batch_stock: 0, notes: '', status: 'active',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...form, product_id: productId, batch_stock: Number(form.batch_stock), received_date: form.received_date || null, packing_date: form.packing_date || null, best_before: form.best_before || null, expiry_date: form.expiry_date || null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">নতুন ব্যাচ</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm font-medium">ব্যাচ নম্বর</label><input value={form.batch_number} onChange={(e) => setForm({ ...form, batch_number: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">লট নম্বর</label><input value={form.lot_number} onChange={(e) => setForm({ ...form, lot_number: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">সাপ্লায়ার</label><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">ব্যাচ স্টক</label><input type="number" value={form.batch_stock} onChange={(e) => setForm({ ...form, batch_stock: Number(e.target.value) })} className="input-bangla" required /></div>
            <div><label className="mb-1 block text-sm font-medium">গ্রহণ তারিখ</label><input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">প্যাকিং তারিখ</label><input type="date" value={form.packing_date} onChange={(e) => setForm({ ...form, packing_date: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">বেস্ট বিফোর</label><input type="date" value={form.best_before} onChange={(e) => setForm({ ...form, best_before: e.target.value })} className="input-bangla" /></div>
            <div><label className="mb-1 block text-sm font-medium">মেয়াদ শেষ</label><input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className="input-bangla" /></div>
          </div>
          <div><label className="mb-1 block text-sm font-medium">নোট</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input-bangla" /></div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">যোগ করুন</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-6 hover:bg-secondary">বাতিল</button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Plus, Edit, Trash2, X, Wand2 } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { processUrlImage, uploadProcessedFile } from '@/lib/image-processing';

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadPosts(); }, []);

  const loadPosts = async () => {
    const { data } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };

  const handleSave = async (formData: any) => {
    try {
      let nextFormData = { ...formData };
      const imageUrl = String(nextFormData.featured_image || '').trim();
      const isExternalUrl = /^https?:\/\//i.test(imageUrl) && !imageUrl.includes('supabase.co/storage/v1/object/public/');

      // External blog images are passed through the same existing watermark pipeline
      // used by the Admin ImageUploader, then stored as a public Supabase image URL.
      if (isExternalUrl) {
        toast('Featured image প্রসেস ও watermark করা হচ্ছে...');
        const processed = await processUrlImage(imageUrl);
        const watermarkedUrl = await uploadProcessedFile(processed, 'product-images', supabase);
        nextFormData.featured_image = watermarkedUrl;
      }

      if (editing) {
        const { error } = await supabase.from('blog_posts').update(nextFormData).eq('id', editing.id);
        if (error) throw error;
        toast('আর্টিকেল আপডেট হয়েছে');
      } else {
        const { error } = await supabase.from('blog_posts').insert(nextFormData);
        if (error) throw error;
        toast('আর্টিকেল যোগ হয়েছে');
      }
      setShowForm(false); setEditing(null); loadPosts();
    } catch (err: any) {
      toast(`আর্টিকেল সেভ ব্যর্থ: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('আর্টিকেল মুছতে চান?')) return;
    await supabase.from('blog_posts').delete().eq('id', id);
    toast('আর্টিকেল মুছে ফেলা হয়েছে');
    loadPosts();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">ব্লগ</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> নতুন আর্টিকেল</button>
      </div>
      <div className="space-y-3">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div className="flex-1">
              <h3 className="font-semibold">{p.title}</h3>
              <p className="text-xs text-muted-foreground">/{p.slug} — {new Date(p.publish_date).toLocaleDateString('bn-BD')}</p>
              <span className={`text-xs ${p.is_published ? 'text-green-600' : 'text-destructive'}`}>{p.is_published ? 'প্রকাশিত' : 'খসড়া'}</span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded p-1.5 hover:bg-secondary"><Edit className="h-4 w-4" /></button>
              <button onClick={() => handleDelete(p.id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {posts.length === 0 && <p className="p-8 text-center text-muted-foreground">কোন আর্টিকেল নেই</p>}
      </div>
      {showForm && <BlogForm post={editing} onSave={handleSave} onClose={() => { setShowForm(false); setEditing(null); }} />}
    </div>
  );
}

function BlogForm({ post, onSave, onClose }: any) {
  const [form, setForm] = useState({
    title: post?.title || '', slug: post?.slug || '', featured_image: post?.featured_image || '',
    content: post?.content || '', category: post?.category || '', seo_title: post?.seo_title || '',
    meta_description: post?.meta_description || '', is_published: post?.is_published ?? false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">{post ? 'আর্টিকেল এডিট' : 'নতুন আর্টিকেল'}</h2><button onClick={onClose}><X className="h-6 w-6" /></button></div>
        <form onSubmit={(e) => { e.preventDefault(); const slug = form.slug || form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); onSave({ ...form, slug }); }} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium">শিরোনাম</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-bangla" required /></div>
          <div><label className="mb-1 block text-sm font-medium">Slug</label><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="input-bangla" placeholder="auto-generated" /></div>
          <div><label className="mb-1 block text-sm font-medium">ক্যাটাগরি</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input-bangla" /></div>
          <div>
            <label className="mb-1 block text-sm font-medium">ফিচার্ড ইমেজ URL</label>
            <p className="mb-1 text-xs text-muted-foreground">Recommended: 1200 × 675 px — Best for display</p>
            <div className="flex gap-2">
              <input value={form.featured_image} onChange={(e) => setForm({ ...form, featured_image: e.target.value })} className="input-bangla flex-1" placeholder="https://..." />
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700" title="External URL save করলে existing watermark pipeline ব্যবহার হবে">
                <Wand2 className="h-3.5 w-3.5" /> Watermark
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">External image URL সেভ করলে existing Image Branding & Watermark settings অনুযায়ী image process হয়ে SEED BARI storage-এ সংরক্ষিত হবে।</p>
          </div>
          <div><label className="mb-1 block text-sm font-medium">কন্টেন্ট</label><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="input-bangla min-h-[200px]" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="accent-primary" /> প্রকাশিত</label>
          <button type="submit" className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary/90">সেভ করুন</button>
        </form>
      </div>
    </div>
  );
}

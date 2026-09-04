'use server';

import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireMasterAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Unauthorized');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'master_admin') throw new Error('Master Admin access required.');
  return supabase;
}

function text(formData: FormData, key: string) { return String(formData.get(key) ?? '').trim(); }
function nullable(value: string) { return value || null; }

export async function saveVideo(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  const country = text(formData, 'country') || 'BD';
  const title = text(formData, 'title');
  const youtubeUrl = text(formData, 'youtube_url');
  const description = text(formData, 'description');
  const sortOrder = Number.parseInt(text(formData, 'sort_order') || '0', 10);
  const active = formData.get('active') === 'on';
  if (!title) throw new Error('Video title is required.');
  if (!youtubeUrl) throw new Error('YouTube URL is required.');
  const payload = { country: country === 'IN' ? 'IN' : 'BD', title, youtube_url: youtubeUrl, description: nullable(description), sort_order: Number.isFinite(sortOrder) ? sortOrder : 0, active };
  if (id) {
    const { error } = await supabase.from('video_gallery').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('video_gallery').insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/cms/videos');
  revalidatePath('/videos');
}

export async function deleteVideo(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  if (!id) throw new Error('Video id is required.');
  const { error } = await supabase.from('video_gallery').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/cms/videos');
  revalidatePath('/videos');
}

export default async function VideosCmsPage() {
  const supabase = await requireMasterAdmin();
  const { data: videos, error } = await supabase.from('video_gallery').select('id,country,title,youtube_url,description,active,sort_order,created_at').order('sort_order', { ascending: true }).order('created_at', { ascending: false });
  if (error) return <main className="p-6 text-red-600">Unable to load videos: {error.message}</main>;
  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/cms" className="text-sm font-bold text-[#1f6b3b]">← CMS & Marketing</Link>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CMS</p>
        <h1 className="mt-1 text-3xl font-black">Video Gallery Management</h1>
        <p className="mt-2 text-gray-500">Add, edit, activate and remove customer-facing YouTube videos.</p>

        <section className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Add new video</h2>
          <form action={saveVideo} className="mt-5 grid gap-4 md:grid-cols-2">
            <input name="title" placeholder="Video title" className="rounded-xl border p-3" />
            <select name="country" defaultValue="BD" className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
            <input name="youtube_url" placeholder="YouTube URL" className="rounded-xl border p-3 md:col-span-2" />
            <textarea name="description" placeholder="Description" rows={4} className="rounded-xl border p-3 md:col-span-2" />
            <input type="number" name="sort_order" defaultValue="0" placeholder="Sort order" className="rounded-xl border p-3" />
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked /> Active</label>
            <div className="md:col-span-2 md:text-right"><button className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white">Save Video</button></div>
          </form>
        </section>

        <section className="mt-8 space-y-5">
          {(videos ?? []).map((video) => (
            <article key={video.id} className="rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{video.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{video.country} · {video.active ? 'Active' : 'Inactive'} · Order {video.sort_order}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/videos/${video.id}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-bold">Open</a>
                  <form action={deleteVideo}><input type="hidden" name="id" value={video.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Delete</button></form>
                </div>
              </div>
              <form action={saveVideo} className="mt-5 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={video.id} />
                <input name="title" defaultValue={video.title} className="rounded-xl border p-3" />
                <select name="country" defaultValue={video.country} className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
                <input name="youtube_url" defaultValue={video.youtube_url} className="rounded-xl border p-3 md:col-span-2" />
                <textarea name="description" defaultValue={video.description ?? ''} rows={4} className="rounded-xl border p-3 md:col-span-2" />
                <input type="number" name="sort_order" defaultValue={video.sort_order ?? 0} className="rounded-xl border p-3" />
                <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={video.active} /> Active</label>
                <div className="md:col-span-2 md:text-right"><button className="rounded-xl border px-5 py-3 font-bold">Update Video</button></div>
              </form>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

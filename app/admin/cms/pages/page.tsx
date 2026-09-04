import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAdminContext } from "@/lib/seed-bari/admin";

const COUNTRIES = ["BD", "IN"] as const;

type PageRow = {
  id: string;
  country: string | null;
  page_type: string;
  slug: string;
  title_bn: string;
  title_en: string;
  content_bn: string;
  content_en: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

async function requireMasterAdmin() {
  const context = await getCurrentAdminContext();
  if (!context || context.role !== "master_admin") redirect("/");
}

async function savePage(formData: FormData) {
  "use server";
  await requireMasterAdmin();
  const supabase = await createClient();

  const id = String(formData.get("id") || "").trim();
  const country = String(formData.get("country") || "").trim() || null;
  const pageType = String(formData.get("page_type") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const titleBn = String(formData.get("title_bn") || "").trim();
  const titleEn = String(formData.get("title_en") || "").trim();
  const contentBn = String(formData.get("content_bn") || "").trim();
  const contentEn = String(formData.get("content_en") || "").trim();
  const active = formData.get("active") === "on";

  if (!pageType || !slug || !titleBn || !titleEn) {
    throw new Error("Page type, slug, and both titles are required.");
  }
  if (country && !COUNTRIES.includes(country as (typeof COUNTRIES)[number])) {
    throw new Error("Invalid country.");
  }

  const payload = {
    country,
    page_type: pageType,
    slug,
    title_bn: titleBn,
    title_en: titleEn,
    content_bn: contentBn,
    content_en: contentEn,
    active,
  };

  const query = id
    ? supabase.from("content_pages").update(payload).eq("id", id)
    : supabase.from("content_pages").insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/admin/cms/pages");
  revalidatePath("/");
}

async function deletePage(formData: FormData) {
  "use server";
  await requireMasterAdmin();
  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Page id is required.");

  const supabase = await createClient();
  const { error } = await supabase.from("content_pages").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/cms/pages");
  revalidatePath("/");
}

export default async function ContentPagesAdmin() {
  await requireMasterAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_pages")
    .select("id,country,page_type,slug,title_bn,title_en,content_bn,content_en,active,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  const pages = (data ?? []) as PageRow[];

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header>
        <p className="text-sm text-gray-500">SEED BARI CMS</p>
        <h1 className="text-3xl font-semibold">Content Pages</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage static and policy pages by country with bilingual content.
        </p>
      </header>

      <form action={savePage} className="grid gap-4 rounded-xl border p-5 md:grid-cols-2">
        <input name="id" type="hidden" />
        <label className="space-y-1">
          <span className="text-sm font-medium">Page Type</span>
          <input name="page_type" className="w-full rounded border px-3 py-2" placeholder="privacy_policy" required />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Slug</span>
          <input name="slug" className="w-full rounded border px-3 py-2" placeholder="privacy-policy" required />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Country</span>
          <select name="country" className="w-full rounded border px-3 py-2" defaultValue="">
            <option value="">Global</option>
            <option value="BD">Bangladesh</option>
            <option value="IN">India</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Active</span>
          <span className="flex items-center gap-2 pt-2">
            <input name="active" type="checkbox" defaultChecked />
            <span className="text-sm">Published</span>
          </span>
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Title (বাংলা)</span>
          <input name="title_bn" className="w-full rounded border px-3 py-2" required />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Title (English)</span>
          <input name="title_en" className="w-full rounded border px-3 py-2" required />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Content (বাংলা)</span>
          <textarea name="content_bn" className="min-h-40 w-full rounded border px-3 py-2" />
        </label>
        <label className="space-y-1">
          <span className="text-sm font-medium">Content (English)</span>
          <textarea name="content_en" className="min-h-40 w-full rounded border px-3 py-2" />
        </label>
        <div className="md:col-span-2">
          <button className="rounded bg-black px-4 py-2 text-white" type="submit">
            Save Page
          </button>
        </div>
      </form>

      <section className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-gray-50 text-left">
            <tr>
              <th className="p-3">Page</th>
              <th className="p-3">Type</th>
              <th className="p-3">Country</th>
              <th className="p-3">Status</th>
              <th className="p-3">Updated</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-b last:border-0">
                <td className="p-3">
                  <div className="font-medium">{page.title_en}</div>
                  <div className="text-gray-500">/{page.slug}</div>
                </td>
                <td className="p-3">{page.page_type}</td>
                <td className="p-3">{page.country ?? "Global"}</td>
                <td className="p-3">{page.active ? "Active" : "Inactive"}</td>
                <td className="p-3">{new Date(page.updated_at).toLocaleString()}</td>
                <td className="p-3">
                  <form action={deletePage}>
                    <input type="hidden" name="id" value={page.id} />
                    <button type="submit" className="rounded border px-3 py-1 text-red-600">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No content pages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

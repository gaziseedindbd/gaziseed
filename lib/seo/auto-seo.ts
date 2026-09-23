export type AutoSeoProductInput = {
  name_bn?: string | null;
  name_en?: string | null;
  slug?: string | null;
  short_description?: string | null;
  description?: string | null;
  category_name_bn?: string | null;
  brand?: string | null;
  sku?: string | null;
  image?: string | null;
  image_alt?: string | null;
  image_alt_bn?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
};

function cleanText(value: unknown): string {
  return String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function trimAt(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const boundary = cut.lastIndexOf(' ');
  return (boundary > max * 0.75 ? cut.slice(0, boundary) : cut).trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function generateProductSeo(input: AutoSeoProductInput) {
  const name = cleanText(input.name_bn) || cleanText(input.name_en) || 'GAZI SEED Product';
  const englishName = cleanText(input.name_en) || name;
  const category = cleanText(input.category_name_bn);
  const brand = cleanText(input.brand) || 'GAZI SEED';
  const sourceDescription = cleanText(input.short_description) || cleanText(input.description);
  const slug = cleanText(input.slug) || slugify(englishName) || slugify(name);

  const seoTitle = trimAt(
    cleanText(input.seo_title) || (category ? `${name} | ${category} | GAZI SEED` : `${name} | GAZI SEED`),
    60,
  );

  const metaDescription = trimAt(
    cleanText(input.meta_description) ||
      `${name} — ${sourceDescription || 'মানসম্মত বীজ ও কৃষি পণ্য'}। ${brand} থেকে অনলাইনে অর্ডার করুন।`,
    160,
  );

  const imageAltBn = cleanText(input.image_alt_bn) || `${name} - GAZI SEED`;
  const imageAlt = cleanText(input.image_alt) || `${englishName} - GAZI SEED`;

  return {
    slug,
    seo_title: seoTitle,
    meta_description: metaDescription,
    image_alt_bn: imageAltBn,
    image_alt: imageAlt,
  };
}

export function generateProductAeoSummary(input: AutoSeoProductInput): string {
  const name = cleanText(input.name_bn) || cleanText(input.name_en) || 'এই পণ্য';
  const category = cleanText(input.category_name_bn);
  const description = cleanText(input.short_description) || cleanText(input.description);
  return [`${name} কী?`, `${name}${category ? ` হলো ${category} ক্যাটাগরির` : ''} একটি পণ্য।`, description]
    .filter(Boolean)
    .join(' ');
}

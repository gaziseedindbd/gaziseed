import { ImageResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase environment variables are missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

function getImageUrl(combo: any) {
  const image = Array.isArray(combo?.images) ? combo.images[0] : combo?.images || combo?.image;
  return typeof image === 'string' && /^https?:\/\//i.test(image) ? image : null;
}

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const supabase = getSupabase();
    const { data: combo, error } = await supabase
      .from('combo_packs')
      .select('title_bn,title_en,description_bn,description_en,images,image')
      .eq('slug', params.slug)
      .maybeSingle();

    if (error || !combo) {
      return new Response('Combo not found', { status: 404 });
    }

    const title = combo.title_bn || combo.title_en || 'Combo Offer';
    const description = combo.description_bn || combo.description_en || 'GAZI SEED';
    const imageUrl = getImageUrl(combo);

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            position: 'relative',
            background: '#0f2a1d',
            overflow: 'hidden',
            fontFamily: 'Arial',
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              width="1200"
              height="630"
              style={{ objectFit: 'cover', width: '1200px', height: '630px' }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              padding: '34px 48px',
              background: 'linear-gradient(transparent, rgba(0,0,0,0.88))',
              color: 'white',
            }}
          >
            <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.15 }}>
              {title}
            </div>
            <div
              style={{
                fontSize: 24,
                marginTop: 12,
                opacity: 0.9,
                maxWidth: 1050,
                overflow: 'hidden',
              }}
            >
              {description}
            </div>
            <div style={{ fontSize: 20, marginTop: 12, color: '#fbbf24', fontWeight: 700 }}>
              GAZI SEED
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error) {
    console.error('Combo OG image generation failed:', error);
    return new Response('Failed to generate OG image', { status: 500 });
  }
}
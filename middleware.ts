import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathMatch = request.nextUrl.pathname.match(/^\/(in|bd)\/product(?:\/|$)/i);
  const routeCountry = pathMatch?.[1]?.toUpperCase() === 'IN' ? 'IN' : pathMatch?.[1]?.toUpperCase() === 'BD' ? 'BD' : null;
  const forwardedHeaders = new Headers(request.headers);
  if (routeCountry) forwardedHeaders.set('x-gazi-route-country', routeCountry);

  let response = NextResponse.next({ request: { headers: forwardedHeaders } });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          const updatedHeaders = new Headers(request.headers);
          if (routeCountry) updatedHeaders.set('x-gazi-route-country', routeCountry);
          response = NextResponse.next({ request: { headers: updatedHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });

    // Refresh a stale session before Server Components read it. This is not an
    // authorization check; protected APIs and pages still verify the user.
    try {
      await supabase.auth.getClaims();
    } catch {
      // Public pages, including the Messenger payment handoff, must remain
      // available if the Auth service is temporarily unreachable.
    }
  }

  // Keep the selected branch available to checkout and client data requests
  // after navigation leaves the branch-specific product URL.
  if (routeCountry) {
    response.cookies.set('gazi_route_country', routeCountry, {
      path: '/',
      sameSite: 'lax',
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

import { MetadataRoute } from 'next';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.gaziseed.com').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/*', '/account', '/cart', '/checkout', '/order-success', '/login', '/register', '/force-password-change'],
      },
    ],
    sitemap: SITE_URL + '/sitemap.xml',
  };
}

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/*', '/account', '/cart', '/checkout', '/order-success', '/login', '/register', '/force-password-change'],
      },
    ],
    sitemap: '/sitemap.xml',
  };
}

import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mobilehubbd.tech').replace(/\/+$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/admin/*',
        '/account',
        '/account/*',
        '/checkout',
        '/checkout/*',
        '/cart',
        '/cart/*',
        '/api',
        '/api/*',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

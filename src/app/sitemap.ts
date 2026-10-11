import { MetadataRoute } from 'next';
import { API_BASE_URL } from '@/lib/api-client';

export const revalidate = 3600;

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function flattenCategories(categories: any[]): any[] {
  const list: any[] = [];
  function recurse(items: any[]) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item && item.slug) {
        list.push(item);
      }
      if (item?.children && item.children.length > 0) {
        recurse(item.children);
      }
    }
  }
  recurse(categories);
  return list;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mobilehubbd.tech').replace(/\/+$/, '');
  const apiUrl = API_BASE_URL;

  // 1. Static storefront routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/phones`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  // 2. Dynamic active categories
  let categoryRoutes: MetadataRoute.Sitemap = [];
  try {
    const json = await fetchWithTimeout(`${apiUrl}/categories/tree`);
    if (json && Array.isArray(json)) {
      const flattened = flattenCategories(json);
      const seenCategorySlugs = new Set<string>();

      // Include all-products category index
      categoryRoutes.push({
        url: `${baseUrl}/category/all`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });

      for (const cat of flattened) {
        if (cat.slug && !seenCategorySlugs.has(cat.slug) && cat.status !== 'INACTIVE') {
          seenCategorySlugs.add(cat.slug);
          categoryRoutes.push({
            url: `${baseUrl}/category/${cat.slug}`,
            lastModified: cat.updatedAt ? new Date(cat.updatedAt) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch categories for sitemap:', err);
  }

  // 3. Dynamic published products
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const json = await fetchWithTimeout(`${apiUrl}/products?limit=100&page=1`);
    if (json) {
      const rawProducts = Array.isArray(json) ? json : json.data || [];
      const seenProductSlugs = new Set<string>();

      for (const p of rawProducts) {
        if (p && p.slug && !seenProductSlugs.has(p.slug) && p.status === 'ACTIVE') {
          seenProductSlugs.add(p.slug);
          productRoutes.push({
            url: `${baseUrl}/product/${p.slug}`,
            lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
          });
        }
      }

      // If more pages exist, fetch next pages up to 500 products
      const totalPages = json.meta?.totalPages || 1;
      for (let page = 2; page <= Math.min(totalPages, 5); page++) {
        const nextJson = await fetchWithTimeout(`${apiUrl}/products?limit=100&page=${page}`);
        const nextProducts = Array.isArray(nextJson) ? nextJson : nextJson?.data || [];
        for (const p of nextProducts) {
          if (p && p.slug && !seenProductSlugs.has(p.slug) && p.status === 'ACTIVE') {
            seenProductSlugs.add(p.slug);
            productRoutes.push({
              url: `${baseUrl}/product/${p.slug}`,
              lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
              changeFrequency: 'weekly',
              priority: 0.8,
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch products for sitemap:', err);
  }

  // 4. Dynamic published blog posts
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const json = await fetchWithTimeout(`${apiUrl}/blogs?limit=100`);
    if (json) {
      const rawBlogs = Array.isArray(json) ? json : json.data || [];
      const seenBlogSlugs = new Set<string>();

      for (const b of rawBlogs) {
        if (b && b.slug && !seenBlogSlugs.has(b.slug) && (b.status === 'PUBLISHED' || !b.status)) {
          seenBlogSlugs.add(b.slug);
          blogRoutes.push({
            url: `${baseUrl}/blog/${b.slug}`,
            lastModified: b.updatedAt ? new Date(b.updatedAt) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch blogs for sitemap:', err);
  }

  return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...blogRoutes];
}

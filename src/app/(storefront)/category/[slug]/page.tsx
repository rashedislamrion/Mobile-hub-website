import type { Metadata } from 'next';
import CategoryClientView from './CategoryClientView';
import { API_BASE_URL } from '@/lib/api-client';

interface CategoryPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const slug = params.slug;
  const canonicalUrl = `/category/${slug}`;

  if (slug === 'all') {
    return {
      title: 'All Products',
      description:
        'Explore all original smartphone displays, batteries, accessories, and spare parts available at MobileHubBD in Bangladesh.',
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: 'All Products | MobileHubBD',
        description:
          'Explore all original smartphone displays, batteries, accessories, and spare parts available at MobileHubBD in Bangladesh.',
        url: canonicalUrl,
        siteName: 'MobileHubBD',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'All Products | MobileHubBD',
        description:
          'Explore all original smartphone displays, batteries, accessories, and spare parts available at MobileHubBD in Bangladesh.',
      },
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/categories/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const cat = await res.json();
      const rawTitle = cat?.metaTitle || cat?.name || slug;
      const title = rawTitle.includes('MobileHubBD') ? rawTitle : `${rawTitle} | MobileHubBD`;
      const description =
        cat?.metaDescription ||
        cat?.description ||
        `Buy authentic ${cat?.name || slug} parts, screens, and accessories at the best prices with warranty at MobileHubBD.`;
      const images = cat?.image ? [cat.image] : undefined;

      return {
        title: rawTitle,
        description,
        alternates: {
          canonical: canonicalUrl,
        },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          siteName: 'MobileHubBD',
          images: images ? images.map((img: string) => ({ url: img, alt: cat?.name || 'Category' })) : undefined,
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images,
        },
      };
    }
  } catch (e) {
    // Fall back to slug formatting
  }

  const formattedName = slug
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');

  return {
    title: formattedName,
    description: `Shop genuine ${formattedName} spare parts and accessories with official warranty at MobileHubBD.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${formattedName} | MobileHubBD`,
      description: `Shop genuine ${formattedName} spare parts and accessories with official warranty at MobileHubBD.`,
      url: canonicalUrl,
      siteName: 'MobileHubBD',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${formattedName} | MobileHubBD`,
      description: `Shop genuine ${formattedName} spare parts and accessories with official warranty at MobileHubBD.`,
    },
  };
}

export default function CategoryPage({ params }: CategoryPageProps) {
  return <CategoryClientView params={params} />;
}

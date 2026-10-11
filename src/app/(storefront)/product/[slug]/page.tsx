import type { Metadata } from 'next';
import ProductDetailClientView from './ProductDetailClientView';
import { API_BASE_URL, getImageUrl } from '@/lib/api-client';

interface ProductPageProps {
  params: { slug: string };
}

async function getProductData(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/products/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const slug = params.slug;
  const canonicalUrl = `/product/${slug}`;
  const product = await getProductData(slug);

  if (!product) {
    const formattedName = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return {
      title: formattedName,
      description: `Buy ${formattedName} at MobileHubBD in Bangladesh. Best price, genuine quality, and official warranty.`,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: `${formattedName} | MobileHubBD`,
        description: `Buy ${formattedName} at MobileHubBD in Bangladesh. Best price, genuine quality, and official warranty.`,
        url: canonicalUrl,
        siteName: 'MobileHubBD',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${formattedName} | MobileHubBD`,
        description: `Buy ${formattedName} at MobileHubBD in Bangladesh. Best price, genuine quality, and official warranty.`,
      },
    };
  }

  const rawTitle = product.metaTitle || product.name;
  const title = rawTitle.includes('MobileHubBD')
    ? rawTitle
    : `${rawTitle} | MobileHubBD`;

  const description =
    product.metaDescription ||
    product.shortDescription ||
    `Buy genuine ${product.name} at MobileHubBD in Bangladesh. Best price, fast delivery, and authentic warranty support.`;

  const primaryImage =
    product.images?.[0]?.url || product.ogImageUrl || null;
  const resolvedImageUrl = primaryImage ? getImageUrl(primaryImage) : undefined;

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
      images: resolvedImageUrl
        ? [
            {
              url: resolvedImageUrl,
              alt: product.name,
            },
          ]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: resolvedImageUrl ? [resolvedImageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const product = await getProductData(params.slug);
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mobilehubbd.tech').replace(/\/+$/, '');

  let jsonLd: any = null;
  if (product) {
    const primaryImage =
      product.images?.[0]?.url || product.ogImageUrl || null;
    const resolvedImageUrl = primaryImage ? getImageUrl(primaryImage) : undefined;

    const price = product.salePrice
      ? Number(product.salePrice)
      : Number(product.regularPrice || 0);

    const isInStock =
      product.totalStock > 0 ||
      (Array.isArray(product.variants) &&
        product.variants.some((v: any) => (v.stock || 0) > 0));

    jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      image: resolvedImageUrl ? [resolvedImageUrl] : [],
      description:
        product.metaDescription ||
        product.shortDescription ||
        product.description ||
        `Genuine ${product.name} available at MobileHubBD.`,
      sku: product.variants?.[0]?.sku || product.code || product.id,
      brand: {
        '@type': 'Brand',
        name: product.brand?.name || 'MobileHubBD',
      },
      offers: {
        '@type': 'Offer',
        url: `${baseUrl}/product/${product.slug || params.slug}`,
        priceCurrency: 'BDT',
        price: isNaN(price) ? 0 : price,
        availability: isInStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: 'MobileHubBD',
        },
      },
    };
  }

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductDetailClientView params={params} />
    </>
  );
}

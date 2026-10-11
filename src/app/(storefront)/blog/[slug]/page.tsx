import type { Metadata } from 'next';
import BlogPostClientView from './BlogPostClientView';
import { API_BASE_URL, getImageUrl } from '@/lib/api-client';

interface BlogPageProps {
  params: { slug: string };
}

async function getBlogData(slug: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/blogs/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    return null;
  }
}

export async function generateMetadata({ params }: BlogPageProps): Promise<Metadata> {
  const slug = params.slug;
  const canonicalUrl = `/blog/${slug}`;
  const formattedTitle = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const blog = await getBlogData(slug);

  if (!blog) {
    return {
      title: formattedTitle,
      description: `Read ${formattedTitle} on the MobileHubBD blog. Technical repair guides, gadget reviews, and smartphone tips.`,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        title: `${formattedTitle} | MobileHubBD`,
        description: `Read ${formattedTitle} on the MobileHubBD blog. Technical repair guides, gadget reviews, and smartphone tips.`,
        url: canonicalUrl,
        siteName: 'MobileHubBD',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${formattedTitle} | MobileHubBD`,
        description: `Read ${formattedTitle} on the MobileHubBD blog. Technical repair guides, gadget reviews, and smartphone tips.`,
      },
    };
  }

  const rawTitle = blog.metaTitle || blog.title || formattedTitle;
  const title = rawTitle.includes('MobileHubBD') ? rawTitle : `${rawTitle} | MobileHubBD`;
  const description =
    blog.metaDescription ||
    blog.excerpt ||
    `Read ${blog.title} on MobileHubBD. Technical guides and genuine smartphone hardware knowledge.`;

  const primaryImage = blog.image || blog.coverImage || null;
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
              alt: blog.title || 'Blog Post',
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

export default function BlogPostPage({ params }: BlogPageProps) {
  return <BlogPostClientView params={params} />;
}

import type { Metadata } from 'next';
import BlogListingClientView from './BlogListingClientView';

export const metadata: Metadata = {
  title: 'Blog & Technical Guides',
  description:
    'Mobile repair tutorials, smartphone hardware maintenance guides, news, and insights from MobileHubBD.',
  alternates: {
    canonical: '/blog',
  },
  openGraph: {
    title: 'Blog & Technical Guides | MobileHubBD',
    description:
      'Mobile repair tutorials, smartphone hardware maintenance guides, news, and insights from MobileHubBD.',
    url: '/blog',
    siteName: 'MobileHubBD',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog & Technical Guides | MobileHubBD',
    description:
      'Mobile repair tutorials, smartphone hardware maintenance guides, news, and insights from MobileHubBD.',
  },
};

export default function BlogListingPage() {
  return <BlogListingClientView />;
}

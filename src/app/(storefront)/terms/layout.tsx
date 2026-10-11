import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of service, warranty conditions, purchase agreements, and repair policies for MobileHubBD.',
  alternates: {
    canonical: '/terms',
  },
  openGraph: {
    title: 'Terms of Service | MobileHubBD',
    description:
      'Terms of service, warranty conditions, purchase agreements, and repair policies for MobileHubBD.',
    url: '/terms',
    siteName: 'MobileHubBD',
  },
  twitter: {
    card: 'summary',
    title: 'Terms of Service | MobileHubBD',
    description:
      'Terms of service, warranty conditions, purchase agreements, and repair policies for MobileHubBD.',
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy policy, personal data protection, and customer information handling at MobileHubBD.',
  alternates: {
    canonical: '/privacy',
  },
  openGraph: {
    title: 'Privacy Policy | MobileHubBD',
    description:
      'Privacy policy, personal data protection, and customer information handling at MobileHubBD.',
    url: '/privacy',
    siteName: 'MobileHubBD',
  },
  twitter: {
    card: 'summary',
    title: 'Privacy Policy | MobileHubBD',
    description:
      'Privacy policy, personal data protection, and customer information handling at MobileHubBD.',
  },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

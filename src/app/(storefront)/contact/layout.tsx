import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Contact MobileHubBD for smartphone spare parts, screen replacements, accessories, and warranty support in Dhaka, Bangladesh.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact Us | MobileHubBD',
    description:
      'Contact MobileHubBD for smartphone spare parts, screen replacements, accessories, and warranty support in Dhaka, Bangladesh.',
    url: '/contact',
    siteName: 'MobileHubBD',
  },
  twitter: {
    card: 'summary',
    title: 'Contact Us | MobileHubBD',
    description:
      'Contact MobileHubBD for smartphone spare parts, screen replacements, accessories, and warranty support in Dhaka, Bangladesh.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

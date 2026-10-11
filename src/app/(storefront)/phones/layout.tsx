import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Original Smartphones & Devices',
  description:
    'Explore brand new and pre-owned smartphones with official warranty, verified IMEI, and the best prices at MobileHubBD.',
  alternates: {
    canonical: '/phones',
  },
  openGraph: {
    title: 'Original Smartphones & Devices | MobileHubBD',
    description:
      'Explore brand new and pre-owned smartphones with official warranty, verified IMEI, and the best prices at MobileHubBD.',
    url: '/phones',
    siteName: 'MobileHubBD',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Original Smartphones & Devices | MobileHubBD',
    description:
      'Explore brand new and pre-owned smartphones with official warranty, verified IMEI, and the best prices at MobileHubBD.',
  },
};

export default function PhonesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

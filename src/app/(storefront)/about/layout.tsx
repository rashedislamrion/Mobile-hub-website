import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    "Learn about MobileHubBD, Bangladesh's trusted platform for genuine smartphone parts, displays, batteries, accessories, and professional repair services.",
  alternates: {
    canonical: '/about',
  },
  openGraph: {
    title: 'About Us | MobileHubBD',
    description:
      "Learn about MobileHubBD, Bangladesh's trusted platform for genuine smartphone parts, displays, batteries, accessories, and professional repair services.",
    url: '/about',
    siteName: 'MobileHubBD',
  },
  twitter: {
    card: 'summary',
    title: 'About Us | MobileHubBD',
    description:
      "Learn about MobileHubBD, Bangladesh's trusted platform for genuine smartphone parts, displays, batteries, accessories, and professional repair services.",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

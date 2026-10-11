"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { 
  Phone, Mail, MapPin, 
  ShieldCheck, Truck, RefreshCw, Headphones, MessageCircle, Share2 
} from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { OFFICIAL_CONTACT } from "@/config/contact";
import { SHOW_PAYMENT_STRIP } from "@/config/site";

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...props}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...props}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...props}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...props}>
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

function TiktokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" {...props}>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.98-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

const platformIcons: Record<string, React.ReactNode> = {
  FACEBOOK: <FacebookIcon className="w-5 h-5" />,
  INSTAGRAM: <InstagramIcon className="w-5 h-5" />,
  YOUTUBE: <YoutubeIcon className="w-5 h-5" />,
  LINKEDIN: <LinkedinIcon className="w-5 h-5" />,
  WHATSAPP: <MessageCircle className="w-5 h-5" />,
  TIKTOK: <TiktokIcon className="w-5 h-5" />,
};

export function Footer() {
  const [footerData, setFooterData] = useState<any>(null);
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [footerPublic, socials, branchList] = await Promise.all([
          apiGet<any>("/footer/public").catch(() => null),
          apiGet<any[]>("/social-links").catch(() => []),
          apiGet<any[]>("/branches/public").catch(() => []),
        ]);
        setFooterData(footerPublic);
        setSocialLinks(socials || []);
        setBranches(branchList || []);
      } catch (e) {
        console.error("Failed to load footer data", e);
      }
    })();
  }, []);

  const footerSettings = footerData?.settings;
  const columns: any[] = footerData?.columns || [];

  const supportCol = columns.find((c) => c.key === "support");
  const aboutCol = columns.find((c) => c.key === "about_us");
  const quickCol = columns.find((c) => c.key === "quick_links");
  const branchCol = columns.find((c) => c.key === "branches");

  // First support contact item info
  const supportContactItem = supportCol?.items?.[0];

  return (
    <footer className="bg-slate-900 text-slate-300">
      {/* Features Bar */}
      <div className="border-b border-slate-800 bg-slate-950/40">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">100% Genuine Parts</h4>
                <p className="text-xs text-slate-400">Directly sourced verified spares</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Fast Express Delivery</h4>
                <p className="text-xs text-slate-400">Nationwide courier coverage</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Warranty & Return</h4>
                <p className="text-xs text-slate-400">Hassle-free replacement policy</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                <Headphones className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">Dedicated Support</h4>
                <p className="text-xs text-slate-400">Expert diagnosis & assistance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="text-2xl font-extrabold text-white tracking-tight">
              MobileHubBD
            </Link>
            <p className="text-sm text-slate-400 max-w-sm">
              Bangladesh's leading platform for genuine smartphone displays, batteries, accessories, and professional repair services.
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>
                  {supportContactItem?.extraData?.phone ||
                    footerSettings?.supportPhone ||
                    OFFICIAL_CONTACT.phone.display}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{footerSettings?.supportEmail || OFFICIAL_CONTACT.email}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="font-medium text-slate-300">Support Hours:</span>
                <span>
                  {supportContactItem?.extraData?.availableTime ||
                    OFFICIAL_CONTACT.openingHours.display}
                </span>
              </div>
            </div>

            {/* Social Links */}
            {socialLinks.filter((s) => s.url && s.url.trim() !== "" && s.url.trim() !== "#").length > 0 && (
              <div className="flex items-center gap-3 pt-3">
                {socialLinks
                  .filter((s) => s.url && s.url.trim() !== "" && s.url.trim() !== "#")
                  .map((social) => (
                    <a
                      key={social.id}
                      href={social.url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-9 h-9 rounded-lg bg-slate-800 text-slate-300 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-colors"
                      title={social.platform}
                      aria-label={social.platform ? `${social.platform} Link` : "Social Link"}
                    >
                      {platformIcons[social.platform] || <MessageCircle className="w-4 h-4" />}
                    </a>
                  ))}
              </div>
            )}
          </div>

          {/* Quick Links Column */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              {quickCol?.title || "Quick Links"}
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              {quickCol?.items && quickCol.items.length > 0 ? (
                quickCol.items.map((item: any) => (
                  <li key={item.id}>
                    <Link
                      href={item.url || "#"}
                      className="hover:text-emerald-400 transition-colors"
                    >
                      {item.navigationLabel}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li><Link href="/category/all" className="hover:text-emerald-400 transition-colors">All Products</Link></li>
                  <li><Link href="/terms" className="hover:text-emerald-400 transition-colors">Terms of Service</Link></li>
                  <li><Link href="/privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</Link></li>
                </>
              )}
            </ul>
          </div>

          {/* About Us / Information Column */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-white">
              {aboutCol?.title || "About Us"}
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              {aboutCol?.items && aboutCol.items.length > 0 ? (
                aboutCol.items.map((item: any) => (
                  <li key={item.id}>
                    <Link
                      href={item.url || "#"}
                      className="hover:text-emerald-400 transition-colors"
                    >
                      {item.navigationLabel}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li><Link href="/about" className="hover:text-emerald-400 transition-colors">About Us</Link></li>
                  <li><Link href="/blog" className="hover:text-emerald-400 transition-colors">News & Articles</Link></li>
                  <li><Link href="/contact" className="hover:text-emerald-400 transition-colors">Contact Us</Link></li>
                </>
              )}
            </ul>
          </div>

          {/* Outlets / Branches Column */}
          {branches.filter((b: any) => (b.status === "ACTIVE" || !b.status) && b.name).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-white">
                {branchCol?.title || "Our Outlets"}
              </h4>
              <ul className="space-y-3 text-sm text-slate-400">
                {branches
                  .filter((b: any) => (b.status === "ACTIVE" || !b.status) && b.name)
                  .slice(0, 4)
                  .map((b: any) => (
                    <li key={b.id} className="text-xs">
                      <span className="font-semibold text-slate-200 block">{b.name}</span>
                      {b.address && (
                        <span className="text-slate-400 truncate block">{b.address}{b.city ? `, ${b.city}` : ""}</span>
                      )}
                      {b.phone && (
                        <span className="text-emerald-400 text-[11px] block">{b.phone}</span>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Payment Methods Strip */}
      {SHOW_PAYMENT_STRIP && (
        <div className="container mx-auto px-4 my-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/20 p-2 sm:p-3 overflow-x-auto">
            <div className="min-w-[900px] flex items-center justify-center">
              <Image
                src="/images/payments/pay-with-strip.png"
                alt="Supported payment methods: bKash, Nagad, Rocket, Upay, Visa, Mastercard, AMEX, Internet Banking - Verified by SSLCOMMERZ"
                width={2708}
                height={138}
                className="w-full h-auto object-contain select-none"
                sizes="(max-width: 1280px) 100vw, 1200px"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}

      {/* Copyright Strip */}
      <div className="border-t border-slate-800 py-6 bg-slate-950">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>{footerSettings?.copyrightText || "© 2026 MobileHubBD. All rights reserved."}</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="hover:text-emerald-400">Terms</Link>
            <Link href="/privacy" className="hover:text-emerald-400">Privacy</Link>
            <Link href="/contact" className="hover:text-emerald-400">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

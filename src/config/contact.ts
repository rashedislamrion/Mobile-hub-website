export const OFFICIAL_CONTACT = {
  storeName: "MobileHubBD",
  phone: {
    display: "01602670922",
    tel: "+8801602670922",
    whatsappNumber: "8801602670922",
    whatsappUrl: "https://wa.me/8801602670922",
  },
  email: "mobilehubbd2@gmail.com",
  address: {
    en: "2/13 Eastern Plaza Shopping Complex, Hatirpool, Dhaka 1205",
    bn: "২/১৩ ইস্টার্ন প্লাজা শপিং কমপ্লেক্স, হাতিরপুল, ঢাকা ১২০৫",
  },
  openingHours: {
    display: "Saturday to Thursday, 9:00 AM - 10:00 PM",
    days: "Saturday to Thursday",
    hours: "9:00 AM - 10:00 PM",
    closed: "Friday",
    daysBn: "শনিবার - বৃহস্পতিবার",
    hoursBn: "সকাল ৯:০০ - রাত ১০:০০",
    closedBn: "শুক্রবার বন্ধ",
  },
  website: "www.mobilehubbd.tech",
  siteUrl: "https://mobilehubbd.tech",
} as const;

/**
 * Normalizes any Bangladeshi phone number (e.g. "01602670922", "+8801602670922", "880 1602-670922")
 * into international tel format "+8801602670922".
 */
export function formatPhoneForTel(phone?: string | null): string {
  if (!phone || !phone.trim()) return OFFICIAL_CONTACT.phone.tel;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("880") && digits.length >= 13) {
    return `+${digits}`;
  }
  if (digits.startsWith("01") && digits.length === 11) {
    return `+88${digits}`;
  }
  if (digits.startsWith("1") && digits.length === 10) {
    return `+880${digits}`;
  }
  return phone.startsWith("+") ? phone : `+${phone}`;
}

/**
 * Normalizes any Bangladeshi phone number into WhatsApp format "8801602670922".
 */
export function formatPhoneForWhatsApp(phone?: string | null): string {
  if (!phone || !phone.trim()) return OFFICIAL_CONTACT.phone.whatsappNumber;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("880") && digits.length >= 13) {
    return digits;
  }
  if (digits.startsWith("01") && digits.length === 11) {
    return `88${digits}`;
  }
  if (digits.startsWith("1") && digits.length === 10) {
    return `880${digits}`;
  }
  return digits || OFFICIAL_CONTACT.phone.whatsappNumber;
}

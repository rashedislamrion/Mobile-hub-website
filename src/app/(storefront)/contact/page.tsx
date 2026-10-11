"use client";

import { useState, useEffect } from "react";
import { 
  Mail, Phone, MapPin, Send, Loader2, CheckCircle2, MessageSquare 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost } from "@/lib/api-client";
import { OFFICIAL_CONTACT } from "@/config/contact";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [footerSettings, setFooterSettings] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [settings, branchList] = await Promise.all([
          apiGet<any>("/footer-settings").catch(() => null),
          apiGet<any[]>("/branches/public").catch(() => []),
        ]);
        setFooterSettings(settings);
        setBranches(branchList || []);
      } catch (e) {
        console.error("Failed to load contact info", e);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in your name, email, and message.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/contact-submissions", {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        subject: subject.trim() || undefined,
        message: message.trim(),
      });
      setIsSuccess(true);
      toast.success("Thank you! Your message has been sent successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-6xl">
      <div className="text-center max-w-xl mx-auto mb-12 space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Contact Us</h1>
        <p className="text-slate-500 text-sm">
          Have questions about a smartphone part, repair service, or bulk order? Get in touch with our team.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Info Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 text-white rounded-3xl p-8 space-y-6 shadow-md">
            <h2 className="text-xl font-bold">Contact Information</h2>
            <p className="text-slate-300 text-sm">
              Our customer care and technical support team is available {OFFICIAL_CONTACT.openingHours.display}.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Hotline</p>
                  <p className="text-sm font-bold text-white">{footerSettings?.supportPhone || OFFICIAL_CONTACT.phone.display}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Email</p>
                  <p className="text-sm font-bold text-white">{footerSettings?.supportEmail || OFFICIAL_CONTACT.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase">Head Office / Outlets</p>
                  <p className="text-sm text-slate-200">
                    {branches.length > 0
                      ? `${branches[0].name}, ${branches[0].address}`
                      : `Eastern Plaza (Flagship), ${OFFICIAL_CONTACT.address.en}`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Column */}
        <div className="lg:col-span-7 bg-white border rounded-3xl p-8 sm:p-10 shadow-sm">
          {isSuccess ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Message Received!</h3>
              <p className="text-slate-500 text-sm max-w-sm mx-auto">
                Thank you for reaching out. Our support team will review your inquiry and get back to you shortly.
              </p>
              <Button onClick={() => setIsSuccess(false)} variant="outline" className="mt-2">
                Send Another Message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 mb-2">Send us a Message</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Your Name *</Label>
                  <Input 
                    placeholder="Your full name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Email Address *</Label>
                  <Input 
                    type="email" 
                    placeholder="you@example.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Phone (Optional)</Label>
                  <Input 
                    placeholder="01XXXXXXXXX" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Subject (Optional)</Label>
                  <Input 
                    placeholder="e.g. Product Inquiry / Return" 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Your Message *</Label>
                <Textarea 
                  placeholder="How can we help you today? Please provide as much detail as possible..." 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)} 
                  rows={5} 
                  required 
                />
              </div>

              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-sm mt-2"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" /> Send Message
                  </span>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useAdminPage } from "@/contexts/AdminPageContext";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  CreditCard, MessageSquare, Mail, FileJson, ShieldAlert, 
  Eye, EyeOff, Loader2, Save, AlertTriangle 
} from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api-client";
import { ListLoadingSkeleton, ListErrorState } from "@/components/admin/AdminTableState";

export default function ThirdPartyConfigPage() {
  const { setTitle, setBadge } = useAdminPage();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Gateways
  const [bkash, setBkash] = useState<any>({
    isActive: false,
    mode: "Sandbox",
    title: "bKash Digital Payment",
    credentials: { appKey: "", appSecretKey: "", username: "", password: "" },
  });
  const [ssl, setSsl] = useState<any>({
    isActive: false,
    mode: "Sandbox",
    title: "SSLCommerz Payment Gateway",
    credentials: { storeId: "", storePassword: "", currency: "BDT" },
  });
  const [cod, setCod] = useState<any>({
    isActive: true,
    title: "Cash on Delivery",
    credentials: {},
  });

  // SMS
  const [sms, setSms] = useState<any>({
    provider: "GREENWEB",
    apiKey: "",
    senderId: "",
    isActive: false,
  });

  // Mail
  const [mail, setMail] = useState<any>({
    host: "smtp.gmail.com",
    port: 587,
    username: "",
    password: "",
    fromEmail: "noreply@mobilehubbd.com",
    fromName: "mobilehubbd",
    isActive: false,
  });

  // Firebase
  const [firebase, setFirebase] = useState<any>({
    apiKey: "",
    projectId: "",
    messagingSenderId: "",
    appId: "",
    serverKey: "",
    isActive: false,
  });

  // ReCaptcha
  const [recaptcha, setRecaptcha] = useState<any>({
    siteKey: "",
    secretKey: "",
    version: "V3",
    isActive: false,
  });

  // Password visibility states
  const [showBkashPass, setShowBkashPass] = useState(false);
  const [showSslPass, setShowSslPass] = useState(false);
  const [showMailPass, setShowMailPass] = useState(false);

  const fetchAllConfigs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [gateways, smsData, mailData, firebaseData, recaptchaData] = await Promise.all([
        apiGet<any[]>("/payment-gateways").catch(() => []),
        apiGet<any>("/sms-config").catch(() => null),
        apiGet<any>("/mail-config").catch(() => null),
        apiGet<any>("/firebase-config").catch(() => null),
        apiGet<any>("/recaptcha-config").catch(() => null),
      ]);

      if (gateways && gateways.length > 0) {
        const bk = gateways.find((g) => g.gateway === "BKASH");
        const sc = gateways.find((g) => g.gateway === "SSLCOMMERZ");
        const cd = gateways.find((g) => g.gateway === "COD");
        if (bk) setBkash({ ...bk, credentials: bk.credentials || {} });
        if (sc) setSsl({ ...sc, credentials: sc.credentials || {} });
        if (cd) setCod({ ...cd, credentials: cd.credentials || {} });
      }

      if (smsData) setSms(smsData);
      if (mailData) setMail(mailData);
      if (firebaseData) setFirebase(firebaseData);
      if (recaptchaData) setRecaptcha(recaptchaData);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load third party configuration");
      toast.error("Failed to load third party configuration");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setTitle("3rd Party Integration");
    setBadge("Settings");
    fetchAllConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSavePaymentGateways = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        apiPatch("/payment-gateways/BKASH", {
          isActive: bkash.isActive,
          mode: bkash.mode,
          title: bkash.title,
          credentials: bkash.credentials,
        }),
        apiPatch("/payment-gateways/SSLCOMMERZ", {
          isActive: ssl.isActive,
          mode: ssl.mode,
          title: ssl.title,
          credentials: ssl.credentials,
        }),
        apiPatch("/payment-gateways/COD", {
          isActive: cod.isActive,
          title: cod.title,
          credentials: cod.credentials,
        }),
      ]);
      toast.success("Payment gateways configuration saved successfully!");
      fetchAllConfigs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save payment gateway settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSms = async () => {
    setIsSaving(true);
    try {
      await apiPatch("/sms-config", sms);
      toast.success("SMS gateway configuration saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save SMS config");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMail = async () => {
    setIsSaving(true);
    try {
      await apiPatch("/mail-config", mail);
      toast.success("SMTP email configuration saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save mail config");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFirebase = async () => {
    setIsSaving(true);
    try {
      await apiPatch("/firebase-config", firebase);
      toast.success("Firebase cloud messaging configuration saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save Firebase config");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRecaptcha = async () => {
    setIsSaving(true);
    try {
      await apiPatch("/recaptcha-config", recaptcha);
      toast.success("Google reCAPTCHA configuration saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save reCAPTCHA config");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
          <div>
            <h2 className="text-base font-bold text-slate-800">3rd Party Integrations & Gateways</h2>
            <p className="text-xs text-slate-500">Manage credentials for bKash, SSLCommerz, SMS, SMTP, Firebase, and reCAPTCHA</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <ListLoadingSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
          <div>
            <h2 className="text-base font-bold text-slate-800">3rd Party Integrations & Gateways</h2>
            <p className="text-xs text-slate-500">Manage credentials for bKash, SSLCommerz, SMS, SMTP, Firebase, and reCAPTCHA</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-8">
          <ListErrorState error={error} onRetry={fetchAllConfigs} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800">3rd Party Integrations & Gateways</h2>
          <p className="text-xs text-slate-500">Manage credentials for bKash, SSLCommerz, SMS, SMTP, Firebase, and reCAPTCHA</p>
        </div>
      </div>

      <Tabs defaultValue="payment" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-lg w-full justify-start h-auto flex-wrap mb-4">
          <TabsTrigger value="payment" className="rounded-md px-4 py-2 text-xs font-bold flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Payment Gateways
          </TabsTrigger>
          <TabsTrigger value="sms" className="rounded-md px-4 py-2 text-xs font-bold flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> SMS Provider
          </TabsTrigger>
          <TabsTrigger value="mail" className="rounded-md px-4 py-2 text-xs font-bold flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> SMTP Mail
          </TabsTrigger>
          <TabsTrigger value="firebase" className="rounded-md px-4 py-2 text-xs font-bold flex items-center gap-1.5">
            <FileJson className="w-3.5 h-3.5" /> Firebase Push
          </TabsTrigger>
          <TabsTrigger value="recaptcha" className="rounded-md px-4 py-2 text-xs font-bold flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" /> Google reCAPTCHA
          </TabsTrigger>
        </TabsList>

        {/* PAYMENT GATEWAY TAB */}
        <TabsContent value="payment" className="space-y-6 mt-0">
          <div className="flex justify-end">
            <Button onClick={handleSavePaymentGateways} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="flex items-center gap-1.5"><Save className="w-4 h-4" /> Save Gateways</span>}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* bKash Card */}
            <Card className="border-slate-200 shadow-sm rounded-xl">
              <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-pink-600 text-white font-bold flex items-center justify-center text-sm">
                    b
                  </div>
                  <CardTitle className="text-base font-bold text-slate-800">bKash Tokenized Checkout</CardTitle>
                </div>
                <Switch
                  checked={bkash.isActive}
                  onCheckedChange={(val) => setBkash({ ...bkash, isActive: val })}
                />
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Gateway Mode</Label>
                    <Select
                      value={bkash.mode}
                      onValueChange={(val) => setBkash({ ...bkash, mode: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sandbox">Sandbox (Test)</SelectItem>
                        <SelectItem value="Live">Live (Production)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Display Title</Label>
                    <Input
                      value={bkash.title}
                      onChange={(e) => setBkash({ ...bkash, title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">bKash App Key</Label>
                  <Input
                    value={bkash.credentials?.appKey || ""}
                    onChange={(e) => setBkash({ ...bkash, credentials: { ...bkash.credentials, appKey: e.target.value } })}
                    placeholder="Enter bKash App Key"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">bKash App Secret Key</Label>
                  <Input
                    type="password"
                    value={bkash.credentials?.appSecretKey || ""}
                    onChange={(e) => setBkash({ ...bkash, credentials: { ...bkash.credentials, appSecretKey: e.target.value } })}
                    placeholder="Enter bKash App Secret"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">API Username</Label>
                    <Input
                      value={bkash.credentials?.username || ""}
                      onChange={(e) => setBkash({ ...bkash, credentials: { ...bkash.credentials, username: e.target.value } })}
                      placeholder="Merchant username"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">API Password</Label>
                    <div className="relative">
                      <Input
                        type={showBkashPass ? "text" : "password"}
                        value={bkash.credentials?.password || ""}
                        onChange={(e) => setBkash({ ...bkash, credentials: { ...bkash.credentials, password: e.target.value } })}
                        placeholder="Merchant password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowBkashPass(!showBkashPass)}
                        className="absolute right-2.5 top-2.5 text-slate-400"
                      >
                        {showBkashPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SSLCommerz Card */}
            <Card className="border-slate-200 shadow-sm rounded-xl">
              <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                    SSL
                  </div>
                  <CardTitle className="text-base font-bold text-slate-800">SSLCommerz Hosted Session</CardTitle>
                </div>
                <Switch
                  checked={ssl.isActive}
                  onCheckedChange={(val) => setSsl({ ...ssl, isActive: val })}
                />
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Gateway Mode</Label>
                    <Select
                      value={ssl.mode}
                      onValueChange={(val) => setSsl({ ...ssl, mode: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sandbox">Sandbox (Test)</SelectItem>
                        <SelectItem value="Live">Live (Production)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Display Title</Label>
                    <Input
                      value={ssl.title}
                      onChange={(e) => setSsl({ ...ssl, title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Store ID</Label>
                  <Input
                    value={ssl.credentials?.storeId || ""}
                    onChange={(e) => setSsl({ ...ssl, credentials: { ...ssl.credentials, storeId: e.target.value } })}
                    placeholder="Merchant Store ID"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Store Password</Label>
                  <div className="relative">
                    <Input
                      type={showSslPass ? "text" : "password"}
                      value={ssl.credentials?.storePassword || ""}
                      onChange={(e) => setSsl({ ...ssl, credentials: { ...ssl.credentials, storePassword: e.target.value } })}
                      placeholder="Store Secret Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSslPass(!showSslPass)}
                      className="absolute right-2.5 top-2.5 text-slate-400"
                    >
                      {showSslPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cash on Delivery Card */}
            <Card className="border-slate-200 shadow-sm rounded-xl lg:col-span-2">
              <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800">Cash on Delivery (COD)</CardTitle>
                <Switch
                  checked={cod.isActive}
                  onCheckedChange={(val) => setCod({ ...cod, isActive: val })}
                />
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-1.5 max-w-md">
                  <Label className="text-xs font-bold text-slate-700">Title on Checkout Screen</Label>
                  <Input
                    value={cod.title}
                    onChange={(e) => setCod({ ...cod, title: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SMS CONFIG TAB */}
        <TabsContent value="sms" className="space-y-4 mt-0">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-800">SMS Gateway Configuration</CardTitle>
              <Switch
                checked={sms.isActive}
                onCheckedChange={(val) => setSms({ ...sms, isActive: val })}
              />
            </CardHeader>
            <CardContent className="p-6 space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">SMS Gateway Provider</Label>
                <Select
                  value={sms.provider}
                  onValueChange={(val) => setSms({ ...sms, provider: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GREENWEB">Greenweb BD</SelectItem>
                    <SelectItem value="ONNOROKOM">Onnorokom SMS</SelectItem>
                    <SelectItem value="MIM_SMS">MiM SMS</SelectItem>
                    <SelectItem value="TWILIO">Twilio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">API Key / Token</Label>
                <Input
                  value={sms.apiKey || ""}
                  onChange={(e) => setSms({ ...sms, apiKey: e.target.value })}
                  placeholder="Enter API Key"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Sender ID (Masking / Non-Masking)</Label>
                <Input
                  value={sms.senderId || ""}
                  onChange={(e) => setSms({ ...sms, senderId: e.target.value })}
                  placeholder="e.g. mobilehubbd"
                />
              </div>

              <Button onClick={handleSaveSms} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                Save SMS Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MAIL CONFIG TAB */}
        <TabsContent value="mail" className="space-y-4 mt-0">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-800">SMTP Email Server</CardTitle>
              <Switch
                checked={mail.isActive}
                onCheckedChange={(val) => setMail({ ...mail, isActive: val })}
              />
            </CardHeader>
            <CardContent className="p-6 space-y-4 max-w-xl">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">SMTP Host</Label>
                  <Input
                    value={mail.host || ""}
                    onChange={(e) => setMail({ ...mail, host: e.target.value })}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">SMTP Port</Label>
                  <Input
                    type="number"
                    value={mail.port || 587}
                    onChange={(e) => setMail({ ...mail, port: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">SMTP Username</Label>
                <Input
                  value={mail.username || ""}
                  onChange={(e) => setMail({ ...mail, username: e.target.value })}
                  placeholder="mobilehubbd2@gmail.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">SMTP Password</Label>
                <div className="relative">
                  <Input
                    type={showMailPass ? "text" : "password"}
                    value={mail.password || ""}
                    onChange={(e) => setMail({ ...mail, password: e.target.value })}
                    placeholder="App password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMailPass(!showMailPass)}
                    className="absolute right-2.5 top-2.5 text-slate-400"
                  >
                    {showMailPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Sender Email</Label>
                  <Input
                    value={mail.fromEmail || ""}
                    onChange={(e) => setMail({ ...mail, fromEmail: e.target.value })}
                    placeholder="mobilehubbd2@gmail.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Sender Name</Label>
                  <Input
                    value={mail.fromName || ""}
                    onChange={(e) => setMail({ ...mail, fromName: e.target.value })}
                    placeholder="MobileHubBD"
                  />
                </div>
              </div>

              <Button onClick={handleSaveMail} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                Save Mail Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FIREBASE CONFIG TAB */}
        <TabsContent value="firebase" className="space-y-4 mt-0">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-800">Firebase Cloud Messaging</CardTitle>
              <Switch
                checked={firebase.isActive}
                onCheckedChange={(val) => setFirebase({ ...firebase, isActive: val })}
              />
            </CardHeader>
            <CardContent className="p-6 space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Firebase Project ID</Label>
                <Input
                  value={firebase.projectId || ""}
                  onChange={(e) => setFirebase({ ...firebase, projectId: e.target.value })}
                  placeholder="mobilehubbd-fcm-project"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">API Key</Label>
                <Input
                  value={firebase.apiKey || ""}
                  onChange={(e) => setFirebase({ ...firebase, apiKey: e.target.value })}
                  placeholder="AIzaSy..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Server Key / Secret</Label>
                <Input
                  type="password"
                  value={firebase.serverKey || ""}
                  onChange={(e) => setFirebase({ ...firebase, serverKey: e.target.value })}
                  placeholder="FCM Server Key"
                />
              </div>

              <Button onClick={handleSaveFirebase} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                Save Firebase Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECAPTCHA CONFIG TAB */}
        <TabsContent value="recaptcha" className="space-y-4 mt-0">
          <Card className="border-slate-200 shadow-sm rounded-xl">
            <CardHeader className="bg-slate-50 border-b pb-4 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-slate-800">Google reCAPTCHA Protection</CardTitle>
              <Switch
                checked={recaptcha.isActive}
                onCheckedChange={(val) => setRecaptcha({ ...recaptcha, isActive: val })}
              />
            </CardHeader>
            <CardContent className="p-6 space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Site Key</Label>
                <Input
                  value={recaptcha.siteKey || ""}
                  onChange={(e) => setRecaptcha({ ...recaptcha, siteKey: e.target.value })}
                  placeholder="6LeIxacTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Secret Key</Label>
                <Input
                  type="password"
                  value={recaptcha.secretKey || ""}
                  onChange={(e) => setRecaptcha({ ...recaptcha, secretKey: e.target.value })}
                  placeholder="6LeIxacTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe"
                />
              </div>

              <Button onClick={handleSaveRecaptcha} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                Save reCAPTCHA Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { 
  ArrowRight, LayoutGrid, Monitor, Battery, Zap, Volume2, 
  Smartphone, Camera, Shield, CreditCard, Disc, PenTool, 
  Headphones, BatteryCharging, ChevronLeft, ChevronRight,
  PackageSearch
} from "lucide-react";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { ProductCard } from "@/components/storefront/ProductCard";
import { BlogCard } from "@/components/storefront/BlogCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet, getImageUrl } from "@/lib/api-client";

export const metadata: Metadata = {
  title: {
    absolute: "MobileHubBD - Premium Smartphone Parts & Repair Services",
  },
  description:
    "Bangladesh's leading platform for genuine smartphone displays, batteries, accessories, and professional repair services.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "MobileHubBD - Premium Smartphone Parts & Repair Services",
    description:
      "Bangladesh's leading platform for genuine smartphone displays, batteries, accessories, and professional repair services.",
    url: "/",
    siteName: "MobileHubBD",
  },
};

/**
 * STOREFRONT PRODUCT VISIBILITY RULES:
 * 1. Product must have `status: 'ACTIVE'` (Draft/Archived are excluded by backend `findAllPublic`).
 * 2. Product must belong to an active category (`categoryId`).
 * 3. Featured section requires `isFeatured: true`.
 * 4. Best Deals section requires `isBestDeal: true`.
 * 5. Smartphones section requires `productCategory: 'PHONE'` or `productType: 'phone'`.
 * 6. Popular section displays top active items by views/orders, falling back to newest active items.
 * 7. ISR cache duration is 30 seconds (maximum 60s), ensuring newly published products appear promptly.
 */
export const revalidate = 30;

const categoryIconMap: Record<string, React.ReactNode> = {
  'Display': <Monitor className="w-8 h-8" />,
  'Battery': <Battery className="w-8 h-8" />,
  'Charging Logic': <Zap className="w-8 h-8" />,
  'Speaker': <Volume2 className="w-8 h-8" />,
  'Housing': <Smartphone className="w-8 h-8" />,
  'Camera': <Camera className="w-8 h-8" />,
  'Back Glass': <Shield className="w-8 h-8" />,
  'Sim Tray': <CreditCard className="w-8 h-8" />,
  'Camera Glass': <Disc className="w-8 h-8" />,
  'S PEN': <PenTool className="w-8 h-8" />,
  'Smartphones': <Smartphone className="w-8 h-8" />,
  'AirPods': <Headphones className="w-8 h-8" />,
  'Power Bank': <BatteryCharging className="w-8 h-8" />,
};

async function getHomeData() {
  const fetchOpts = { next: { revalidate: 30 } };
  try {
    const [categoriesTree, featuredRes, bestDealsRes, popularRes, newestRes, blogsRes, phonesRes] = await Promise.all([
      apiGet<any>("/categories/tree", undefined, fetchOpts).catch((e) => {
        console.error("Categories fetch error:", e);
        return [];
      }),
      apiGet<any>("/products", { featured: "true", limit: 10 }, fetchOpts).catch((e) => {
        console.error("Featured products fetch error:", e);
        return { data: [] };
      }),
      apiGet<any>("/products", { bestDeal: "true", limit: 10 }, fetchOpts).catch((e) => {
        console.error("Best deals fetch error:", e);
        return { data: [] };
      }),
      apiGet<any>("/products", { limit: 12, sort: "popular" }, fetchOpts).catch((e) => {
        console.error("Products popular fetch error:", e);
        return { data: [] };
      }),
      apiGet<any>("/products", { limit: 12, sort: "newest" }, fetchOpts).catch((e) => {
        console.error("Products newest fetch error:", e);
        return { data: [] };
      }),
      apiGet<any>("/blogs", undefined, fetchOpts).catch((e) => {
        console.error("Blogs fetch error:", e);
        return [];
      }),
      apiGet<any>("/products", { type: "PHONE", limit: 10 }, fetchOpts).catch(() => ({ data: [] })),
    ]);

    const categories = Array.isArray(categoriesTree)
      ? categoriesTree
      : categoriesTree?.data || [];

    const newestProducts = Array.isArray(newestRes)
      ? newestRes
      : newestRes?.data || [];

    const popularProducts = Array.isArray(popularRes)
      ? popularRes
      : popularRes?.data || [];

    const fallbackProducts = newestProducts.length > 0 ? newestProducts : popularProducts;

    const featuredData = Array.isArray(featuredRes) ? featuredRes : featuredRes?.data || [];
    const bestDealsData = Array.isArray(bestDealsRes) ? bestDealsRes : bestDealsRes?.data || [];
    const phonesData = Array.isArray(phonesRes) ? phonesRes : phonesRes?.data || [];

    const featuredProducts = featuredData.length > 0 ? featuredData : fallbackProducts.slice(0, 5);
    const bestDeals = bestDealsData.length > 0 ? bestDealsData : fallbackProducts.slice(0, 10);
    const phones = phonesData.length > 0 ? phonesData : [];

    const blogs = Array.isArray(blogsRes) ? blogsRes : blogsRes?.data || [];

    return {
      categories,
      products: fallbackProducts,
      newestProducts,
      popularProducts,
      featuredProducts,
      bestDeals,
      phones,
      blogs: blogs.slice(0, 3),
    };
  } catch (err) {
    console.error("getHomeData global catch:", err);
    return {
      categories: [],
      products: [],
      newestProducts: [],
      popularProducts: [],
      featuredProducts: [],
      bestDeals: [],
      phones: [],
      blogs: [],
    };
  }
}

export default async function HomePage() {
  const { categories, products, newestProducts, popularProducts, featuredProducts, bestDeals, phones, blogs } = await getHomeData();

  return (
    <div className="flex flex-col gap-12 pb-16">
      {/* 1. Hero Banner */}
      <section className="container mx-auto px-4 pt-6">
        <HeroCarousel />
      </section>

      {/* 2. Shop By Category */}
      <section className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Shop by Category</h2>
            <p className="text-sm text-slate-500 mt-1">Explore genuine smartphone parts & premium accessories</p>
          </div>
          <Link href="/category/all" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
            Browse All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {categories.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm border rounded-xl">
            No categories available at the moment.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.slice(0, 12).map((cat: any) => {
              const icon = categoryIconMap[cat.name] || <Smartphone className="w-8 h-8" />;
              return (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug || cat.id}`}
                  className="group flex flex-col items-center justify-center p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-600 group-hover:bg-primary/10 group-hover:text-primary transition-colors mb-3 overflow-hidden">
                    {cat.icon ? (
                      <img src={getImageUrl(cat.icon)} alt={cat.name} className="w-8 h-8 object-contain" />
                    ) : (
                      icon
                    )}
                  </div>
                  <span className="font-semibold text-sm text-slate-800 group-hover:text-primary transition-colors line-clamp-1">
                    {cat.name}
                  </span>
                  <span className="text-xs text-slate-400 mt-0.5">
                    {cat._count?.products || 0} items
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Best Deals & Spare Parts */}
      <section className="container mx-auto px-4">
        <Tabs defaultValue="newest" className="w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Best Deals & Spare Parts</h2>
            <TabsList className="bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="newest" className="rounded-lg text-xs font-bold px-4 py-2">
                New Arrivals
              </TabsTrigger>
              <TabsTrigger value="all" className="rounded-lg text-xs font-bold px-4 py-2">
                All Popular
              </TabsTrigger>
              <TabsTrigger value="spare" className="rounded-lg text-xs font-bold px-4 py-2">
                Displays & Logic
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="newest" className="mt-0 outline-none">
            {newestProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm border rounded-xl">
                No products found.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {newestProducts.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="all" className="mt-0 outline-none">
            {popularProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm border rounded-xl">
                No products found.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                {popularProducts.map((product: any) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="spare" className="mt-0 outline-none">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {(bestDeals.filter((p: any) => p.category?.slug?.includes('display') || p.productType === 'spare_part').length > 0
                ? bestDeals.filter((p: any) => p.category?.slug?.includes('display') || p.productType === 'spare_part')
                : bestDeals
              ).map((product: any) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* 3.5 Dedicated Smartphones & Handsets Section */}
      <section className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                Official & Pre-Owned Handsets
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-emerald-400" />
              Smartphones & Devices
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Verified IMEI device inventory with hardware warranty inspection.
            </p>
          </div>
          <Link href="/phones">
            <Button className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs">
              Explore All Phones <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>

        {phones.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs border rounded-xl bg-slate-50">
            No smartphones currently in stock. Check back shortly.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {phones.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Featured Products</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {featuredProducts.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* 5. Ready Blogs */}
      {blogs.length > 0 && (
        <section className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Latest Guides & News</h2>
            <Link href="/blog" className="text-sm font-semibold text-primary hover:underline flex items-center gap-1">
              All Articles <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.map((blog: any) => (
              <BlogCard key={blog.id} blog={blog} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

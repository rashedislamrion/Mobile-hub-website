"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, Filter, X } from "lucide-react";
import { ProductCard } from "@/components/storefront/ProductCard";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { apiGet } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_COLORS = ["Black", "White", "Gray", "Silver", "Green", "Bronze", "Blue", "Gold"];
const DEFAULT_QUALITIES = ["Original", "OEM", "High Quality", "OLED", "TFT", "IPS", "Diamond"];
const DEFAULT_GUARANTEES = ["No Guarantee", "7 Days", "30 Days", "6 Months", "1 Year"];
const DEFAULT_FRAMES = ["With Frame", "No Frame"];
const DEFAULT_TYPES = ["Original Pull", "Replacement", "Factory Refurbished"];
const DEFAULT_SERVICES = ["Self Installation", "Free Fitting"];

export default function CategoryClientView({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categoryName = useMemo(() => {
    if (params.slug === "all") return "All Products";
    return params.slug.replace(/-/g, " ").toUpperCase();
  }, [params.slug]);

  // Dynamic filter lists from backend
  const [brandsList, setBrandsList] = useState<string[]>([]);
  const [colorsList, setColorsList] = useState<string[]>(DEFAULT_COLORS);
  const [qualitiesList, setQualitiesList] = useState<string[]>(DEFAULT_QUALITIES);
  const [guaranteesList, setGuaranteesList] = useState<string[]>(DEFAULT_GUARANTEES);
  const [framesList, setFramesList] = useState<string[]>(DEFAULT_FRAMES);
  const [typesList, setTypesList] = useState<string[]>(DEFAULT_TYPES);
  const [servicesList, setServicesList] = useState<string[]>(DEFAULT_SERVICES);
  const [categoryInfo, setCategoryInfo] = useState<{ id: string; name: string } | null>(null);

  // Filter states initialized from URL search params
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    searchParams.get("brand") ? searchParams.get("brand")!.split(",") : []
  );
  const [selectedColors, setSelectedColors] = useState<string[]>(
    searchParams.get("color") ? searchParams.get("color")!.split(",") : []
  );
  const [selectedQualities, setSelectedQualities] = useState<string[]>(
    searchParams.get("quality") ? searchParams.get("quality")!.split(",") : []
  );
  const [selectedGuarantees, setSelectedGuarantees] = useState<string[]>(
    searchParams.get("guarantee") ? searchParams.get("guarantee")!.split(",") : []
  );
  const [selectedFrames, setSelectedFrames] = useState<string[]>(
    searchParams.get("frame") ? searchParams.get("frame")!.split(",") : []
  );
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    searchParams.get("type") ? searchParams.get("type")!.split(",") : []
  );
  const [selectedServices, setSelectedServices] = useState<string[]>(
    searchParams.get("service") ? searchParams.get("service")!.split(",") : []
  );
  
  // Sort & Pagination
  const [sortParam, setSortParam] = useState(searchParams.get("sort") || "popular");
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);

  // Products state from real backend
  const [products, setProducts] = useState<any[]>([]);
  const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number }>({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch brands, category details, and dynamic attributes
  useEffect(() => {
    (async () => {
      try {
        const [brandsData, catData, attrData] = await Promise.all([
          apiGet<any[]>("/brands").catch(() => []),
          params.slug !== "all"
            ? apiGet<any>(`/categories/${params.slug}`).catch(() => null)
            : Promise.resolve(null),
          apiGet<any[]>("/attributes").catch(() => []),
        ]);
        if (brandsData) {
          setBrandsList(brandsData.map((b: any) => b.name));
        }
        if (catData) {
          setCategoryInfo(catData);
        }
        if (attrData && Array.isArray(attrData)) {
          attrData.forEach((attr: any) => {
            const attrName = (attr.name || "").toLowerCase();
            const vals = (attr.values || []).map((v: any) => v.value).filter(Boolean);
            if (vals.length > 0) {
              if (attrName.includes("color") || attrName.includes("colour")) {
                setColorsList(prev => Array.from(new Set([...prev, ...vals])));
              } else if (attrName.includes("quality") || attrName.includes("grade")) {
                setQualitiesList(vals);
              } else if (attrName.includes("guarantee") || attrName.includes("warranty")) {
                setGuaranteesList(vals);
              } else if (attrName.includes("frame")) {
                setFramesList(vals);
              } else if (attrName.includes("type")) {
                setTypesList(vals);
              } else if (attrName.includes("service")) {
                setServicesList(vals);
              }
            }
          });
        }
      } catch (e) {
        console.error("Failed to load category filters", e);
      }
    })();
  }, [params.slug]);

  const searchTerm = searchParams.get("search") || "";

  // Fetch products matching filters
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const query: Record<string, any> = {
        page: currentPage,
        limit: 12,
        sort: sortParam === "price-low" ? "price_asc" : sortParam === "price-high" ? "price_desc" : sortParam,
      };

      if (params.slug !== "all") {
        query.category = params.slug;
      }
      if (searchTerm) {
        query.search = searchTerm;
      }
      if (selectedBrands.length > 0) query.brand = selectedBrands.join(",");
      if (selectedColors.length > 0) query.color = selectedColors.join(",");
      if (selectedQualities.length > 0) query.quality = selectedQualities.join(",");
      if (selectedGuarantees.length > 0) query.guarantee = selectedGuarantees.join(",");
      if (selectedFrames.length > 0) query.frame = selectedFrames.join(",");
      if (selectedTypes.length > 0) query.type = selectedTypes.join(",");
      if (selectedServices.length > 0) query.service = selectedServices.join(",");

      const res = await apiGet<{ data: any[]; meta: any }>("/products", query);
      setProducts(res.data || []);
      if (res.meta) {
        setMeta(res.meta);
      }
    } catch (e) {
      console.error("Failed to load products", e);
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    params.slug,
    searchTerm,
    currentPage,
    sortParam,
    selectedBrands,
    selectedColors,
    selectedQualities,
    selectedGuarantees,
    selectedFrames,
    selectedTypes,
    selectedServices,
  ]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const toggleFilter = (setFn: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    setFn(prev => {
      const newFilter = prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val];
      setCurrentPage(1);
      return newFilter;
    });
  };

  const clearAll = () => {
    setSelectedBrands([]);
    setSelectedColors([]);
    setSelectedQualities([]);
    setSelectedGuarantees([]);
    setSelectedFrames([]);
    setSelectedTypes([]);
    setSelectedServices([]);
    setCurrentPage(1);
  };

  const activeBrands = brandsList.length > 0 ? brandsList : ["Apple", "Samsung", "Xiaomi", "Google", "HONOR", "HUAWEI", "LG"];

  const FilterSidebar = () => (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">Filters</h3>
        <button onClick={clearAll} className="text-sm text-primary hover:underline">Clear all</button>
      </div>

      <Accordion type="multiple" defaultValue={["brand", "color", "quality"]} className="w-full">
        {/* Brand */}
        <AccordionItem value="brand" className="border-slate-100">
          <AccordionTrigger className="py-3 hover:no-underline font-semibold text-slate-700">Brand</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 mt-1 pb-1">
              {activeBrands.map(b => (
                <label key={b} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox 
                    checked={selectedBrands.includes(b)}
                    onCheckedChange={() => toggleFilter(setSelectedBrands, b)}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-primary" 
                  />
                  <span className="text-sm text-slate-600 group-hover:text-primary transition-colors">{b}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Color */}
        <AccordionItem value="color" className="border-slate-100">
          <AccordionTrigger className="py-3 hover:no-underline font-semibold text-slate-700">Color</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 mt-1 pb-1">
              {colorsList.map(c => (
                <label key={c} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox 
                    checked={selectedColors.includes(c)}
                    onCheckedChange={() => toggleFilter(setSelectedColors, c)}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-primary transition-colors">{c}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        
        {/* Quality */}
        <AccordionItem value="quality" className="border-slate-100">
          <AccordionTrigger className="py-3 hover:no-underline font-semibold text-slate-700">Quality</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 mt-1 pb-1">
              {qualitiesList.map(q => (
                <label key={q} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox 
                    checked={selectedQualities.includes(q)}
                    onCheckedChange={() => toggleFilter(setSelectedQualities, q)}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-primary transition-colors">{q}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Guarantee */}
        <AccordionItem value="guarantee" className="border-slate-100">
          <AccordionTrigger className="py-3 hover:no-underline font-semibold text-slate-700">Guarantee</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 mt-1 pb-1">
              {guaranteesList.map(g => (
                <label key={g} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox 
                    checked={selectedGuarantees.includes(g)}
                    onCheckedChange={() => toggleFilter(setSelectedGuarantees, g)}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-primary transition-colors">{g}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Frame */}
        <AccordionItem value="frame" className="border-slate-100">
          <AccordionTrigger className="py-3 hover:no-underline font-semibold text-slate-700">Frame</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 mt-1 pb-1">
              {framesList.map(f => (
                <label key={f} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox 
                    checked={selectedFrames.includes(f)}
                    onCheckedChange={() => toggleFilter(setSelectedFrames, f)}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-primary transition-colors">{f}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Type */}
        <AccordionItem value="type" className="border-slate-100">
          <AccordionTrigger className="py-3 hover:no-underline font-semibold text-slate-700">Type</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 mt-1 pb-1">
              {typesList.map(t => (
                <label key={t} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox 
                    checked={selectedTypes.includes(t)}
                    onCheckedChange={() => toggleFilter(setSelectedTypes, t)}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-primary transition-colors">{t}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Service */}
        <AccordionItem value="service" className="border-slate-100">
          <AccordionTrigger className="py-3 hover:no-underline font-semibold text-slate-700">Service</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-3 mt-1 pb-1">
              {servicesList.map(s => (
                <label key={s} className="flex items-center gap-3 cursor-pointer group">
                  <Checkbox 
                    checked={selectedServices.includes(s)}
                    onCheckedChange={() => toggleFilter(setSelectedServices, s)}
                    className="rounded-sm border-slate-300 data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-primary transition-colors">{s}</span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button & Title */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/">
          <Button variant="outline" size="icon" className="w-10 h-10 rounded-full border-slate-200">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            {categoryInfo?.name || categoryName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Browse spare parts and components</p>
        </div>
      </div>

      <div className="flex gap-8 items-start">
        {/* LEFT: Desktop Sidebar */}
        <div className="hidden lg:block w-[260px] shrink-0 sticky top-24">
          <FilterSidebar />
        </div>

        {/* RIGHT: Main Content */}
        <div className="flex-1 min-w-0">
          
          {/* Top Control Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              {/* Mobile Filter Trigger */}
              <div className="lg:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2 border-slate-200">
                      <Filter className="w-4 h-4" /> Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px] sm:w-[350px] overflow-y-auto">
                    <SheetHeader className="mb-6">
                      <SheetTitle>Filter Products</SheetTitle>
                    </SheetHeader>
                    <FilterSidebar />
                  </SheetContent>
                </Sheet>
              </div>
              <p className="text-sm text-slate-500 font-medium">
                {meta.total === 0
                  ? "Showing 0 results"
                  : `Showing ${(currentPage - 1) * meta.limit + 1} to ${Math.min(currentPage * meta.limit, meta.total)} of ${meta.total} results`}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-sm font-medium text-slate-600 whitespace-nowrap">Sort By:</span>
              <Select value={sortParam} onValueChange={(val) => { setSortParam(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px] bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Popular</SelectItem>
                  <SelectItem value="price-low">Price Low-High</SelectItem>
                  <SelectItem value="price-high">Price High-Low</SelectItem>
                  <SelectItem value="newest">Newest</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                  <Skeleton className="w-full aspect-square rounded-lg" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {products.map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-400">
                <X className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-800">No products found</h3>
              <p className="text-slate-500 mt-2 text-sm">Try adjusting your filters or category selection.</p>
              <Button variant="outline" className="mt-6 border-slate-200" onClick={clearAll}>Clear Filters</Button>
            </div>
          )}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: meta.totalPages }).map((_, i) => (
                    <PaginationItem key={i}>
                      <PaginationLink 
                        href="#" 
                        isActive={currentPage === i + 1}
                        onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1); }}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(meta.totalPages, p + 1)); }}
                      className={currentPage === meta.totalPages ? 'pointer-events-none opacity-50' : ''}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}

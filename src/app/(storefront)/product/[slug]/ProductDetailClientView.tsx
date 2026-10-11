"use client";

import { useEffect, useState } from "react";
import { OFFICIAL_CONTACT } from "@/config/contact";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Heart, 
  Share2, 
  Star, 
  Minus, 
  Plus, 
  Phone, 
  MessageCircle,
  ShoppingCart,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Package
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductCard } from "@/components/storefront/ProductCard";
import { apiGet, getImageUrl } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/context/CartContext";

interface ProductDetailData {
  id: string;
  name: string;
  slug: string;
  shortDescription?: string | null;
  description?: string | null;
  regularPrice: number | string;
  salePrice?: number | string | null;
  costPrice?: number | string | null;
  status: "ACTIVE" | "DRAFT" | "OUT_OF_STOCK";
  category?: { id: string; name: string; slug: string } | null;
  brand?: { id: string; name: string; slug: string } | null;
  images: Array<{ id: string; url: string; sortOrder: number }>;
  variants: Array<{ id: string; color?: string | null; quality?: string | null; price: number; stock: number; sku?: string }>;
  specifications: Array<{ id: string; label: string; value: string }>;
  reviews?: Array<{
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: string;
    customer?: { id: string; name: string; photo?: string | null } | null;
  }>;
  relatedProducts?: any[];
}

export default function ProductDetailClientView({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { addItem, setIsCartOpen } = useCart();
  const [product, setProduct] = useState<ProductDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Active selections
  const [selectedImage, setSelectedImage] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedQuality, setSelectedQuality] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [isWishlist, setIsWishlist] = useState(false);
  const [supportPhone, setSupportPhone] = useState(OFFICIAL_CONTACT.phone.tel);
  const [whatsappNumber, setWhatsappNumber] = useState(OFFICIAL_CONTACT.phone.whatsappNumber);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const data = await apiGet<ProductDetailData>(`/products/${params.slug}`);
        setProduct(data);
        if (data?.images?.length) {
          setSelectedImage(data.images[0].url);
        }
        if (data?.variants?.length) {
          if (data.variants[0].color) setSelectedColor(data.variants[0].color);
          if (data.variants[0].quality) setSelectedQuality(data.variants[0].quality);
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load product details");
      } finally {
        setIsLoading(false);
      }
    })();

    apiGet<any>("/business-settings")
      .then((res) => {
        if (res?.general?.phone) setSupportPhone(res.general.phone);
      })
      .catch(() => {});

    apiGet<any[]>("/social-links")
      .then((res) => {
        if (Array.isArray(res)) {
          const wa = res.find((s: any) => s.platform === "WHATSAPP");
          if (wa?.url) {
            const cleaned = wa.url.replace(/[^0-9]/g, "");
            if (cleaned) setWhatsappNumber(cleaned);
          }
        }
      })
      .catch(() => {});
  }, [params.slug]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Skeleton className="h-6 w-1/4" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <Skeleton className="h-[450px] w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold text-slate-800">Product not found</h2>
        <p className="text-slate-500 mt-2">The product you are looking for might have been moved or removed.</p>
        <Link href="/" className="mt-6 inline-block px-6 py-2.5 bg-primary text-white font-medium rounded-lg">
          Return to Store
        </Link>
      </div>
    );
  }

  // Calculate pricing & stock based on active variant selection
  const activeVariant = product.variants?.find(
    v => (v.color === selectedColor || !v.color) && (v.quality === selectedQuality || !v.quality)
  ) || product.variants?.[0];

  const currentPrice = activeVariant ? Number(activeVariant.price) : Number(product.salePrice || product.regularPrice);
  const regularPrice = Number(product.regularPrice);
  const saveAmount = regularPrice > currentPrice ? regularPrice - currentPrice : 0;
  const currentStock = activeVariant ? activeVariant.stock : (product.status === "ACTIVE" ? 10 : 0);
  const isOutOfStock = currentStock <= 0 || product.status === "OUT_OF_STOCK";

  // Distinct colors and qualities
  const availableColors = Array.from(new Set(product.variants?.map(v => v.color).filter(Boolean) as string[]));
  const availableQualities = Array.from(new Set(product.variants?.map(v => v.quality).filter(Boolean) as string[]));

  const handleAddToCart = () => {
    if (isOutOfStock || !product) return;
    addItem({
      productId: product.id,
      variantId: activeVariant?.id || 'default',
      name: product.name,
      image: selectedImage || product.images?.[0]?.url,
      price: currentPrice,
      quantity,
      maxStock: currentStock,
      color: selectedColor,
      quality: selectedQuality,
    });
    setIsCartOpen(true);
  };

  const handleBuyNow = () => {
    if (isOutOfStock || !product) return;
    addItem({
      productId: product.id,
      variantId: activeVariant?.id || 'default',
      name: product.name,
      image: selectedImage || product.images?.[0]?.url,
      price: currentPrice,
      quantity,
      maxStock: currentStock,
      color: selectedColor,
      quality: selectedQuality,
    });
    router.push('/checkout');
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col gap-12">
      
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight className="w-4 h-4" />
        {product.category && (
          <>
            <Link href={`/category/${product.category.slug}`} className="hover:text-primary transition-colors">
              {product.category.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
          </>
        )}
        <span className="text-slate-900 font-medium line-clamp-1">{product.name}</span>
      </nav>

      {/* Top Section: Image & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
        
        {/* LEFT: Image Gallery */}
        <div className="flex flex-col gap-4">
          <div className="aspect-square rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden relative flex items-center justify-center">
            {saveAmount > 0 && (
              <Badge className="absolute top-4 left-4 z-10 bg-danger text-white border-none font-semibold shadow-sm px-3 py-1 text-sm">
                SAVE ৳{saveAmount.toLocaleString()}
              </Badge>
            )}
            {selectedImage ? (
              <img 
                src={getImageUrl(selectedImage)} 
                alt={product.name}
                className="w-full h-full object-contain p-8 mix-blend-multiply"
              />
            ) : (
              <Package className="w-20 h-20 text-slate-300" />
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
              {product.images.map((img) => (
                <button 
                  key={img.id}
                  onClick={() => setSelectedImage(img.url)}
                  className={`shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 overflow-hidden snap-start transition-all ${
                    selectedImage === img.url ? 'border-primary shadow-sm' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img src={getImageUrl(img.url)} alt="Thumbnail" className="w-full h-full object-cover bg-slate-50" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Product Info */}
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              {product.brand && (
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-1 block">
                  {product.brand.name}
                </span>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 leading-tight">
                {product.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0 pt-1">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Product link copied to clipboard!");
                }}
                className="w-10 h-10 rounded-full text-slate-500 hover:text-primary"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setIsWishlist(!isWishlist)}
                className={`w-10 h-10 rounded-full transition-colors ${
                  isWishlist ? 'text-danger border-danger bg-danger/5' : 'text-slate-500 hover:text-danger'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlist ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center text-amber-400">
              <Star className="w-4 h-4 fill-current" />
              <Star className="w-4 h-4 fill-current" />
              <Star className="w-4 h-4 fill-current" />
              <Star className="w-4 h-4 fill-current" />
              <Star className="w-4 h-4 fill-current" />
            </div>
            <span className="text-sm font-medium text-slate-600">4.9</span>
            <span className="text-slate-300">•</span>
            <Link href="#reviews" className="text-sm text-primary hover:underline">128 Reviews</Link>
          </div>

          <div className="flex items-end gap-3 mb-3">
            <span className="text-3xl font-bold text-slate-900">৳{currentPrice.toLocaleString()}</span>
            {regularPrice > currentPrice && (
              <span className="text-lg text-slate-400 line-through mb-1">৳{regularPrice.toLocaleString()}</span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-6">
            {isOutOfStock ? (
              <Badge variant="outline" className="text-danger border-danger bg-danger/10 font-semibold px-2.5 py-0.5">
                <AlertCircle className="w-3.5 h-3.5 mr-1 inline" /> Out of Stock
              </Badge>
            ) : (
              <Badge variant="outline" className="text-emerald-600 border-emerald-500 bg-emerald-50 font-semibold px-2.5 py-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 inline" /> In Stock ({currentStock} available)
              </Badge>
            )}
          </div>

          {product.shortDescription && (
            <p className="text-slate-600 text-sm leading-relaxed mb-8">
              {product.shortDescription}
            </p>
          )}

          <hr className="border-slate-100 mb-8" />

          {/* Variants */}
          <div className="flex flex-col gap-6 mb-8">
            {availableColors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Color</h3>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                        selectedColor === color 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {availableQualities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Quality / Variant</h3>
                <div className="flex flex-wrap gap-2">
                  {availableQualities.map(quality => (
                    <button
                      key={quality}
                      onClick={() => setSelectedQuality(quality)}
                      className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                        selectedQuality === quality 
                          ? 'border-primary bg-primary/5 text-primary' 
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {quality}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add to Cart actions */}
          <div className="flex flex-col sm:flex-row items-stretch gap-4 mb-6">
            <div className="flex items-center border border-slate-200 rounded-xl h-12 w-full sm:w-32 shrink-0">
              <button 
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="w-10 h-full flex items-center justify-center text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
                disabled={isOutOfStock}
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center font-semibold text-slate-900">
                {quantity}
              </div>
              <button 
                onClick={() => setQuantity(q => Math.min(currentStock || 10, q + 1))}
                className="w-10 h-full flex items-center justify-center text-slate-500 hover:text-primary transition-colors disabled:opacity-50"
                disabled={isOutOfStock}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <Button 
              variant="outline" 
              className="flex-1 h-12 text-primary border-primary hover:bg-primary/5 font-semibold text-base"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Add to Cart
            </Button>
            
            <Button 
              className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-semibold text-base shadow-sm"
              onClick={handleBuyNow}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? 'Out of Stock' : 'Buy Now'}
            </Button>
          </div>

          {/* Secondary actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Button asChild variant="outline" className="w-full flex-1 h-12 border-slate-200 text-slate-700 font-medium hover:bg-slate-50 cursor-pointer">
              <a href={`tel:${(supportPhone || OFFICIAL_CONTACT.phone.tel).replace(/[^0-9+]/g, '')}`}>
                <Phone className="w-4 h-4 mr-2" />
                Call to Order
              </a>
            </Button>
            <Button asChild className="w-full flex-1 h-12 bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium shadow-sm border-none cursor-pointer">
              <a 
                href={`https://wa.me/${(whatsappNumber || OFFICIAL_CONTACT.phone.whatsappNumber).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello, I would like to order: ${product.name} (Price: ৳${currentPrice})`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </a>
            </Button>
          </div>

          {isOutOfStock && (
            <div className="mt-4 flex items-center gap-2 text-danger text-sm font-medium bg-danger/5 p-3 rounded-lg border border-danger/10">
              <AlertCircle className="w-4 h-4" />
              This item or selected variant is currently out of stock.
            </div>
          )}

        </div>
      </div>

      {/* Tabs & Sidebar Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mt-8">
        
        {/* LEFT: Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="about" className="w-full">
            <TabsList className="w-full justify-start border-b border-slate-200 rounded-none bg-transparent p-0 h-auto mb-8 space-x-8">
              <TabsTrigger 
                value="about" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 font-semibold text-base data-[state=active]:text-primary"
              >
                About Product
              </TabsTrigger>
              <TabsTrigger 
                value="reviews" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 py-3 font-semibold text-base data-[state=active]:text-primary"
              >
                Reviews ({product.reviews?.length || 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="about" className="space-y-10 animate-in fade-in duration-500 outline-none">
              {/* Description */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Description</h3>
                <div className="text-slate-600 leading-relaxed space-y-4">
                  {product.description ? (
                    <p className="whitespace-pre-line">{product.description}</p>
                  ) : (
                    <p>Ensure your mobile device operates at peak performance with our genuine tested spare parts. Designed for seamless replacement and long-lasting durability.</p>
                  )}
                </div>
              </div>

              {/* Specifications */}
              {product.specifications && product.specifications.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Technical Specifications</h3>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl overflow-hidden">
                    {product.specifications.map((spec, idx) => (
                      <div key={idx} className={`flex items-start sm:items-center flex-col sm:row px-4 py-3 sm:py-4 ${idx !== product.specifications.length - 1 ? 'border-b border-slate-200' : ''}`}>
                        <div className="w-full sm:w-1/3 text-sm font-semibold text-slate-700 mb-1 sm:mb-0">
                          {spec.label.trim().toLowerCase() === "colour" ? "Color" : spec.label}
                        </div>
                        <div className="w-full sm:w-2/3 text-sm text-slate-600">
                          {spec.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Benefits */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-4">Key Benefits</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <li className="flex items-start gap-3 text-slate-600 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>Tested for 100% functionality and compatibility</span>
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>Replacement guarantee against manufacturing defects</span>
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>Same day fast delivery within Dhaka city</span>
                  </li>
                  <li className="flex items-start gap-3 text-slate-600 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span>Expert installation support available at our branches</span>
                  </li>
                </ul>
              </div>

            </TabsContent>
            
            <TabsContent value="reviews" id="reviews" className="animate-in fade-in duration-500 outline-none">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Customer Reviews</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {product.reviews && product.reviews.length > 0 
                      ? `${product.reviews.length} verified review${product.reviews.length > 1 ? "s" : ""}` 
                      : "Verified purchaser feedback"}
                  </p>
                </div>
              </div>
              
              {product.reviews && product.reviews.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {product.reviews.map((review) => (
                    <div key={review.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">{review.customer?.name || "Verified Customer"}</h4>
                          <span className="text-xs text-slate-400">
                            {review.createdAt ? new Date(review.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                          </span>
                        </div>
                        <div className="flex items-center text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-slate-200'}`} />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-slate-600 text-sm leading-relaxed mt-2">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mb-3">
                    <Star className="w-6 h-6 fill-current" />
                  </div>
                  <h4 className="text-base font-semibold text-slate-800 mb-1">No reviews yet</h4>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Be the first to review this product and help other customers make an informed choice!
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* RIGHT: Branch pickup info */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm sticky top-24 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Branch Availability</h3>
            <p className="text-xs text-slate-500">Pick up your order or get expert fitting service directly at any of our outlets across Dhaka.</p>
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-800 text-xs font-medium">
              In-stock items are ready for pickup within 2 hours of ordering.
            </div>
          </div>
        </div>

      </div>

      {/* Related Products from live API */}
      {product.relatedProducts && product.relatedProducts.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Related Products</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
            {product.relatedProducts.map((relProduct: any) => (
              <ProductCard key={relProduct.id} product={relProduct} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Calendar, User, Eye, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, getImageUrl } from "@/lib/api-client";
import { BlogCard } from "@/components/storefront/BlogCard";

export default function BlogPostClientView({ params }: { params: { slug: string } }) {
  const [blog, setBlog] = useState<any>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [post, all] = await Promise.all([
          apiGet<any>(`/blogs/${params.slug}`).catch(() => null),
          apiGet<any>("/blogs?limit=4").catch(() => null),
        ]);
        setBlog(post);
        if (all?.data) {
          setRelatedBlogs(all.data.filter((b: any) => b.slug !== params.slug).slice(0, 3));
        }
      } catch (e) {
        console.error("Failed to load blog", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [params.slug]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-12 w-3/4 mx-auto" />
        <Skeleton className="aspect-[21/9] w-full rounded-3xl" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Article Not Found</h2>
        <p className="text-slate-500 text-sm mb-6">The article you are looking for does not exist or has been removed.</p>
        <Button asChild>
          <Link href="/blog">Back to Articles</Link>
        </Button>
      </div>
    );
  }

  const authorName = typeof blog.author === "string" ? blog.author : blog.author?.name || "MobileHubBD Team";
  const coverImage = blog.coverImage || blog.featuredImage;
  const viewCount = blog.viewCount ?? blog.views ?? 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button asChild variant="ghost" className="mb-6 -ml-4 text-slate-500 hover:text-slate-900">
        <Link href="/blog">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blogs
        </Link>
      </Button>

      <article className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight mb-6 leading-tight">
            {blog.title}
          </h1>
          
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 font-medium">
            <div className="flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span>By {authorName}</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <time dateTime={blog.createdAt}>
                {blog.createdAt ? format(new Date(blog.createdAt), "MMM dd, yyyy") : ""}
              </time>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>{viewCount.toLocaleString()} views</span>
            </div>
          </div>
        </header>

        {/* Cover Image */}
        {coverImage ? (
          <div className="relative w-full aspect-[21/9] rounded-3xl overflow-hidden mb-12 shadow-sm border border-slate-100 bg-slate-50">
            <img 
              src={getImageUrl(coverImage)} 
              alt={blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="relative w-full aspect-[21/9] rounded-3xl overflow-hidden mb-12 shadow-sm border border-slate-100 bg-slate-50">
            <img 
              src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&q=80" 
              alt={blog.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div 
          className="prose prose-lg prose-slate max-w-3xl mx-auto prose-headings:font-bold prose-headings:tracking-tight prose-a:text-emerald-600 prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: blog.content }}
        />
      </article>

      {/* Related Blogs */}
      {relatedBlogs.length > 0 && (
        <div className="max-w-5xl mx-auto mt-24 pt-12 border-t border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Related Articles</h2>
            <Link href="/blog" className="text-emerald-600 font-semibold text-sm hover:underline">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedBlogs.map((rb) => (
              <BlogCard key={rb.id} blog={rb} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { BlogCard } from "@/components/storefront/BlogCard";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api-client";

export default function BlogListingClientView() {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet<any>("/blogs?limit=12");
        setBlogs(res?.data || (Array.isArray(res) ? res : []));
      } catch (e) {
        console.error("Failed to fetch blogs", e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="max-w-3xl mx-auto text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">Latest Tech News & Guides</h1>
        <p className="text-slate-600">
          Stay updated with the latest mobile repair guides, industry news, and expert tips from the mobilehubbd team.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-2xl" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-16 bg-white border rounded-2xl p-8">
          <p className="text-slate-500 font-medium">No published articles available at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {blogs.map((blog) => (
            <BlogCard key={blog.id} blog={blog} />
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPage() {
  let posts: any[] = [];
  try {
    posts = await db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.isPublished, true))
      .orderBy(desc(blogPosts.publishedAt));
  } catch {}

  return (
    <div className="bg-white min-h-screen">
      <section className="pt-24 pb-12 text-center max-w-6xl mx-auto px-5">
        <span className="section-label">Blog</span>
        <h1
          className="text-[32px] font-semibold text-[#0a0a0a] mt-5"
          style={{ letterSpacing: "-0.03em" }}
        >
          Insights on AI evaluation
        </h1>
        <p className="text-[15px] text-[#8a8f98] leading-relaxed mt-3 max-w-xl mx-auto">
          Best practices, product updates, and deep dives into building
          reliable AI agents.
        </p>
      </section>

      <section className="pb-20 max-w-6xl mx-auto px-5">
        {posts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-[#ABC83A]/10 flex items-center justify-center mx-auto">
              <svg
                className="w-5 h-5 text-[#ABC83A]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.5h8.75m-8.75 0H3.75m8.75 0V3.75m0 3.75v8.25m0 0h8.75m-8.75 0H3.75"
                />
              </svg>
            </div>
            <h3 className="text-[15px] font-semibold text-[#0a0a0a] mt-4">
              No posts yet
            </h3>
            <p className="text-[14px] text-[#8a8f98] mt-2">
              We are working on our first articles. Check back soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post) => {
              let tags: string[] = [];
              try {
                tags = post.tags ? JSON.parse(post.tags) : [];
              } catch {
                tags = [];
              }

              return (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="rounded-xl border border-black/[0.06] p-5 block hover:border-black/[0.12] hover:shadow-sm transition-all duration-200 group"
                >
                  <h3 className="text-[15px] font-semibold text-[#0a0a0a] group-hover:text-[#ABC83A] transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-[14px] text-[#8a8f98] leading-relaxed mt-2 line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#ABC83A]/20 flex items-center justify-center">
                        <span className="text-[10px] font-semibold text-[#ABC83A]">
                          {post.author ? post.author[0].toUpperCase() : "E"}
                        </span>
                      </div>
                      <span className="text-[13px] text-[#8a8f98]">
                        {post.author || "EvalDesk Team"}
                      </span>
                    </div>
                    <span className="text-[12px] text-[#8a8f98]">
                      {formatDate(post.publishedAt)}
                    </span>
                  </div>
                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#ABC83A]/10 text-[#ABC83A]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

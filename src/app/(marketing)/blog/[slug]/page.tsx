import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { blogPosts } from "@/db/schema";
import { eq, desc, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

function formatDate(d: string | Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [post] = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.slug, slug))
    .limit(1);

  if (!post) notFound();

  const related = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.isPublished, true))
    .limit(3)
    .orderBy(desc(blogPosts.publishedAt));

  const filteredRelated = related.filter((r) => r.id !== post.id).slice(0, 2);

  let tags: string[] = [];
  try {
    tags = post.tags ? JSON.parse(post.tags) : [];
  } catch {}

  return (
    <div className="bg-white min-h-screen">
      <article className="max-w-3xl mx-auto px-5 pt-24 pb-20">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-[14px] text-[#8a8f98] hover:text-[#0a0a0a] transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to blog
        </Link>

        <h1
          className="text-[32px] font-semibold text-[#0a0a0a] mt-6 leading-tight"
          style={{ letterSpacing: "-0.03em" }}
        >
          {post.title}
        </h1>
        <div className="flex items-center gap-3 mt-4">
          <div className="w-8 h-8 rounded-full bg-[#ABC83A]/20 flex items-center justify-center">
            <span className="text-[12px] font-semibold text-[#ABC83A]">
              {post.author ? post.author[0].toUpperCase() : "E"}
            </span>
          </div>
          <div>
            <p className="text-[14px] font-medium text-[#0a0a0a]">
              {post.author || "EvalDesk Team"}
            </p>
            <p className="text-[13px] text-[#8a8f98]">
              {formatDate(post.publishedAt)}
            </p>
          </div>
        </div>

        <div
          className="mt-10 prose prose-gray max-w-none text-[15px] text-[#0a0a0a] leading-relaxed
            [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:text-[#0a0a0a] [&_h2]:mt-10 [&_h2]:mb-4
            [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:text-[#0a0a0a] [&_h3]:mt-8 [&_h3]:mb-3
            [&_p]:text-[#8a8f98] [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:text-[#8a8f98] [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc
            [&_ol]:text-[#8a8f98] [&_ol]:mb-4 [&_ol]:pl-5 [&_ol]:list-decimal
            [&_li]:mb-1
            [&_a]:text-[#ABC83A] [&_a]:underline
            [&_code]:bg-[#f5f5f5] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px]
            [&_pre]:bg-[#f5f5f5] [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-4
            [&_blockquote]:border-l-4 [&_blockquote]:border-[#ABC83A] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#8a8f98] [&_blockquote]:my-4"
          dangerouslySetInnerHTML={{ __html: post.content || "" }}
        />

        {tags.length > 0 && (
          <div className="mt-10 pt-6 border-t border-black/[0.06] flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#ABC83A]/10 text-[#ABC83A]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>

      {filteredRelated.length > 0 && (
        <section className="max-w-3xl mx-auto px-5 pb-20">
          <h2
            className="text-[20px] font-semibold text-[#0a0a0a] mb-6"
            style={{ letterSpacing: "-0.02em" }}
          >
            Related posts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRelated.map((relPost) => (
              <Link
                key={relPost.id}
                href={`/blog/${relPost.slug}`}
                className="rounded-xl border border-black/[0.06] p-5 block hover:border-black/[0.12] hover:shadow-sm transition-all duration-200 group"
              >
                <h3 className="text-[15px] font-semibold text-[#0a0a0a] group-hover:text-[#ABC83A] transition-colors">
                  {relPost.title}
                </h3>
                {relPost.excerpt && (
                  <p className="text-[14px] text-[#8a8f98] leading-relaxed mt-2 line-clamp-2">
                    {relPost.excerpt}
                  </p>
                )}
                <span className="text-[12px] text-[#8a8f98] mt-3 block">
                  {formatDate(relPost.publishedAt)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

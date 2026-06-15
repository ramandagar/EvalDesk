import Link from "next/link";

export const metadata = { title: "Blog — EvalDesk" };

const POSTS: { slug: string; title: string; excerpt: string; date: string }[] = [
  {
    slug: "ai-native-expert-verified",
    title: "AI-native, expert-verified: why both matter for regulated AI",
    excerpt: "An AI judge scores every answer in seconds; a credentialed expert verifies the uncertain ones; we measure the gap and sign the record.",
    date: "2026-06-01",
  },
];

export default function BlogPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-semibold mb-8">Blog</h1>
      <ul className="space-y-6">
        {POSTS.map((p) => (
          <li key={p.slug}>
            <Link href={`/blog/${p.slug}`} className="text-xl font-medium hover:underline">{p.title}</Link>
            <p className="text-sm text-neutral-500 mt-1">{p.date}</p>
            <p className="text-neutral-600 dark:text-neutral-400 mt-2">{p.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

import Link from "next/link";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <Link href="/blog" className="text-sm text-neutral-500 hover:underline">← Blog</Link>
      <h1 className="text-3xl font-semibold mt-4 mb-6">AI-native, expert-verified</h1>
      <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
        EvalDesk pairs an AI judge with a credentialed human reviewer, measures the agreement gap
        (Cohen&apos;s / Fleiss&apos; kappa + calibration), and emits a cryptographically signed,
        offline-verifiable evaluation record. The full engine is open-source and self-hostable.
      </p>
      <p className="mt-4 text-xs text-neutral-400">Post: {slug}</p>
    </div>
  );
}

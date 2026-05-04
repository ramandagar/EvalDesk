const stats = [
  { value: "100%", label: "of current eval tools require code" },
  { value: "$500+", label: "per month for no-code alternatives" },
  { value: "73%", label: "of AI teams lack domain expert review" },
  { value: "60s", label: "to deploy with docker compose" },
];

export function NumbersSection() {
  return (
    <section className="py-16 border-t border-b border-black/[0.06]">
      <div className="mx-auto max-w-6xl px-5">
        <div className="text-center mb-10">
          <span className="section-label">By the numbers</span>
          <h2 className="mt-4 text-[28px] font-semibold tracking-tight text-[#0a0a0a]" style={{ letterSpacing: "-0.03em" }}>The gap is real.</h2>
        </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-[36px] font-bold text-gradient md:text-[42px]" style={{ letterSpacing: "-0.04em" }}>{s.value}</p>
              <p className="mt-1 text-[13px] text-[#8a8f98]" style={{ letterSpacing: "-0.01em" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

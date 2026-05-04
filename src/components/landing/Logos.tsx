export function Logos() {
  const industries = ["Healthcare", "Legal", "Education", "Finance", "Insurance", "Customer Support"];
  return (
    <section className="border-t border-black/[0.06] py-10">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-center text-[12px] text-[#8a8f98] uppercase tracking-widest mb-5" style={{ letterSpacing: "0.1em" }}>Powering AI evaluation for</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {industries.map((ind) => (
            <span key={ind} className="text-[13px] font-medium text-[#8a8f98]">{ind}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

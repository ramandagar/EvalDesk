export default function Loading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#0a0a0a]/20 border-t-[#0a0a0a] rounded-full animate-spin" />
        <span className="text-xs text-[#8a8f98] font-mono tracking-wider uppercase">Loading...</span>
      </div>
    </div>
  );
}

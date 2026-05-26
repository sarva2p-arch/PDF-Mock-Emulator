export default function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-cyan-200 ${className}`}
    >
      Beta
    </span>
  );
}

export function GlowCoinIcon({ className = "size-10" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-300 via-primary to-cyan-300 p-1 shadow-[0_0_24px_hsl(var(--primary)/0.35)] ${className}`}
      aria-hidden="true"
    >
      <span className="flex size-full items-center justify-center rounded-full border border-white/50 bg-[#171531] text-[0.72em] font-black text-white">
        G
      </span>
    </span>
  );
}

export function BrandMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/favicon.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`}
      decoding="async"
    />
  );
}

export function BrandName({ suffix, className = "" }: { suffix?: string; className?: string }) {
  return (
    <span
      className={`font-extrabold leading-none ${className}`}
      style={{
        color: "var(--text-primary, #f7faff)",
        fontFamily: "var(--font-display)",
        letterSpacing: 0,
      }}
    >
      Collab<span style={{ color: "var(--neon, #31f58a)" }}>Manga</span>
      {suffix ? ` ${suffix}` : null}
    </span>
  );
}

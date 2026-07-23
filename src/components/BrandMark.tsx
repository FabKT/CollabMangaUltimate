export function BrandMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/favicon.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className}`}
      decoding="async"
    />
  );
}

import { Star } from "lucide-react";
import { useState } from "react";

interface Props {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
  label?: string;
}

export function StarRating({ value, onChange, size = 28, readOnly = false, label }: Props) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div
      role={readOnly ? "img" : "radiogroup"}
      aria-label={label ?? `${value} out of 5 stars`}
      className="inline-flex items-center gap-1"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= active;
        const Btn = readOnly ? "span" : "button";
        return (
          <Btn
            key={n}
            type={readOnly ? undefined : "button"}
            role={readOnly ? undefined : "radio"}
            aria-checked={readOnly ? undefined : n === value}
            aria-label={readOnly ? undefined : `${n} star${n === 1 ? "" : "s"}`}
            onClick={readOnly ? undefined : () => onChange?.(n)}
            onMouseEnter={readOnly ? undefined : () => setHover(n)}
            onFocus={readOnly ? undefined : () => setHover(n)}
            onBlur={readOnly ? undefined : () => setHover(0)}
            className={
              readOnly
                ? "inline-flex"
                : "inline-flex rounded-md p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-neon)]"
            }
            style={{ color: filled ? "var(--color-star)" : "rgba(184,196,229,0.35)" }}
          >
            <Star
              width={size}
              height={size}
              fill={filled ? "currentColor" : "none"}
              strokeWidth={1.5}
            />
          </Btn>
        );
      })}
    </div>
  );
}
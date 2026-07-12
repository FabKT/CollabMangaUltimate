import { useState } from "react";
import { StarRating } from "./StarRating";

export function RatingSection() {
  const [rating, setRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="panel p-6 md:p-8">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="font-display text-[20px] font-bold leading-7">Rate this chapter</h2>
          <p className="mt-2 max-w-md text-[14px] leading-[22px] text-[color:var(--color-text-secondary)]">
            Your rating helps readers discover quality chapters.
          </p>
          <dl className="mt-5 flex flex-wrap gap-6 text-[13px]">
            <div>
              <dt className="meta-label">Average rating</dt>
              <dd className="mt-1 font-display text-[18px] font-bold text-[color:var(--color-text-primary)]">
                No rating yet
              </dd>
            </div>
            <div>
              <dt className="meta-label">Your rating</dt>
              <dd
                className="mt-1 font-display text-[18px] font-bold"
                style={{ color: rating ? "var(--color-neon)" : "var(--color-text-primary)" }}
              >
                {rating ? `${rating} / 5 selected` : "Not rated"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <StarRating value={rating} onChange={setRating} size={34} label="Rate this chapter" />
          <div className="flex gap-2">
            {submitted ? (
              <button type="button" className="btn-secondary" onClick={() => setSubmitted(false)} disabled={!rating}>
                Update Rating
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={!rating} onClick={() => setSubmitted(true)}>
                Submit Rating
              </button>
            )}
          </div>
          {submitted && (
            <p className="text-[13px] font-bold" style={{ color: "var(--color-neon)" }} role="status">
              Thanks — your rating was submitted.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
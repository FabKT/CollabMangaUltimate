import { Search, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

interface Props {
  query: string;
  onQuery: (v: string) => void;
  genre: string;
  onGenre: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
  sort: string;
  onSort: (v: string) => void;
  onReset: () => void;
}

const GENRES = ["All genres", "Genre A", "Genre B", "Genre C", "Genre D", "Genre E"];
const STATUSES = ["All", "Ongoing", "Completed", "New", "Recently updated"];
const SORTS = ["Recently updated", "Newest", "Most followed", "Best rated", "Most discussed"];

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field appearance-none pr-9 text-[14px]"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-[color:var(--color-panel)] text-[color:var(--color-text-primary)]">
            {o}
          </option>
        ))}
      </select>
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute right-3 h-4 w-4 text-[color:var(--color-text-muted)]">
        <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

export function FilterBar(props: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="panel p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search manga</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-text-muted)]" />
          <input
            type="search"
            placeholder="Search manga…"
            value={props.query}
            onChange={(e) => props.onQuery(e.target.value)}
            className="input-field pl-10"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-2">
          <Select label="Genre" value={props.genre} onChange={props.onGenre} options={GENRES} />
          <Select label="Status" value={props.status} onChange={props.onStatus} options={STATUSES} />
          <Select label="Sort" value={props.sort} onChange={props.onSort} options={SORTS} />
          <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="btn-secondary" aria-expanded={showAdvanced}>
            <SlidersHorizontal className="h-4 w-4" />
            Advanced filters
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-5 grid gap-4 border-t border-[color:var(--color-border-default)] pt-5 md:grid-cols-3">
          {["Language","Creator","Chapters range","Publication status","Rating","Update frequency","Tags","Content tone","Reading time","Release year"].map((f) => (
            <div key={f} className="flex flex-col gap-1.5">
              <span className="meta-label">{f}</span>
              <input placeholder={`${f} placeholder`} className="input-field" />
            </div>
          ))}
          <div className="md:col-span-3 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={props.onReset}>Reset Filters</button>
            <button type="button" className="btn-primary" onClick={() => setShowAdvanced(false)}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
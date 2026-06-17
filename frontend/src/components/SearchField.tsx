/**
 * Search input shared by Orders and Products tabs.
 */

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  resultCount?: number;
  totalCount?: number;
}

export function SearchField({
  value,
  onChange,
  placeholder,
  resultCount,
  totalCount,
}: SearchFieldProps) {
  return (
    <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur-md">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full max-w-md rounded-xl border border-slate-300/80 bg-white px-4 py-3 text-base font-medium text-ink shadow-sm placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
        {resultCount != null && totalCount != null && value.trim() && (
          <p className="text-base font-semibold text-ink-muted">
            Showing {resultCount} of {totalCount}
          </p>
        )}
      </div>
    </div>
  );
}

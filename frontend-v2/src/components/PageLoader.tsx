// #startup-ux: fallback Suspense untuk lazy route —
// feedback instan ("Memuat…") saat chunk halaman di-download pertama kali.
export function PageLoader({ label = "Memuat…" }: { label?: string }) {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-400"
      role="status"
      aria-live="polite"
    >
      <svg className="h-8 w-8 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <p className="text-sm">{label}</p>
    </div>
  );
}

export default PageLoader;

// Design system v2 — #93. Komponen reusable, tailwind, aksesibel.
import type { ButtonHTMLAttributes, ReactNode } from "react";

/* ── Button ──────────────────────────────────────────────── */
type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "warning";
type BtnSize = "sm" | "md" | "lg";
const BTN_V: Record<BtnVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700",
  outline: "border border-slate-300 text-slate-700 hover:bg-slate-100",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  warning: "bg-amber-500 text-white hover:bg-amber-600",
};
const BTN_S: Record<BtnSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 ${BTN_V[variant]} ${BTN_S[size]} ${className}`}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {children}
    </button>
  );
}

/* ── Card & StatCard ─────────────────────────────────────── */
export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function StatCard({
  icon,
  label,
  value,
  tone = "brand",
  hint,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  tone?: "brand" | "green" | "red" | "amber";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {icon && <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>}
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="truncate text-xl font-bold text-slate-900">{value}</p>
          {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

/* ── Badge status ──────────────────────────────────────────── */
const STATUS_TONE: Record<string, string> = {
  Queue: "bg-slate-100 text-slate-700",
  Diagnosing: "bg-amber-100 text-amber-700",
  In_Progress: "bg-blue-100 text-blue-700",
  Waiting_Part: "bg-orange-100 text-orange-700",
  Completed: "bg-green-100 text-green-700",
  Ready_For_Pickup: "bg-teal-100 text-teal-700",
  Picked_Up: "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
  Pending: "bg-amber-100 text-amber-700",
  Searching: "bg-sky-100 text-sky-700",
  Arrived: "bg-green-100 text-green-700",
  Draft: "bg-slate-100 text-slate-600",
  pos: "bg-emerald-100 text-emerald-700",
  service: "bg-sky-100 text-sky-700",
  servis: "bg-sky-100 text-sky-700",
  order: "bg-violet-100 text-violet-700",
};
export function Badge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status] ?? "bg-slate-100 text-slate-600"} ${className}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ── Form field ──────────────────────────────────────────── */
export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    />
  );
}

/* ── Loading & state kosong ──────────────────────────────── */
export function Spinner({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function EmptyState({ icon = "🗂️", title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {action}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} />;
}

/* ── Error / alert ───────────────────────────────────────── */
export function Alert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: ReactNode }) {
  const t: Record<string, string> = {
    error: "bg-red-50 text-red-700 border-red-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-green-50 text-green-700 border-green-200",
  };
  return <div className={`rounded-lg border px-3 py-2 text-sm ${t[tone]}`}>{children}</div>;
}

/* ── Util ─────────────────────────────────────────────────── */
export function formatIDR(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}
// #114: Pattern Lock 9-titik (SVG custom, tanpa library) — pola perangkat.
// Titik dinomori 1..9 (kiri-atas → kanan-bawah). Nilai = string "1-3-5-7-9".
// Opsional: kosongkan dengan tombol Reset / klik ikon hapus.
import { useRef, useState } from "react";

const SIZE = 220;
const R = 34; // jari-jari area sentuh per titik
const POS: [number, number][] = [
  [55, 55], [110, 55], [165, 55],
  [55, 110], [110, 110], [165, 110],
  [55, 165], [110, 165], [165, 165],
];

function pointAt(x: number, y: number): number | null {
  const svg = POS.map(([px, py], i) => ({ i: i + 1, d: Math.hypot(x - px, y - py) }));
  const best = svg.reduce((a, b) => (b.d < a.d ? b : a));
  return best.d <= R ? best.i : null;
}

/** #114: preview read-only pola (dipakai di ServiceDetailPage). */
export function PatternPreview({ pattern, size = 120 }: { pattern: string; size?: number }) {
  const seq = pattern.split("-").map(Number);
  const scale = size / SIZE;
  const pts = seq.map((i) => POS[i - 1]!.map((v) => v * scale) as [number, number]);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto mt-2"
      role="img"
      aria-label={`Pola kunci ${seq.length} titik`}
    >
      {pts.length > 1 && (
        <polyline
          points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
          className="fill-none stroke-brand-500"
          strokeWidth={3 * scale}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      )}
      {POS.map(([x, y], i) => (
        <circle
          key={i + 1}
          cx={x * scale}
          cy={y * scale}
          r={12 * scale}
          className={seq.includes(i + 1) ? "fill-brand-600" : "fill-slate-200"}
        />
      ))}
    </svg>
  );
}

export default function PatternLock({
  value,
  onChange,
  label = "Pola Kunci Perangkat (opsional)",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const seq = value ? value.split("-").map(Number) : [];

  function local(e: React.PointerEvent): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function tapPoint(e: React.PointerEvent) {
    const p = local(e);
    if (!p) return;
    const idx = pointAt(p.x, p.y);
    if (idx === null) return;
    const next = seq.includes(idx) ? seq : [...seq, idx];
    if (next.length > 9) return;
    setError(false);
    onChange(next.join("-"));
    if (svgRef.current) svgRef.current.setPointerCapture(e.pointerId);
  }

  function dragPoint(e: React.PointerEvent) {
    const p = local(e);
    if (!p) return;
    setDrag(p);
    const idx = pointAt(p.x, p.y);
    if (idx !== null && !seq.includes(idx) && seq.length < 9) {
      onChange([...seq, idx].join("-"));
    }
  }

  function endDrag() {
    setDrag(null);
  }

  function clearPattern() {
    onChange("");
    setError(false);
  }

  // garis: titik terhubung + (opsional) posisi pointer saat drag
  const linePoints =
    drag && seq.length
      ? [...seq.map((i) => POS[i - 1]), [drag.x, drag.y] as [number, number]]
      : seq.map((i) => POS[i - 1]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {seq.length > 0 && (
          <button
            type="button"
            onClick={clearPattern}
            className="text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            ✕ Hapus pola
          </button>
        )}
      </div>
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={`mx-auto mt-2 touch-none rounded-xl border ${error ? "border-rose-400" : "border-slate-200"} bg-slate-50`}
        onPointerDown={tapPoint}
        onPointerMove={dragPoint}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        role="img"
        aria-label="Pattern lock 9 titik"
      >
        <rect x="8" y="8" width={SIZE - 16} height={SIZE - 16} rx="14" className="fill-white" />
        {linePoints.length > 1 && (
          <polyline
            points={linePoints.map(([x, y]) => `${x},${y}`).join(" ")}
            className="fill-none stroke-brand-500"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.6"
          />
        )}
        {POS.map(([x, y], i) => {
          const n = i + 1;
          const active = seq.includes(n);
          return (
            <g key={n}>
              <circle cx={x} cy={y} r={R} className="fill-transparent" />
              <circle
                cx={x}
                cy={y}
                r="12"
                className={active ? "fill-brand-600" : "fill-slate-200"}
                stroke={active ? "#4f46e5" : "#cbd5e1"}
                strokeWidth="2"
              />
              {active && (
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  className="fill-white text-[11px] font-semibold"
                >
                  {seq.indexOf(n) + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-xs text-slate-400">
        {seq.length === 0
          ? "Gambar pola minimal 4 titik (opsional)"
          : seq.length < 4
            ? `Titik terhubung: ${seq.length}/4 — butuh minimal 4`
            : `Pola tersimpan (${seq.length} titik)`}
      </p>
    </div>
  );
}

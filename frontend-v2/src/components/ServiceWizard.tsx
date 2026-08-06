// Wizard multistep buat tiket servis — #93 UX rework.
// Langkah: 1) Pelanggan  2) Unit & Foto  3) Masalah & Keamanan  4) Ringkasan
// Draft autosave di localStorage (localStorage draft pelayanan).
import { useEffect, useRef, useState, type FormEvent } from "react";
import api from "../lib/api";
import { Button, Alert } from "../components/ui";
import { compressToDataUrl } from "../lib/photoCompress";
import PatternLock from "./PatternLock";

const STEPS = ["Pelanggan", "Unit & Foto", "Masalah & Keamanan", "Ringkasan"];
const DRAFT_KEY = "utc_draft_tiket";

interface Draft {
  customerName: string;
  customerPhone: string;
  customerEmail: string; // #103: email utk nota digital
  brand: string;
  model: string;
  serial: string;
  issue: string;
  securityCode: string;
  patternLock: string; // #114: pola 9-titik (opsional, "1-3-5-7-9")
  notes: string;
  photos: string[]; // dataURL kecil
}

const EMPTY: Draft = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  brand: "",
  model: "",
  serial: "",
  issue: "",
  securityCode: "",
  patternLock: "",
  notes: "",
  photos: [],
};

export function ServiceWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Draft>(EMPTY);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // autosave draft
  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d && typeof d.customerName === "string") setF({ ...EMPTY, ...d });
      } catch { /* abaikan draft korup */ }
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(f));
    } catch { /* storage penuh — abaikan */ }
  }, [f]);

  const set = (k: keyof Draft, v: string) => setF((p) => ({ ...p, [k]: v }));

  function canNext(): boolean {
    if (step === 0) return f.customerName.trim().length > 0;
    if (step === 1) return f.brand.trim().length > 0;
    if (step === 2) return f.issue.trim().length > 0;
    // #114: pola boleh kosong, tapi kalau diisi harus >= 4 titik
    if (step === 3 && f.patternLock && f.patternLock.split("-").length < 4) return false;
    return true;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/v2/services", {
        customerName: f.customerName,
        customerPhone: f.customerPhone || undefined,
        customerEmail: f.customerEmail.trim() || undefined, // #103
        device: {
          brand: f.brand,
          model: f.model || undefined,
          serial: f.serial || undefined,
          issue: f.issue,
          securityCode: f.securityCode || undefined,
          patternLock: f.patternLock || undefined,
          photos: f.photos.length ? f.photos : undefined,
        },
        notes: f.notes || undefined,
      });
      localStorage.removeItem(DRAFT_KEY);
      onDone();
    } catch (e2: any) {
      setError(e2?.response?.data?.error || "Gagal membuat tiket.");
      setSaving(false);
    }
  }

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, 4);
    for (const file of list) {
      try {
        // #109: kompres dulu di browser (target ≤ ~300KB) sebelum disimpan
        const url = await compressToDataUrl(file);
        if (url.length < 400_000) setF((p) => ({ ...p, photos: [...p.photos, url].slice(0, 4) }));
      } catch {
        setError("Gagal mengompresi foto. Coba foto lain.");
      }
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* stepper */}
      <ol className="flex gap-1 text-xs font-medium" aria-label="Langkah buat tiket">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full px-2.5 py-1 ${
                i === step
                  ? "bg-brand-600 text-white"
                  : i < step
                    ? "bg-brand-100 text-brand-700"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {i + 1}. {s}
            </button>
            {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
          </li>
        ))}
      </ol>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Langkah 1 — Pelanggan */}
      {step === 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            Nama pelanggan *
            <input
              value={f.customerName}
              onChange={(e) => set("customerName", e.target.value)}
              placeholder="cth: Budi Santoso"
              autoFocus
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="text-sm">
            No. HP
            <input
              value={f.customerPhone}
              onChange={(e) => set("customerPhone", e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="text-sm md:col-span-2">
            Email pelanggan <span className="text-slate-400">(untuk nota digital)</span>
            <input
              type="email"
              value={f.customerEmail}
              onChange={(e) => set("customerEmail", e.target.value)}
              placeholder="cth: budi@email.com"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
        </div>
      )}

      {/* Langkah 2 — Unit & Foto */}
      {step === 1 && (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm">
              Merek device *
              <input
                value={f.brand}
                onChange={(e) => set("brand", e.target.value)}
                placeholder="cth: Samsung"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="text-sm">
              Tipe / model
              <input
                value={f.model}
                onChange={(e) => set("model", e.target.value)}
                placeholder="cth: A54"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="text-sm">
              Nomor seri / IMEI
              <input
                value={f.serial}
                onChange={(e) => set("serial", e.target.value)}
                placeholder="opsional"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>
          <div>
            <p className="text-sm text-slate-600">Foto unit (maks. 4, ringkas — disimpan di tiket)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {f.photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt={`Foto unit ${i + 1}`} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                  <button
                    type="button"
                    aria-label={`Hapus foto ${i + 1}`}
                    onClick={() => setF((prev) => ({ ...prev, photos: prev.photos.filter((_, j) => j !== i) }))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {f.photos.length < 4 && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-2xl text-slate-400 hover:border-brand-400"
                  aria-label="Tambah foto"
                >
                  +
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addPhotos(e.target.files)}
            />
          </div>
        </div>
      )}

      {/* Langkah 3 — Masalah & Keamanan */}
      {step === 2 && (
        <div className="grid gap-3">
          <label className="text-sm">
            Keluhan / kerusakan *
            <textarea
              value={f.issue}
              onChange={(e) => set("issue", e.target.value)}
              rows={3}
              placeholder="Jelaskan keluhan pelanggan…"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Kode keamanan (PIN unit pelanggan)
              <input
                value={f.securityCode}
                onChange={(e) => set("securityCode", e.target.value)}
                placeholder="opsional — dipakai saat diagnosa"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
            <label className="text-sm">
              Catatan tambahan
              <input
                value={f.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="opsional"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </label>
          </div>
          {/* #114: pola kunci perangkat — opsional, min 4 titik */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <PatternLock
              value={f.patternLock}
              onChange={(v) => {
                setF((prev) => ({ ...prev, patternLock: v }));
                if (!canNext()) setError("");
              }}
            />
            <p className="mt-2 text-xs text-slate-400">
              Teknisi akan melihat pola ini di detail tiket untuk membuka unit pelanggan.
            </p>
          </div>
        </div>
      )}

      {/* Langkah 4 — Ringkasan */}
      {step === 3 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <dl className="grid gap-2 md:grid-cols-2">
            <div><dt className="text-slate-400">Pelanggan</dt><dd className="font-medium text-slate-800">{f.customerName} {f.customerPhone && <span className="text-slate-500">· {f.customerPhone}</span>}</dd></div>
            <div><dt className="text-slate-400">Unit</dt><dd className="font-medium text-slate-800">{f.brand} {f.model} {f.serial && <span className="text-slate-500">· {f.serial}</span>}</dd></div>
            <div><dt className="text-slate-400">Keluhan</dt><dd className="font-medium text-slate-800">{f.issue}</dd></div>
            <div><dt className="text-slate-400">Foto</dt><dd className="font-medium text-slate-800">{f.photos.length ? `${f.photos.length} foto` : "—"}</dd></div>
            <div><dt className="text-slate-400">Pola kunci</dt><dd className="font-medium text-slate-800">{f.patternLock ? `${f.patternLock.split("-").length} titik (${f.patternLock})` : "—"}</dd></div>
            {(f.securityCode || f.notes) && (
              <div className="md:col-span-2"><dt className="text-slate-400">Ekstra</dt><dd className="font-medium text-slate-800">{f.securityCode && `Kode keamanan: ${f.securityCode}`}{f.securityCode && f.notes ? " · " : ""}{f.notes}</dd></div>
            )}
          </dl>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={() => (step === 0 ? onDone() : setStep(step - 1))}>
          {step === 0 ? "Batal" : "← Kembali"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => canNext() && setStep(step + 1)} disabled={!canNext()}>
            Lanjut →
          </Button>
        ) : (
          <Button type="submit" loading={saving}>
            Simpan Tiket
          </Button>
        )}
      </div>
    </form>
  );
}
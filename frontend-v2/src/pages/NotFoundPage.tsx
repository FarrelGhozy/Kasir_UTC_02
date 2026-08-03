import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-4 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-800">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Halaman yang kamu cari tidak ada atau sudah dipindahkan.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Kembali ke Dashboard
      </Link>
    </div>
  );
}
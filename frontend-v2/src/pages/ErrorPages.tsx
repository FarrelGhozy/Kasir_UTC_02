import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";

export function ErrorPage({
  code,
  title,
  message,
}: {
  code: string;
  title: string;
  message: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="text-6xl font-black text-brand-600">{code}</p>
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
      <div className="mt-2 flex gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          Kembali
        </Button>
        <Button onClick={() => navigate("/")}>Ke Dashboard</Button>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <ErrorPage
      code="404"
      title="Halaman tidak ditemukan"
      message="Alamat yang kamu buka tidak ada atau sudah dipindah. Cek kembali atau kembali ke beranda."
    />
  );
}

export function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      title="Akses ditolak"
      message="Akun kamu tidak punya izin untuk membuka halaman ini. Hubungi admin bila ini keliru."
    />
  );
}

export function ServerErrorPage() {
  return (
    <ErrorPage
      code="500"
      title="Terjadi kendala server"
      message="Kami sedang menanganinya. Coba beberapa saat lagi, atau kembali ke beranda."
    />
  );
}
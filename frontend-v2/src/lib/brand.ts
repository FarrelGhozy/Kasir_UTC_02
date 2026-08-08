// Brand config — SATU sumber kebenaran utk nama usaha, alamat, kontak.
// Jangan hardcode "Siman" / "Unida No.1" / "BENGKEL UTC" di halaman.
import logoUrl from "../assets/logo.webp";
import wallpaperUrl from "../assets/unidapoenya.jpg";

export const BRAND = {
  name: "Kasir UTC",
  shortName: "UTC",
  tagline: "Sistem Manajemen Workshop & POS",
  address: "Unida No.1, Gontor",
  phone: "0812-3456-7890",
  email: "cs@utc.id",
  // aset visual — dipakai login wallpaper, sidebar, dll
  logo: logoUrl,
  wallpaper: wallpaperUrl,
} as const;

export type Brand = typeof BRAND;

// #109: kompresi foto di browser sebelum disimpan (paritas main: browser-image-compression).
// Target: ≤ ~300KB per foto supaya dataURL tidak membebani DB & payload request.
import imageCompression from "browser-image-compression";

const OPTS = {
  maxSizeMB: 0.3,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
  initialQuality: 0.75,
};

/** Kompres file gambar → dataURL kecil. Throws kalau hasil tetap > batas. */
export async function compressToDataUrl(file: File): Promise<string> {
  const compressed = await imageCompression(file, OPTS);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca gambar"));
    reader.readAsDataURL(compressed);
  });
}

/** Batas panjang dataURL yang diterima backend (chars). ~2MB binary ≈ 2.8M chars base64. */
export const MAX_PHOTO_CHARS = 2_800_000;

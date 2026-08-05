// Util cetak PDF nota (#104) — dipakai PosPage, NotaPage, ServiceDetailPage, OrderDetailPage.
import api from "./api";

export type NotaSource = "pos" | "servis" | "order";

/** Fetch PDF nota (blob) + buka di tab baru. Token dikirim via header (aman, tidak bocor ke URL). */
export async function openNotaPdf(source: NotaSource, id: number) {
  try {
    const { data } = await api.get(`/v2/notas/${source}/${id}/pdf`, {
      responseType: "blob",
      timeout: 20000,
    });
    const url = URL.createObjectURL(data as Blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e: any) {
    console.error("Gagal memuat PDF nota:", e);
    alert("Gagal membuat PDF nota. Coba lagi.");
  }
}

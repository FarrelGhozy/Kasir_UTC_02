// backend/utils/paymentStatus.js - Helper terpusat untuk status pembayaran nota
// Definisi tunggal agar PDF, WhatsApp, arsip, dan frontend konsisten.

/**
 * Hitung total biaya tiket servis dari parts + jasa
 * @param {Object} ticket Dokumen tiket servis (boleh lean object)
 * @returns {Number} total biaya
 */
function getServiceTotal(ticket) {
  if (!ticket) return 0;
  if (typeof ticket.total_cost === 'number' && ticket.total_cost > 0) return ticket.total_cost;
  const partsTotal = Array.isArray(ticket.parts_used)
    ? ticket.parts_used.reduce((sum, p) => sum + (Number(p.subtotal) || 0), 0)
    : 0;
  return partsTotal + (Number(ticket.service_fee) || 0);
}

/**
 * Tentukan apakah tiket servis sudah LUNAS.
 * Lunas = (status Picked_Up dan ada payment_method) ATAU total biaya 0 (gratis).
 * @param {Object} ticket Dokumen tiket servis
 * @returns {Boolean} true jika lunas
 */
function isServicePaid(ticket) {
  if (!ticket) return false;
  const total = getServiceTotal(ticket);
  if (total === 0) return true;
  if (ticket.payment_status === 'Lunas') return true;
  if (ticket.status === 'Picked_Up' && ticket.payment_method) return true;
  return false;
}

/**
 * Label status bayar tiket servis: 'Lunas' atau 'Belum Lunas'
 * @param {Object} ticket Dokumen tiket servis
 * @returns {String} 'Lunas' | 'Belum Lunas'
 */
function getServicePaymentStatus(ticket) {
  return isServicePaid(ticket) ? 'Lunas' : 'Belum Lunas';
}

/**
 * Hitung sisa bayar pesanan barang
 * @param {Object} order Dokumen pesanan
 * @returns {Number} sisa bayar
 */
function getOrderRemaining(order) {
  if (!order) return 0;
  return Math.max(0, (Number(order.estimated_price) || 0) - (Number(order.down_payment) || 0));
}

/**
 * Tentukan apakah pesanan sudah LUNAS.
 * Lunas jika sisa 0 (DP penuh) ATAU flag manual 'Lunas' (sisa dilunasi saat ambil).
 * @param {Object} order Dokumen pesanan
 * @returns {Boolean} true jika lunas
 */
function isOrderPaid(order) {
  if (!order) return false;
  if (order.payment_status === 'Lunas') return true;
  return getOrderRemaining(order) === 0;
}

/**
 * Label status bayar pesanan: 'Lunas' atau 'Belum Lunas'
 * @param {Object} order Dokumen pesanan
 * @returns {String} 'Lunas' | 'Belum Lunas'
 */
function getOrderPaymentStatus(order) {
  if (order.payment_status === 'Lunas') return 'Lunas';
  if (getOrderRemaining(order) === 0) return 'Lunas';
  return 'Belum Lunas';
}

module.exports = {
  getServiceTotal,
  isServicePaid,
  getServicePaymentStatus,
  getOrderRemaining,
  isOrderPaid,
  getOrderPaymentStatus
};

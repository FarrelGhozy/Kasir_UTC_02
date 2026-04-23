const config = require('./botConfig');
const { sendReply } = require('./wahaClient');

// In-memory storage untuk session
const chatSessions = new Map();
const waitMessageThrottling = new Map(); // Untuk mencegah spam pesan "tunggu"

const WAIT_THROTTLE_TIME = 2 * 60 * 60 * 1000; // 2 Jam (Jangan kirim pesan "tunggu" berulang dalam 2 jam)

function isWorkingHours() {
  if (process.env.IS_CAMPUS_EVENT === 'true') return { open: false, reason: 'event' };
  
  const now = new Date();
  // Konversi ke WIB (UTC+7)
  const wibTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
  
  const day = wibTime.getDay();
  const hour = wibTime.getHours();

  if (day === config.CLOSED_DAY) return { open: false, reason: 'friday' };
  if (hour < config.OPERATIONAL_HOURS.OPEN || hour >= config.OPERATIONAL_HOURS.CLOSE) {
    return { open: false, reason: 'hours' };
  }
  
  return { open: true };
}

function getClosedMessage(reason) {
  if (reason === 'event') return "*PEMBERITAHUAN:* Saat ini kami sedang tutup sementara karena ada *Acara Wajib Kampus*. 🎓";
  if (reason === 'friday') return "*PEMBERITAHUAN:* Hari ini adalah hari Jumat, jadwal kami *Libur Mingguan*. 🕌";
  return "*PEMBERITAHUAN:* Kakak menghubungi kami di luar jam operasional. 🌙";
}

async function handleIncomingMessage(payload) {
  const { from, fromMe, isGroup, isStatus } = payload;

  if (fromMe || isGroup || isStatus || from.includes('@g.us')) return;

  const now = Date.now();
  const lastChat = chatSessions.get(from);
  const status = isWorkingHours();

  // 2. Logika Session (12 Jam)
  if (lastChat && (now - lastChat < config.SESSION_LIMIT)) {
    const lastWaitSent = waitMessageThrottling.get(from);

    if (!lastWaitSent || (now - lastWaitSent > WAIT_THROTTLE_TIME)) {
      let waitMsg = "Pesan Kakak sudah masuk di sistem kami ya. Mohon tunggu sebentar, Admin *Unida Technology Centre* akan membalas satu per satu sesuai antrean. 🙏😊";
      
      // Jika chat saat tutup, ingatkan kembali statusnya
      if (!status.open) {
        waitMsg = `${getClosedMessage(status.reason)}\n\n${waitMsg}`;
      }

      await sendReply(from, waitMsg);
      waitMessageThrottling.set(from, now);
    }
    return;
  }

  // 3. Update Session Timestamp & Reset Throttle
  chatSessions.set(from, now);
  waitMessageThrottling.set(from, now);

  // 4. Susun Pesan Sambutan Lengkap
  let welcomeMsg = `Assalamualaikum Warahmatullahi Wabarakatuh / Halo Kak! 👋\n\nSelamat datang di *${config.BUSINESS_NAME}*.\n\nKami melayani:\n${config.SERVICES.map(s => `• ${s}`).join('\n')}\n\n`;

  if (!status.open) {
    welcomeMsg += `${getClosedMessage(status.reason)}\n\n`;
  }

  welcomeMsg += `*Jam Operasional UTC:*\n🗓️ Setiap Hari (Kecuali Jumat)\n🕗 08.00 - 15.00 WIB\n\nPesan Kakak sudah kami terima. Mohon ditunggu ya, Admin kami akan segera merespons pesan Kakak. Terima kasih atas kesabarannya. 😊🙏`;

  await sendReply(from, welcomeMsg);
}

module.exports = { handleIncomingMessage };
// Config terpusat dengan validasi wajib — hardening #91
export const config = {
  PORT: Number(process.env.PORT || 5300),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:8090",
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  NODE_ENV: process.env.NODE_ENV || "development",
  WAHA_URL: process.env.WAHA_URL || "http://localhost:8000",
  WAHA_API_KEY: process.env.WAHA_API_KEY || "",
};

// SEC-1 fix: reject placeholder/empty JWT secret — jangan dikompromi
const PLACEHOLDER_SECRETS = [
  "change_this_in_production",
  "change_this_in_production_min_32_chars",
  "secret",
  "changeme",
];

export function assertSecureConfig() {
  const { JWT_SECRET } = config;
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      "[SEC-1] JWT_SECRET wajib di-set (>= 32 char). Generate: openssl rand -hex 32"
    );
  }
  if (PLACEHOLDER_SECRETS.some((s) => JWT_SECRET.includes(s))) {
    throw new Error("[SEC-1] JWT_SECRET masih placeholder — tolong ganti!");
  }
  if (config.NODE_ENV === "production" && config.CORS_ORIGIN === "*") {
    throw new Error('[SEC-3] CORS_ORIGIN="*" dilarang di production');
  }
}
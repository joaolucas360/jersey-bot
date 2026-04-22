require('dotenv').config({ override: true });

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const port = Number.parseInt(process.env.PORT, 10);
const pendingOrderTtlMinutes = Number.parseInt(process.env.PENDING_ORDER_TTL_MINUTES, 10);

module.exports = {
  PORT: Number.isFinite(port) ? port : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID: process.env.WHATSAPP_PHONE_ID,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  ADMIN_TOKEN: process.env.ADMIN_TOKEN,
  PIX_KEY: process.env.PIX_KEY,
  PENDING_ORDER_TTL_MINUTES: Number.isInteger(pendingOrderTtlMinutes) && pendingOrderTtlMinutes > 0
    ? pendingOrderTtlMinutes
    : 120,
  DB_SSL: parseBoolean(process.env.DB_SSL, true),
  DB_CONNECT_TIMEOUT_MS: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 10000,
};

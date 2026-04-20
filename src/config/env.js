require('dotenv').config();

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const port = Number.parseInt(process.env.PORT, 10);

module.exports = {
  PORT: Number.isFinite(port) ? port : 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_URL_DIRECT: process.env.DATABASE_URL_DIRECT,
  WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  DB_SSL: parseBoolean(process.env.DB_SSL, true),
  DB_CONNECT_TIMEOUT_MS: Number.parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 10000,
};

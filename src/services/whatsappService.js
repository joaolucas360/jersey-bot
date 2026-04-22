const {
  WHATSAPP_TOKEN,
  WHATSAPP_PHONE_ID,
} = require('../config/env');

async function sendMessage(to, text) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    throw new Error('Meta envs ausentes: WHATSAPP_TOKEN e WHATSAPP_PHONE_ID');
  }

  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_ID}/messages`;

  const normalizedTo = String(to || '').replace(/\D/g, '');
  if (!normalizedTo) {
    throw new Error('Número de destino inválido');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'text',
      text: { body: text },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Meta API error:', JSON.stringify(data));
    throw new Error('Falha ao enviar mensagem pela Meta API');
  }

  console.log(`Message sent to ${normalizedTo}`);
  return data;
}

module.exports = { sendMessage };

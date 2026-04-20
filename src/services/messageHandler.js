const db = require('../config/db');
const { getConversation, updateConversation } = require('./conversationService');
const { listProducts } = require('./productService');
const { processMessage } = require('./groqService');

function normalizeConversationContext(rawContext) {
  if (!rawContext) return {};
  if (typeof rawContext === 'object') return rawContext;

  try {
    return JSON.parse(rawContext);
  } catch (_err) {
    return {};
  }
}

async function handleIncomingMessage(body) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages?.length) return;

  const message = value.messages[0];
  if (message?.type !== 'text' || !message.text?.body) {
    console.log('Ignoring non-text WhatsApp event');
    return;
  }

  const phone = message.from;
  if (!phone) {
    console.warn('Message received without sender phone number');
    return;
  }

  const text = message.text?.body?.trim() || '';
  if (!text) return;

  console.log(`Message from ${phone}: ${text}`);

  const customerResult = await db.query(
    `INSERT INTO customers (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING *`,
    [phone]
  );
  const customer = customerResult.rows[0];

  const conversation = await getConversation(customer.id);
  const context = normalizeConversationContext(conversation.context);
  const history = Array.isArray(context.history) ? context.history : [];

  const products = await listProducts();

  const responseText = await processMessage(text, products, history);

  // Salva historico
  history.push({ role: 'user', content: text });
  history.push({ role: 'model', content: responseText });

  // Verifica se pedido foi confirmado
  let state = conversation.state;
  let orderId = null;

  if (responseText.includes('PEDIDO_CONFIRMADO')) {
    const match = responseText.match(/PEDIDO_CONFIRMADO\|(\d+)\|(\w+)/);
    if (match) {
      const productId = parseInt(match[1], 10);
      const size = match[2].toUpperCase();
      state = 'awaiting_payment';

      // Cria o pedido no banco
      const product = products.find(p => p.id === productId);
      const validSize = ['P', 'M', 'G', 'GG'].includes(size);
      if (product && validSize) {
        const orderResult = await db.query(
          `INSERT INTO orders (customer_id, status, total) VALUES ($1, 'pending', $2) RETURNING *`,
          [customer.id, product.price]
        );
        orderId = orderResult.rows[0].id;

        await db.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, $3)`,
          [orderId, productId, product.price]
        );

        console.log(`Order created: ${orderId}`);
      } else {
        console.warn('Order confirmation ignored due to invalid product or size');
      }
    }
  }

  await updateConversation(customer.id, state, { history, orderId });

  console.log(`Response: ${responseText}`);
  return { customer, responseText, orderId };
}

module.exports = { handleIncomingMessage };

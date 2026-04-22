const db = require('../config/db');
const { getConversation, updateConversation } = require('./conversationService');
const { listProducts } = require('./productService');
const { processMessage } = require('./groqService');
const {
  createOrder,
  getOrder,
  isOrderExpired,
  cancelExpiredPendingOrders,
} = require('./orderService');
const { generatePixMessage } = require('./pixService');
const { PIX_KEY } = require('../config/env');
const { parseOrderConfirmation } = require('./orderIntentParser');

function stripConfirmationMarker(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('PEDIDO_CONFIRMADO|'))
    .join('\n')
    .trim();
}

async function handleIncomingMessage(body) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages) return;

  const message = value.messages[0];
  const phone = message.from;
  const text = message.text?.body?.trim() || '';

  if (!phone || !text) return;

  console.log(`Message from ${phone}: ${text}`);

  await cancelExpiredPendingOrders();

  const customerResult = await db.query(
    `INSERT INTO customers (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING *`,
    [phone]
  );
  const customer = customerResult.rows[0];

  const conversation = await getConversation(customer.id);
  const context = conversation.context || {};
  const history = context.history || [];
  let returningWelcomed = Boolean(context.returningWelcomed);
  let orderId = context.orderId || null;
  let state = conversation.state;

  if (state === 'awaiting_payment') {
    if (!orderId) {
      state = 'idle';
    } else {
      const activeOrder = await getOrder(orderId);
      if (!activeOrder || activeOrder.status !== 'pending' || isOrderExpired(activeOrder)) {
        state = 'idle';
        orderId = null;
      }
    }
  }

  if (state === 'awaiting_payment') {
    const pixKey = PIX_KEY || 'configure_a_chave_pix_no_env';
    return {
      customer,
      responseText: `Você já tem um pedido aguardando pagamento.\n\n🔑 *Chave PIX:* ${pixKey}\n\nEnvie o comprovante aqui após pagar. ✅`
    };
  }

  const products = await listProducts();
  let rawResponseText;
  try {
    rawResponseText = await processMessage(text, products, history);
  } catch (err) {
    console.error('Error processing AI message:', err.message);
    rawResponseText = 'Tive uma instabilidade rápida aqui, mas já voltei. Me confirma o time e tamanho (P, M, G ou GG) que eu te respondo na hora.';
  }
  const responseText = stripConfirmationMarker(rawResponseText);
  let finalResponseText = responseText;

  const paidOrdersResult = await db.query(
    `SELECT COUNT(*)::int AS paid_count
     FROM orders
     WHERE customer_id = $1 AND status = 'paid'`,
    [customer.id]
  );
  const paidCount = paidOrdersResult.rows[0]?.paid_count || 0;
  if (paidCount > 0 && !returningWelcomed) {
    finalResponseText =
      `Que bom te ver de novo por aqui! Curtiu a qualidade da última compra? 🙌\n\n${responseText}`;
    returningWelcomed = true;
  }

  history.push({ role: 'user', content: text });
  history.push({ role: 'assistant', content: finalResponseText });

  if (history.length > 20) history.splice(0, 2);

  let pixMessage = null;

  const confirmation = parseOrderConfirmation(rawResponseText);
  if (confirmation && !orderId) {
    try {
      const { order, product } = await createOrder(customer.id, confirmation.productId, confirmation.size);
      orderId = order.id;
      state = 'awaiting_payment';
      pixMessage = generatePixMessage(order, product);
    } catch (err) {
      console.error('Error creating order:', err.message);
    }
  }

  await updateConversation(customer.id, state, { history, orderId, returningWelcomed });

  console.log(`Response: ${finalResponseText}`);
  return { customer, responseText: finalResponseText, pixMessage, orderId };
}

module.exports = { handleIncomingMessage };

const db = require('../config/db');
const { getConversation, updateConversation } = require('./conversationService');
const { listProducts } = require('./productService');
const { processMessage } = require('./groqService');
const { createOrder } = require('./orderService');
const { generatePixMessage } = require('./pixService');

async function handleIncomingMessage(body) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value?.messages) return;

  const message = value.messages[0];
  const phone = message.from;
  const text = message.text?.body?.trim() || '';

  console.log(`Message from ${phone}: ${text}`);

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

  if (conversation.state === 'awaiting_payment') {
    return {
      customer,
      responseText: `Você já tem um pedido aguardando pagamento.\n\n🔑 *Chave PIX:* emaildojoao0405@gmail.com\n\nEnvie o comprovante aqui após pagar. ✅`
    };
  }

  const products = await listProducts();
  const responseText = await processMessage(text, products, history);

  history.push({ role: 'user', content: text });
  history.push({ role: 'assistant', content: responseText });

  if (history.length > 20) history.splice(0, 2);

  let state = conversation.state;
  let orderId = context.orderId || null;
  let pixMessage = null;

  if (responseText.includes('PEDIDO_CONFIRMADO')) {
    const match = responseText.match(/PEDIDO_CONFIRMADO\|(\d+)\|(\w+)/);
    if (match && !orderId) {
      const productId = parseInt(match[1]);
      const size = match[2];

      try {
        const { order, product } = await createOrder(customer.id, productId, size);
        orderId = order.id;
        state = 'awaiting_payment';
        pixMessage = generatePixMessage(order, product);
      } catch (err) {
        console.error('Error creating order:', err.message);
      }
    }
  }

  await updateConversation(customer.id, state, { history, orderId });

  console.log(`Response: ${responseText}`);
  return { customer, responseText, pixMessage, orderId };
}

module.exports = { handleIncomingMessage };

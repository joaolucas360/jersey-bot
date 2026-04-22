const db = require('../config/db');
const { updateOrderStatus, getOrder } = require('./orderService');
const { updateConversation } = require('./conversationService');
const { sendMessage } = require('./whatsappService');
const { ensureDeliveryForOrder } = require('./deliveryService');

async function confirmPayment(orderId) {
  const order = await getOrder(orderId);

  if (!order) throw new Error('Pedido não encontrado');
  if (order.status === 'paid') throw new Error('Pedido já foi pago');
  if (order.status === 'cancelled') throw new Error('Pedido cancelado');

  await db.query(
    `INSERT INTO payments (order_id, amount, method, status)
     VALUES ($1, $2, 'pix', 'confirmed')
     ON CONFLICT (order_id) DO UPDATE SET status = 'confirmed', updated_at = NOW()`,
    [orderId, order.total]
  );

  await updateOrderStatus(orderId, 'paid');
  await ensureDeliveryForOrder(orderId);

  const convResult = await db.query(
    `SELECT * FROM conversations WHERE customer_id = $1`,
    [order.customer_id]
  );

  if (convResult.rows.length > 0) {
    const conv = convResult.rows[0];
    const context = conv.context || {};
    delete context.orderId;
    await updateConversation(order.customer_id, 'idle', context);
  }

  console.log(`Payment confirmed for order ${orderId} | Customer: ${order.phone}`);

  const amount = Number.parseFloat(order.total).toFixed(2);
  const confirmationText =
    `Pagamento confirmado, ${order.product_name} foi aprovado! ✅\n\n` +
    `Pedido: #${orderId}\n` +
    `Produto: ${order.product_name}\n` +
    `Valor: R$ ${amount}\n\n` +
    `Seu pedido ja entrou em separacao e te avisamos por aqui sobre o envio.`;

  try {
    await sendMessage(order.phone, confirmationText);
  } catch (err) {
    console.error(`Erro ao enviar confirmacao WhatsApp do pedido ${orderId}:`, err.message);
  }

  return {
    order_id: orderId,
    customer_phone: order.phone,
    product: order.product_name,
    amount: order.total,
    status: 'paid',
  };
}

module.exports = { confirmPayment };

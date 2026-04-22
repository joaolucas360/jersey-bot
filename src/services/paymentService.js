const db = require('../config/db');
const { updateOrderStatus, getOrder, decreaseStock } = require('./orderService');
const { updateConversation } = require('./conversationService');

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
  await decreaseStock(order.product_id);

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

  return {
    order_id: orderId,
    customer_phone: order.phone,
    product: order.product_name,
    amount: order.total,
    status: 'paid',
  };
}

module.exports = { confirmPayment };

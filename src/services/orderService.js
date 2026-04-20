const db = require('../config/db');

async function createOrder(customerId, productId, size) {
  // Busca o produto
  const productResult = await db.query(
    `SELECT * FROM products WHERE id = $1 AND active = true AND stock > 0`,
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error('Produto não encontrado ou sem estoque');
  }

  const product = productResult.rows[0];

  // Cria o pedido
  const orderResult = await db.query(
    `INSERT INTO orders (customer_id, status, total) VALUES ($1, 'pending', $2) RETURNING *`,
    [customerId, product.price]
  );

  const order = orderResult.rows[0];

  // Cria o item do pedido
  await db.query(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, $3)`,
    [order.id, productId, product.price]
  );

  console.log(`Order created: ${order.id} | Product: ${product.name} | Size: ${size} | Total: ${product.price}`);

  return { order, product };
}

async function getOrder(orderId) {
  const result = await db.query(
    `SELECT o.*, c.phone, p.name as product_name, oi.unit_price, oi.quantity
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE o.id = $1`,
    [orderId]
  );
  return result.rows[0];
}

async function updateOrderStatus(orderId, status) {
  await db.query(
    `UPDATE orders SET status = $1 WHERE id = $2`,
    [status, orderId]
  );
}

module.exports = { createOrder, getOrder, updateOrderStatus };

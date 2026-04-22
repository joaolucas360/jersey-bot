const db = require('../config/db');
const { PENDING_ORDER_TTL_MINUTES } = require('../config/env');

let hasOrderItemSizeColumnCache = null;
let hasOrderNotesColumnCache = null;
let hasVariantsTableCache = null;

function normalizeSize(size) {
  const parsed = String(size || '').trim().toUpperCase();
  const valid = ['P', 'M', 'G', 'GG'];
  return valid.includes(parsed) ? parsed : null;
}

async function hasOrderItemSizeColumn() {
  if (hasOrderItemSizeColumnCache !== null) return hasOrderItemSizeColumnCache;
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = 'order_items' AND column_name = 'size'
     LIMIT 1`
  );
  hasOrderItemSizeColumnCache = result.rows.length > 0;
  return hasOrderItemSizeColumnCache;
}

async function hasOrderNotesColumn() {
  if (hasOrderNotesColumnCache !== null) return hasOrderNotesColumnCache;
  const result = await db.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_name = 'orders' AND column_name = 'notes'
     LIMIT 1`
  );
  hasOrderNotesColumnCache = result.rows.length > 0;
  return hasOrderNotesColumnCache;
}

async function hasVariantsTable() {
  if (hasVariantsTableCache !== null) return hasVariantsTableCache;
  const result = await db.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_name = 'product_variants'
     LIMIT 1`
  );
  hasVariantsTableCache = result.rows.length > 0;
  return hasVariantsTableCache;
}

async function createOrder(customerId, productId, size) {
  const normalizedSize = normalizeSize(size);
  const variantsEnabled = await hasVariantsTable();
  let productResult;

  if (variantsEnabled) {
    if (!normalizedSize) {
      throw new Error('Tamanho inválido. Use P, M, G ou GG.');
    }
    productResult = await db.query(
      `SELECT p.*,
              v.stock AS variant_stock,
              COALESCE(v.price, p.price) AS final_price
       FROM products p
       JOIN product_variants v ON v.product_id = p.id
       WHERE p.id = $1
         AND p.active = true
         AND v.active = true
         AND v.size = $2
         AND v.stock > 0`,
      [productId, normalizedSize]
    );
  } else {
    productResult = await db.query(
      `SELECT * FROM products WHERE id = $1 AND active = true AND stock > 0`,
      [productId]
    );
  }

  if (productResult.rows.length === 0) {
    throw new Error('Produto não encontrado ou sem estoque');
  }

  const product = productResult.rows[0];
  const orderPrice = Number(product.final_price || product.price);

  const orderResult = await db.query(
    `INSERT INTO orders (customer_id, status, total) VALUES ($1, 'pending', $2) RETURNING *`,
    [customerId, orderPrice]
  );

  const order = orderResult.rows[0];
  const orderItemsHasSize = await hasOrderItemSizeColumn();

  if (orderItemsHasSize) {
    await db.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, size) VALUES ($1, $2, 1, $3, $4)`,
      [order.id, productId, orderPrice, normalizedSize]
    );
  } else {
    await db.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, 1, $3)`,
      [order.id, productId, orderPrice]
    );
    if (normalizedSize && await hasOrderNotesColumn()) {
      await db.query(
        `UPDATE orders SET notes = COALESCE(notes, '') || $1 WHERE id = $2`,
        [` [size:${normalizedSize}]`, order.id]
      );
    }
  }

  console.log(`Order created: ${order.id} | Product: ${product.name} | Size: ${normalizedSize || 'N/A'} | Total: ${orderPrice}`);

  return { order, product };
}

async function getOrder(orderId) {
  const orderItemsHasSize = await hasOrderItemSizeColumn();
  const result = await db.query(
    `SELECT o.*,
            c.phone,
            c.id as customer_id,
            p.name as product_name,
            p.id as product_id,
            oi.unit_price,
            oi.quantity,
            ${orderItemsHasSize ? 'oi.size' : 'NULL::text as size'}
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

async function listOrdersForAdmin({ status } = {}) {
  const orderItemsHasSize = await hasOrderItemSizeColumn();
  const params = [];
  let where = '';

  if (status) {
    params.push(status);
    where = `WHERE o.status = $${params.length}`;
  }

  const result = await db.query(
    `SELECT o.id,
            o.status,
            o.total,
            o.created_at,
            c.phone AS customer_phone,
            COUNT(oi.*)::int AS items_count,
            STRING_AGG(
              p.name || COALESCE(' (' || ${orderItemsHasSize ? 'oi.size' : 'NULL::text'} || ')', ''),
              ' ||| ' ORDER BY p.name
            ) AS items_summary,
            MIN(p.name) AS product_name,
            COALESCE(
              STRING_AGG(
                DISTINCT CASE WHEN ${orderItemsHasSize ? 'oi.size' : 'NULL::text'} IS NOT NULL
                  THEN ${orderItemsHasSize ? 'oi.size' : 'NULL::text'}
                  ELSE NULL
                END,
                ', '
              ),
              '-'
            ) AS sizes,
            COALESCE(pay.status, 'pending') AS payment_status,
            d.status AS delivery_status
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     LEFT JOIN payments pay ON pay.order_id = o.id
     LEFT JOIN deliveries d ON d.order_id = o.id
     ${where}
     GROUP BY o.id, c.phone, pay.status, d.status
     ORDER BY o.id ASC`,
    params
  );

  return result.rows;
}

async function getOrderDetailsForAdmin(orderId) {
  const orderItemsHasSize = await hasOrderItemSizeColumn();
  const orderResult = await db.query(
    `SELECT o.id,
            o.status,
            o.total,
            o.created_at,
            COALESCE(pay.status, 'pending') AS payment_status,
            row_to_json(c) AS customer
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     LEFT JOIN payments pay ON pay.order_id = o.id
     WHERE o.id = $1`,
    [orderId]
  );

  if (orderResult.rows.length === 0) return null;

  const itemsResult = await db.query(
    `SELECT oi.product_id,
            p.name AS product_name,
            oi.quantity,
            oi.unit_price,
            ${orderItemsHasSize ? 'oi.size' : 'NULL::text AS size'}
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId]
  );

  return {
    ...orderResult.rows[0],
    items: itemsResult.rows,
  };
}

function isOrderExpired(order, ttlMinutes = PENDING_ORDER_TTL_MINUTES) {
  if (!order?.created_at) return false;
  const createdAtMs = new Date(order.created_at).getTime();
  const ttlMs = Number(ttlMinutes) * 60 * 1000;
  return Number.isFinite(createdAtMs) && Date.now() - createdAtMs > ttlMs;
}

async function cancelExpiredPendingOrders(ttlMinutes = PENDING_ORDER_TTL_MINUTES) {
  const ttl = Number.parseInt(ttlMinutes, 10);
  if (!Number.isInteger(ttl) || ttl <= 0) return { cancelled: 0 };

  const result = await db.query(
    `WITH expired AS (
       SELECT o.id
       FROM orders o
       LEFT JOIN payments p ON p.order_id = o.id
       WHERE o.status = 'pending'
         AND o.created_at < NOW() - ($1::text || ' minutes')::interval
         AND COALESCE(p.status, 'pending') <> 'confirmed'
     )
     UPDATE orders o
     SET status = 'cancelled'
     FROM expired e
     WHERE o.id = e.id
     RETURNING o.id`,
    [ttl]
  );

  return { cancelled: result.rowCount };
}

async function decreaseStock(productId, size = null) {
  const normalizedSize = normalizeSize(size);
  if (await hasVariantsTable()) {
    if (!normalizedSize) {
      throw new Error('Tamanho do pedido ausente para baixar estoque por variação');
    }

    const result = await db.query(
      `UPDATE product_variants
       SET stock = stock - 1, updated_at = NOW()
       WHERE product_id = $1 AND size = $2 AND stock > 0
       RETURNING stock`,
      [productId, normalizedSize]
    );

    if (result.rows.length === 0) {
      throw new Error(`Estoque insuficiente para tamanho ${normalizedSize}`);
    }

    await db.query(
      `UPDATE products p
       SET stock = COALESCE(v.total_stock, 0)
       FROM (
         SELECT product_id, SUM(stock)::int AS total_stock
         FROM product_variants
         WHERE product_id = $1 AND active = true
         GROUP BY product_id
       ) v
       WHERE p.id = $1`,
      [productId]
    );

    console.log(`Stock updated | Product: ${productId} | Size: ${normalizedSize} | Remaining: ${result.rows[0].stock}`);
    return;
  }

  const result = await db.query(
    `UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0 RETURNING stock`,
    [productId]
  );

  if (result.rows.length === 0) {
    throw new Error('Estoque insuficiente');
  }

  console.log(`Stock updated | Product: ${productId} | Remaining: ${result.rows[0].stock}`);
}

module.exports = {
  createOrder,
  getOrder,
  listOrdersForAdmin,
  getOrderDetailsForAdmin,
  updateOrderStatus,
  decreaseStock,
  isOrderExpired,
  cancelExpiredPendingOrders,
};

const db = require('../config/db');
const { getOrderDetailsForAdmin } = require('./orderService');

let hasVariantsTableCache = null;

async function hasVariantsTable(client = db) {
  if (hasVariantsTableCache !== null) return hasVariantsTableCache;
  const result = await client.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_name = 'product_variants'
     LIMIT 1`
  );
  hasVariantsTableCache = result.rows.length > 0;
  return hasVariantsTableCache;
}

function normalizeSize(size) {
  const parsed = String(size || '').trim().toUpperCase();
  return ['P', 'M', 'G', 'GG'].includes(parsed) ? parsed : null;
}

async function decreaseStockForOrder(client, orderId) {
  const itemsResult = await client.query(
    `SELECT product_id, quantity, size
     FROM order_items
     WHERE order_id = $1
     ORDER BY id ASC`,
    [orderId]
  );

  if (itemsResult.rows.length === 0) {
    throw new Error('Itens do pedido não encontrados para baixar estoque');
  }

  const variantsEnabled = await hasVariantsTable(client);
  const touchedProducts = new Set();

  for (const item of itemsResult.rows) {
    const productId = Number(item.product_id);
    const qty = Number.parseInt(item.quantity, 10) || 1;
    touchedProducts.add(productId);

    if (variantsEnabled) {
      const size = normalizeSize(item.size);
      if (!size) {
        throw new Error(`Tamanho inválido/ausente para o produto ${productId} neste pedido`);
      }

      const variantResult = await client.query(
        `UPDATE product_variants
         SET stock = stock - $1, updated_at = NOW()
         WHERE product_id = $2
           AND size = $3
           AND active = true
           AND stock >= $1
         RETURNING stock`,
        [qty, productId, size]
      );

      if (variantResult.rows.length === 0) {
        throw new Error(`Estoque insuficiente para produto ${productId} tamanho ${size}`);
      }
    } else {
      const productResult = await client.query(
        `UPDATE products
         SET stock = stock - $1
         WHERE id = $2 AND stock >= $1
         RETURNING stock`,
        [qty, productId]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Estoque insuficiente para produto ${productId}`);
      }
    }
  }

  if (variantsEnabled) {
    for (const productId of touchedProducts) {
      await client.query(
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
    }
  }
}

async function ensureDeliveryForOrder(orderId) {
  const order = await getOrderDetailsForAdmin(orderId);
  if (!order) throw new Error('Pedido não encontrado');

  const customer = order.customer || {};
  const items = order.items || [];
  const recipientName = customer.name || null;
  const recipientPhone = customer.phone || null;

  const result = await db.query(
    `INSERT INTO deliveries (
       order_id,
       customer_id,
       status,
       recipient_name,
       recipient_phone,
       customer_snapshot,
       items_snapshot
     )
     VALUES ($1, $2, 'ready', $3, $4, $5::jsonb, $6::jsonb)
     ON CONFLICT (order_id) DO UPDATE
     SET customer_id = EXCLUDED.customer_id,
         recipient_name = EXCLUDED.recipient_name,
         recipient_phone = EXCLUDED.recipient_phone,
         customer_snapshot = EXCLUDED.customer_snapshot,
         items_snapshot = EXCLUDED.items_snapshot,
         updated_at = NOW()
     RETURNING *`,
    [
      order.id,
      customer.id || null,
      recipientName,
      recipientPhone,
      JSON.stringify(customer),
      JSON.stringify(items),
    ]
  );

  return result.rows[0];
}

async function getDeliveryByOrderId(orderId) {
  const result = await db.query(
    `SELECT d.*,
            o.total,
            o.status AS order_status,
            o.created_at AS order_created_at,
            COALESCE(p.status, 'pending') AS payment_status
     FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE d.order_id = $1`,
    [orderId]
  );

  return result.rows[0] || null;
}

async function setDeliveryStatus(orderId, nextStatus) {
  const normalized = String(nextStatus || '').trim().toLowerCase();
  const allowed = new Set(['ready', 'out_for_delivery', 'delivered']);
  if (!allowed.has(normalized)) {
    throw new Error('Status de entrega inválido');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const currentResult = await client.query(
      `SELECT status
       FROM deliveries
       WHERE order_id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Entrega não encontrada para este pedido');
    }

    const current = String(currentResult.rows[0].status || '').toLowerCase();
    const transitions = {
      ready: ['out_for_delivery', 'delivered'],
      out_for_delivery: ['delivered'],
      delivered: [],
    };
    if (!transitions[current]?.includes(normalized) && current !== normalized) {
      throw new Error('Transição de status inválida');
    }

    if (current === 'ready' && (normalized === 'out_for_delivery' || normalized === 'delivered')) {
      await decreaseStockForOrder(client, orderId);
    }

    const result = await client.query(
      `UPDATE deliveries
       SET status = $2,
           delivered_at = CASE WHEN $2 = 'delivered' THEN NOW() ELSE delivered_at END,
           updated_at = NOW()
       WHERE order_id = $1
       RETURNING *`,
      [orderId, normalized]
    );

    if (normalized === 'delivered') {
      await client.query(
        `UPDATE orders
         SET status = 'delivered'
         WHERE id = $1`,
        [orderId]
      );
    } else {
      await client.query(
        `UPDATE orders
         SET status = 'paid'
         WHERE id = $1 AND status <> 'delivered'`,
        [orderId]
      );
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listDeliveriesForAdmin() {
  const result = await db.query(
    `SELECT d.id,
            d.order_id,
            d.status,
            d.delivered_at,
            d.created_at,
            d.updated_at,
            d.recipient_name,
            d.recipient_phone,
            d.delivery_address,
            d.customer_snapshot,
            d.items_snapshot,
            o.total,
            COALESCE(p.status, 'pending') AS payment_status
     FROM deliveries d
     JOIN orders o ON o.id = d.order_id
     LEFT JOIN payments p ON p.order_id = o.id
     ORDER BY d.order_id ASC`
  );

  return result.rows;
}

module.exports = {
  ensureDeliveryForOrder,
  getDeliveryByOrderId,
  setDeliveryStatus,
  listDeliveriesForAdmin,
};

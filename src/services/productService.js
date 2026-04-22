const db = require('../config/db');
let hasVariantsTableCache = null;

const SIZE_ORDER_SQL = `
  CASE v.size
    WHEN 'P' THEN 1
    WHEN 'M' THEN 2
    WHEN 'G' THEN 3
    WHEN 'GG' THEN 4
    ELSE 99
  END
`;

function normalizeSize(size) {
  const parsed = String(size || '').trim().toUpperCase();
  return ['P', 'M', 'G', 'GG'].includes(parsed) ? parsed : null;
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

async function listProducts() {
  if (await hasVariantsTable()) {
    const result = await db.query(
      `SELECT p.id,
              p.name,
              p.description,
              COALESCE(MIN(v.price), p.price) AS price,
              COALESCE(SUM(v.stock), 0)::int AS stock,
              ARRAY_AGG(v.size ORDER BY ${SIZE_ORDER_SQL}) FILTER (WHERE v.size IS NOT NULL) AS sizes
       FROM products p
       LEFT JOIN product_variants v
         ON v.product_id = p.id
        AND v.active = true
        AND v.stock > 0
       WHERE p.active = true
       GROUP BY p.id
       HAVING COALESCE(SUM(v.stock), 0) > 0
       ORDER BY p.name`
    );
    return result.rows.map((row) => ({
      ...row,
      sizes: row.sizes || [],
    }));
  }

  const result = await db.query(
    `SELECT id, name, description, price, stock
     FROM products
     WHERE active = true AND stock > 0
     ORDER BY name`
  );
  return result.rows.map((row) => ({
    ...row,
    sizes: ['P', 'M', 'G', 'GG'],
  }));
}

async function listProductsForAdmin() {
  if (await hasVariantsTable()) {
    const result = await db.query(
      `SELECT p.id,
              p.name,
              p.description,
              p.price,
              p.active,
              COALESCE(SUM(v.stock), 0)::int AS stock,
              COALESCE(
                JSONB_OBJECT_AGG(v.size, v.stock) FILTER (WHERE v.size IS NOT NULL),
                '{}'::jsonb
              ) AS sizes_map,
              STRING_AGG(v.size || ':' || v.stock::text, ', ' ORDER BY ${SIZE_ORDER_SQL}) AS sizes_stock
       FROM products p
       LEFT JOIN product_variants v
         ON v.product_id = p.id
        AND v.active = true
       WHERE p.active = true
       GROUP BY p.id
       ORDER BY p.id ASC`
    );
    return result.rows;
  }

  const result = await db.query(
    `SELECT id, name, description, price, stock, active
     FROM products
     WHERE active = true
     ORDER BY id ASC`
  );
  return result.rows;
}

async function adjustProductStock(productId, { mode = 'increment', amount, size = null }) {
  const variantsEnabled = await hasVariantsTable();
  const normalizedSize = normalizeSize(size);

  if (!Number.isInteger(amount)) {
    throw new Error('amount deve ser inteiro');
  }

  if (variantsEnabled) {
    if (!normalizedSize) {
      throw new Error('size é obrigatório (P, M, G ou GG) quando product_variants está ativo');
    }

    if (mode === 'set' && amount < 0) {
      throw new Error('Estoque não pode ser negativo');
    }

    const sql = mode === 'set'
      ? `UPDATE product_variants
         SET stock = $1, updated_at = NOW()
         WHERE product_id = $2 AND size = $3
         RETURNING product_id, size, stock`
      : `UPDATE product_variants
         SET stock = stock + $1, updated_at = NOW()
         WHERE product_id = $2 AND size = $3 AND stock + $1 >= 0
         RETURNING product_id, size, stock`;

    const params = mode === 'set'
      ? [amount, productId, normalizedSize]
      : [amount, productId, normalizedSize];

    const variantResult = await db.query(sql, params);
    if (variantResult.rows.length === 0) {
      throw new Error('Variação não encontrada ou ajuste deixaria estoque negativo');
    }

    const productResult = await db.query(
      `UPDATE products p
       SET stock = COALESCE(v.total_stock, 0)
       FROM (
         SELECT product_id, SUM(stock)::int AS total_stock
         FROM product_variants
         WHERE product_id = $1 AND active = true
         GROUP BY product_id
       ) v
       WHERE p.id = $1
       RETURNING p.id, p.name, p.stock, p.active`,
      [productId]
    );

    if (productResult.rows.length === 0) {
      throw new Error('Produto não encontrado');
    }

    return {
      ...productResult.rows[0],
      size: variantResult.rows[0].size,
      variant_stock: variantResult.rows[0].stock,
    };
  }

  if (mode === 'set') {
    if (amount < 0) throw new Error('Estoque não pode ser negativo');
    const result = await db.query(
      `UPDATE products
       SET stock = $1
       WHERE id = $2
       RETURNING id, name, stock, active`,
      [amount, productId]
    );
    if (result.rows.length === 0) throw new Error('Produto não encontrado');
    return result.rows[0];
  }

  const result = await db.query(
    `UPDATE products
     SET stock = stock + $1
     WHERE id = $2 AND stock + $1 >= 0
     RETURNING id, name, stock, active`,
    [amount, productId]
  );

  if (result.rows.length === 0) {
    throw new Error('Produto não encontrado ou ajuste deixaria estoque negativo');
  }

  return result.rows[0];
}

async function createProduct({ name, description = '', price, stock = 0, active = true, size = null }) {
  if (!name || !name.trim()) throw new Error('name é obrigatório');
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) throw new Error('price inválido');
  if (!Number.isInteger(stock) || stock < 0) throw new Error('stock inválido');

  const result = await db.query(
    `INSERT INTO products (name, description, price, stock, active)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, description, price, stock, active`,
    [name.trim(), description.trim(), Number(price), stock, Boolean(active)]
  );

  const product = result.rows[0];
  if (await hasVariantsTable()) {
    const initialSize = normalizeSize(size);
    const baseStock = Number.parseInt(stock, 10);
    const sizes = ['P', 'M', 'G', 'GG'];
    const stocks = {};

    if (initialSize) {
      sizes.forEach((size) => {
        stocks[size] = size === initialSize ? baseStock : 0;
      });
    } else {
      const perSize = Math.floor(baseStock / 4);
      const remainder = baseStock % 4;
      sizes.forEach((size, index) => {
        stocks[size] = perSize + (index < remainder ? 1 : 0);
      });
    }

    for (const size of sizes) {
      await db.query(
        `INSERT INTO product_variants (product_id, size, stock, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (product_id, size) DO UPDATE
         SET stock = EXCLUDED.stock, active = true, updated_at = NOW()`,
        [product.id, size, stocks[size]]
      );
    }
  }

  return product;
}

async function updateProductPrice(productId, price) {
  if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
    throw new Error('price inválido');
  }

  const result = await db.query(
    `UPDATE products
     SET price = $1
     WHERE id = $2
     RETURNING id, name, price, stock, active`,
    [Number(price), productId]
  );

  if (result.rows.length === 0) {
    throw new Error('Produto não encontrado');
  }

  return result.rows[0];
}

async function updateProductTotalStock(productId, totalStock) {
  const parsedTotal = Number.parseInt(totalStock, 10);
  if (!Number.isInteger(parsedTotal) || parsedTotal < 0) {
    throw new Error('stock total inválido');
  }

  if (await hasVariantsTable()) {
    const sizes = ['P', 'M', 'G', 'GG'];
    const base = Math.floor(parsedTotal / sizes.length);
    const remainder = parsedTotal % sizes.length;

    for (let i = 0; i < sizes.length; i += 1) {
      const size = sizes[i];
      const value = base + (i < remainder ? 1 : 0);
      await db.query(
        `INSERT INTO product_variants (product_id, size, stock, active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (product_id, size) DO UPDATE
         SET stock = EXCLUDED.stock, active = true, updated_at = NOW()`,
        [productId, size, value]
      );
    }
  }

  const result = await db.query(
    `UPDATE products
     SET stock = $1
     WHERE id = $2
     RETURNING id, name, price, stock, active`,
    [parsedTotal, productId]
  );

  if (result.rows.length === 0) {
    throw new Error('Produto não encontrado');
  }

  return result.rows[0];
}

async function deactivateProduct(productId) {
  if (!Number.isInteger(Number(productId))) {
    throw new Error('product id inválido');
  }

  if (await hasVariantsTable()) {
    await db.query(
      `UPDATE product_variants
       SET active = false, stock = 0, updated_at = NOW()
       WHERE product_id = $1`,
      [productId]
    );
  }

  const result = await db.query(
    `UPDATE products
     SET active = false, stock = 0
     WHERE id = $1
     RETURNING id, name`,
    [productId]
  );

  if (result.rows.length === 0) {
    throw new Error('Produto não encontrado');
  }

  return result.rows[0];
}

module.exports = {
  listProducts,
  listProductsForAdmin,
  adjustProductStock,
  createProduct,
  updateProductPrice,
  updateProductTotalStock,
  deactivateProduct,
};

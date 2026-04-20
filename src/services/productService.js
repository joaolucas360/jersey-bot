const db = require('../config/db');

async function listProducts() {
  const result = await db.query(
    `SELECT id, name, description, price, stock
     FROM products
     WHERE active = true AND stock > 0
     ORDER BY name`
  );
  return result.rows;
}

function formatProductList(products) {
  if (!products.length) return 'Não temos produtos disponíveis no momento.';

  let msg = '👕 *Camisas disponíveis:*\n\n';
  products.forEach((p, i) => {
    msg += `*${i + 1}. ${p.name}*\n`;
    msg += `📝 ${p.description}\n`;
    msg += `💰 R$ ${parseFloat(p.price).toFixed(2)}\n`;
    msg += `📦 Estoque: ${p.stock} unidades\n\n`;
  });
  msg += 'Para comprar, digite o *número* da camisa desejada.';
  return msg;
}

module.exports = { listProducts, formatProductList };

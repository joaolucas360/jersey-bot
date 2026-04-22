const { PIX_KEY } = require('../config/env');

function generatePixMessage(order, product) {
  const amount = parseFloat(order.total).toFixed(2);
  const pixKey = PIX_KEY || 'configure_a_chave_pix_no_env';
  const msg = `✅ Pedido confirmado!\n\n`
    + `👕 *${product.name}*\n`
    + `💰 *R$ ${amount}*\n\n`
    + `Para pagar, use o PIX abaixo:\n\n`
    + `🔑 *Chave PIX:*\n ${pixKey}\n\n`
    + `💵 *Valor:* R$ ${amount}\n\n`
    + `Após o pagamento, envie o comprovante aqui. ✅`;
  return msg;
}

module.exports = { generatePixMessage };

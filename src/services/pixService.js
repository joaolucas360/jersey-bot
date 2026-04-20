function generatePixMessage(order, product) {
  const amount = parseFloat(order.total).toFixed(2);
  const msg = `✅ Pedido confirmado!\n\n`
    + `👕 *${product.name}*\n`
    + `💰 *R$ ${amount}*\n\n`
    + `Para pagar, use o PIX abaixo:\n\n`
    + `🔑 *Chave PIX:*\n emaildojoao0405@gmail.com\n\n`
    + `💵 *Valor:* R$ ${amount}\n\n`
    + `Após o pagamento, envie o comprovante aqui. ✅`;
  return msg;
}

module.exports = { generatePixMessage };

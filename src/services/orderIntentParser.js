function parseOrderConfirmation(text) {
  if (!text) return null;

  const lines = String(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const markerLine = lines.find((line) => line.startsWith('PEDIDO_CONFIRMADO|'));
  if (!markerLine) return null;

  const parts = markerLine.split('|');
  if (parts.length !== 3) return null;

  const productId = Number.parseInt(parts[1], 10);
  const size = String(parts[2] || '').trim().toUpperCase();
  const validSizes = ['P', 'M', 'G', 'GG'];

  if (!Number.isInteger(productId) || productId <= 0) return null;
  if (!validSizes.includes(size)) return null;

  return { productId, size };
}

module.exports = { parseOrderConfirmation };

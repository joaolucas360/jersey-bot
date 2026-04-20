const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

async function processMessage(userMessage, products, conversationHistory = []) {
  const productList = products.map((p, i) =>
    `ID: ${p.id} | ${p.name} | R$ ${parseFloat(p.price).toFixed(2)} | Estoque: ${p.stock}`
  ).join('\n');

  const systemPrompt = `Você é um atendente de uma loja de camisas de futebol via WhatsApp.
Seja simpático, informal e objetivo.

PRODUTOS DISPONÍVEIS:
${productList}

REGRAS:
- Quando o cliente escolher um produto e tamanho, confirme o pedido com os detalhes
- Sempre confirme: nome da camisa, tamanho e preço antes de fechar
- Tamanhos disponíveis: P, M, G, GG
- Quando o cliente confirmar o pedido, responda EXATAMENTE assim no final da mensagem:
  PEDIDO_CONFIRMADO|ID_PRODUTO|TAMANHO
  Exemplo: PEDIDO_CONFIRMADO|3|G
- Se o cliente quiser cancelar, responda normalmente
- Não invente produtos que não estão na lista
- Use emojis moderadamente`;

  const history = conversationHistory.map(h => ({
    role: h.role,
    parts: [{ text: h.content }]
  }));

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Entendido! Vou atender os clientes da loja de camisas.' }] },
      ...history
    ]
  });

  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

module.exports = { processMessage };

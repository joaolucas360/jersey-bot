const Groq = require('groq-sdk');
const { GROQ_API_KEY } = require('../config/env');

if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is not set. Configure it in .env.');
}

const groq = new Groq({ apiKey: GROQ_API_KEY });

async function processMessage(userMessage, products, conversationHistory = []) {
  const availableProducts = Array.isArray(products) ? products : [];
  const productList = availableProducts.length
    ? availableProducts.map((p) =>
    `ID: ${p.id} | ${p.name} | R$ ${parseFloat(p.price).toFixed(2)} | Estoque: ${p.stock}`
    ).join('\n')
    : 'Nenhum produto disponível no momento.';

  const systemPrompt = `Você é um atendente de uma loja de camisas de futebol via WhatsApp.
Seja simpático, informal e objetivo.

PRODUTOS DISPONÍVEIS:
${productList}

REGRAS:
- Quando o cliente escolher um produto e tamanho, confirme o pedido com os detalhes
- Sempre confirme: nome da camisa, tamanho e preço antes de fechar
- Tamanhos disponíveis: P, M, G, GG
- Quando o cliente confirmar o pedido, responda normalmente E adicione no final:
  PEDIDO_CONFIRMADO|ID_PRODUTO|TAMANHO
  Exemplo: PEDIDO_CONFIRMADO|3|G
- Não invente produtos que não estão na lista
- Use emojis moderadamente`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory
      .map((h) => ({
        role: h.role === 'model' ? 'assistant' : h.role,
        content: h.content,
      }))
      .filter((h) => ['user', 'assistant'].includes(h.role) && h.content),
    { role: 'user', content: userMessage }
  ];

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 500,
  });

  return response.choices[0].message.content?.trim() || 'Desculpe, tive um erro ao gerar resposta.';
}

module.exports = { processMessage };

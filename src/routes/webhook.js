const router = require('express').Router();
const { handleIncomingMessage } = require('../services/messageHandler');
const { sendMessage } = require('../services/whatsappService');

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Forbidden');
});

router.post('/webhook', async (req, res) => {
  try {
    const result = await handleIncomingMessage(req.body);
    if (result && result.customer?.phone) {
      console.log('--- RESPOSTA PRO CLIENTE ---');
      console.log(result.responseText);
      if (result.responseText) {
        await sendMessage(result.customer.phone, result.responseText);
      }
      if (result.pixMessage) {
        console.log('--- PIX ---');
        console.log(result.pixMessage);
        await sendMessage(result.customer.phone, result.pixMessage);
      }
      console.log('---------------------------');
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
  res.sendStatus(200);
});

module.exports = router;

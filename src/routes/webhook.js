const router = require('express').Router();
const { handleIncomingMessage } = require('../services/messageHandler');
const { WHATSAPP_VERIFY_TOKEN } = require('../config/env');

const VERIFY_TOKEN = WHATSAPP_VERIFY_TOKEN;

router.get('/webhook', (req, res) => {
  if (!VERIFY_TOKEN) {
    return res.status(500).send('WHATSAPP_VERIFY_TOKEN not configured');
  }

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
    await handleIncomingMessage(req.body);
  } catch (err) {
    console.error('Error handling message:', err);
  }
  res.sendStatus(200);
});

module.exports = router;

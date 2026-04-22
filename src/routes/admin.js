const router = require('express').Router();
const { confirmPayment } = require('../services/paymentService');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post('/admin/payments/confirm', adminAuth, async (req, res) => {
  const { order_id } = req.body;

  if (!order_id) {
    return res.status(400).json({ error: 'order_id is required' });
  }

  try {
    const result = await confirmPayment(order_id);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Error confirming payment:', err.message);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;

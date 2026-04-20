const router = require('express').Router();
const { NODE_ENV } = require('../config/env');
const { checkDbConnection } = require('../config/db');

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: NODE_ENV,
  });
});

router.get('/health/db', async (req, res) => {
  const db = await checkDbConnection();
  const status = db.ok ? 200 : 503;

  res.status(status).json({
    status: db.ok ? 'ok' : 'degraded',
    service: 'database',
    ...db,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

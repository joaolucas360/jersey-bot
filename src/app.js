const express = require('express');
const { PORT } = require('./config/env');
const healthRoute = require('./routes/health');
const webhookRoute = require('./routes/webhook');
const adminRoute = require('./routes/admin');

const app = express();

app.use(express.json());
app.use(healthRoute);
app.use(webhookRoute);
app.use(adminRoute);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;

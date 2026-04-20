const db = require('../config/db');

async function getConversation(customerId) {
  const result = await db.query(
    `SELECT * FROM conversations WHERE customer_id = $1`,
    [customerId]
  );

  if (result.rows.length === 0) {
    const created = await db.query(
      `INSERT INTO conversations (customer_id, state, context)
       VALUES ($1, 'idle', '{}') RETURNING *`,
      [customerId]
    );
    return created.rows[0];
  }

  return result.rows[0];
}

async function updateConversation(customerId, state, context = {}) {
  await db.query(
    `UPDATE conversations
     SET state = $1, context = $2, updated_at = NOW()
     WHERE customer_id = $3`,
    [state, JSON.stringify(context), customerId]
  );
}

module.exports = { getConversation, updateConversation };

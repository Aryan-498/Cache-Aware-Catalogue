const pool = require('../config/db');
const cache = require('../services/cache.service');
const logger = require('../utils/logger');

// DEMO ONLY: changes the database directly and does NOT invalidate the cache.
// This simulates a change made outside the API (a script, a DBA, another system).
exports.directUpdate = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const price = req.body && req.body.price;
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid product id' });
    if (typeof price !== 'number' || price < 0) return res.status(400).json({ error: 'price must be a number >= 0' });

    const r = await pool.query(
      `UPDATE products SET price = $1, version = version + 1, updated_at = now()
       WHERE id = $2 RETURNING id, price, version`,
      [price, id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Product not found' });

    await pool.query(
      'INSERT INTO audit_log (actor, action, entity_id, details) VALUES ($1, $2, $3, $4)',
      [req.user.username, 'DEMO_DIRECT', id, JSON.stringify({ price })]
    );
    logger.warn('demo_direct_db_update', { id, price, note: 'cache NOT invalidated' });

    res.json({
      message: 'Database updated directly. Cache was NOT invalidated.',
      id: r.rows[0].id,
      price: Number(r.rows[0].price),
      version: r.rows[0].version,
    });
  } catch (err) {
    next(err);
  }
};

exports.flushCache = async (req, res, next) => {
  try {
    const ok = await cache.flushAll();
    if (!ok) return res.status(503).json({ error: 'Redis is unavailable' });
    await pool.query(
      'INSERT INTO audit_log (actor, action) VALUES ($1, $2)',
      [req.user.username, 'FLUSH']
    );
    res.json({ message: 'Cache flushed' });
  } catch (err) {
    next(err);
  }
};
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const env = require('../config/env');
const logger = require('../utils/logger');

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash, role FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];

    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      logger.warn('login_failed', { username });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      env.jwtSecret,
      { expiresIn: env.jwtExpiresIn }
    );

    await pool.query(
      'INSERT INTO audit_log (actor, action) VALUES ($1, $2)',
      [user.username, 'LOGIN']
    );
    logger.info('login_success', { username: user.username, role: user.role });

    res.json({ token, role: user.role, expiresIn: env.jwtExpiresIn });
  } catch (err) {
    next(err);
  }
};

exports.me = (req, res) => {
  res.json({ user: req.user });
};
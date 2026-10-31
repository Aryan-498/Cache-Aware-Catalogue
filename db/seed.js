require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

(async () => {
  try {
    await pool.query(
      'TRUNCATE audit_log, products, categories, users RESTART IDENTITY CASCADE'
    );

    // Categories
    await pool.query(`
      INSERT INTO categories (name) VALUES
      ('Accessories'), ('Displays'), ('Storage'), ('Audio'), ('Networking')
    `);

    // Users (development passwords only)
    const adminHash = await bcrypt.hash('admin123', 10);
    const custHash = await bcrypt.hash('customer123', 10);
    await pool.query(
      `INSERT INTO users (username, password_hash, role) VALUES
       ('admin', $1, 'admin'), ('customer1', $2, 'customer')`,
      [adminHash, custHash]
    );

    // 10,000 products
    await pool.query(`
      INSERT INTO products (name, description, price, stock, category_id)
      SELECT
        'Product ' || g,
        'Description for product ' || g,
        round((random() * 9990 + 10)::numeric, 2),
        floor(random() * 200)::int,
        (g % 5) + 1
      FROM generate_series(1, 10000) AS g
    `);

    const p = await pool.query('SELECT COUNT(*) FROM products');
    const u = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`Seed done: ${p.rows[0].count} products, ${u.rows[0].count} users`);
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    await pool.end();
  }
})();
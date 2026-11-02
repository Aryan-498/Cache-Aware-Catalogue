const pool = require('../config/db');

const SELECT_BASE = `
  SELECT p.id, p.name, p.description, p.price, p.stock,
         c.name AS category, p.category_id, p.version, p.updated_at
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id`;

const clean = (row) => (row ? { ...row, price: Number(row.price) } : null);

exports.list = async ({ category, page, limit }) => {
  const params = [];
  let where = '';
  if (category) {
    params.push(category);
    where = 'WHERE c.name = $1';
  }
  params.push(limit, (page - 1) * limit);
  const sql = `${SELECT_BASE} ${where}
               ORDER BY p.id
               LIMIT $${params.length - 1} OFFSET $${params.length}`;
  const result = await pool.query(sql, params);
  return result.rows.map(clean);
};

exports.getById = async (id) => {
  const result = await pool.query(`${SELECT_BASE} WHERE p.id = $1`, [id]);
  return clean(result.rows[0]);
};

exports.create = async (data, actor) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO products (name, description, price, stock, category_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.name, data.description || null, data.price, data.stock, data.categoryId || null]
    );
    const id = ins.rows[0].id;
    await client.query(
      'INSERT INTO audit_log (actor, action, entity_id, details) VALUES ($1, $2, $3, $4)',
      [actor, 'CREATE', id, JSON.stringify(data)]
    );
    await client.query('COMMIT');
    return exports.getById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Optimistic locking: the update only succeeds if the version is unchanged
exports.update = async (id, data, actor) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upd = await client.query(
      `UPDATE products SET
         name        = COALESCE($1, name),
         description = COALESCE($2, description),
         price       = COALESCE($3, price),
         stock       = COALESCE($4, stock),
         category_id = COALESCE($5, category_id),
         version     = version + 1,
         updated_at  = now()
       WHERE id = $6 AND version = $7
       RETURNING id`,
      [data.name ?? null, data.description ?? null, data.price ?? null,
       data.stock ?? null, data.categoryId ?? null, id, data.version]
    );

    if (upd.rowCount === 0) {
      await client.query('ROLLBACK');
      const current = await client.query('SELECT version FROM products WHERE id = $1', [id]);
      if (current.rowCount === 0) return { notFound: true };
      return { conflict: true, currentVersion: current.rows[0].version };
    }

    await client.query(
      'INSERT INTO audit_log (actor, action, entity_id, details) VALUES ($1, $2, $3, $4)',
      [actor, 'UPDATE', id, JSON.stringify(data)]
    );
    await client.query('COMMIT');
    return { product: await exports.getById(id) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.remove = async (id, actor) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const del = await client.query('DELETE FROM products WHERE id = $1 RETURNING name', [id]);
    if (del.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      'INSERT INTO audit_log (actor, action, entity_id, details) VALUES ($1, $2, $3, $4)',
      [actor, 'DELETE', id, JSON.stringify({ name: del.rows[0].name })]
    );
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
const service = require('../services/product.service');
const cache = require('../services/cache.service');
const env = require('../config/env');
const logger = require('../utils/logger');

const parseId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const validate = (body, { partial }) => {
  const errors = [];
  const b = body || {};
  if (!partial || b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) errors.push('name is required');
  }
  if (!partial || b.price !== undefined) {
    if (typeof b.price !== 'number' || b.price < 0) errors.push('price must be a number >= 0');
  }
  if (!partial || b.stock !== undefined) {
    if (!Number.isInteger(b.stock) || b.stock < 0) errors.push('stock must be an integer >= 0');
  }
  return errors;
};

// Turn database constraint errors into clean 400 responses
const handleDbError = (err, res, next) => {
  if (err.code === '23514') return res.status(400).json({ error: 'Value rejected by database constraint (price/stock must be >= 0)' });
  if (err.code === '23503') return res.status(400).json({ error: 'Invalid categoryId' });
  return next(err);
};

exports.list = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const category = req.query.category;
    const key = `products:list:${category || 'all'}:${page}:${limit}`;

    const { value, status } = await cache.getOrLoad(
      key,
      env.cacheTtl,
      () => service.list({ category, page, limit }),
      { bypass: req.query.nocache === 'true' }
    );

    res.set('X-Cache', status);
    res.json({ page, limit, count: value.length, products: value });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid product id' });

    const { value, status } = await cache.getOrLoad(
      `product:${id}`,
      env.cacheTtl,
      () => service.getById(id),
      { bypass: req.query.nocache === 'true' }
    );

    res.set('X-Cache', status);
    if (!value) return res.status(404).json({ error: 'Product not found' });
    res.json(value);
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const errors = validate(req.body, { partial: false });
    if (errors.length) return res.status(400).json({ errors });
    const product = await service.create(req.body, req.user.username);
    logger.info('product_created', { id: product.id, actor: req.user.username });
    res.status(201).json(product);
  } catch (err) {
    handleDbError(err, res, next);
  }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid product id' });
    if (!Number.isInteger(req.body && req.body.version)) {
      return res.status(400).json({ error: 'version (integer) is required' });
    }
    const errors = validate(req.body, { partial: true });
    if (errors.length) return res.status(400).json({ errors });

    const result = await service.update(id, req.body, req.user.username);
    if (result.notFound) return res.status(404).json({ error: 'Product not found' });
    if (result.conflict) {
      logger.warn('version_conflict', { id, sent: req.body.version, current: result.currentVersion });
      return res.status(409).json({ error: 'Version conflict', currentVersion: result.currentVersion });
    }
    logger.info('product_updated', { id, version: result.product.version, actor: req.user.username });
    res.json(result.product);
  } catch (err) {
    handleDbError(err, res, next);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid product id' });
    const deleted = await service.remove(id, req.user.username);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    logger.info('product_deleted', { id, actor: req.user.username });
    res.json({ message: 'Product deleted', id });
  } catch (err) {
    next(err);
  }
};
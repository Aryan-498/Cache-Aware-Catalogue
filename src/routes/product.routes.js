const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const c = require('../controllers/product.controller');

// Public reads (these get cached in Step 6)
router.get('/', c.list);
router.get('/:id', c.getOne);

// Admin-only writes
router.post('/', auth, role('admin'), c.create);
router.put('/:id', auth, role('admin'), c.update);
router.delete('/:id', auth, role('admin'), c.remove);

module.exports = router;
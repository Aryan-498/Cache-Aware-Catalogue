const router = require('express').Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const c = require('../controllers/admin.controller');

router.put('/demo/direct-update/:id', auth, role('admin'), c.directUpdate);
router.post('/cache/flush', auth, role('admin'), c.flushCache);

module.exports = router;
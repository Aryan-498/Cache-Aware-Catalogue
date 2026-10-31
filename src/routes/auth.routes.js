const router = require('express').Router();
const auth = require('../middleware/auth');
const { login, me } = require('../controllers/auth.controller');

router.post('/login', login);
router.get('/me', auth, me); // quick check that your token works

module.exports = router;
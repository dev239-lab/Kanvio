const express = require('express');
const { getDashboard, getTeam, toggleStar } = require('../controllers/dashboardController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.get('/', getDashboard);
router.get('/team', getTeam);
router.put('/star/:boardId', toggleStar);

module.exports = router;
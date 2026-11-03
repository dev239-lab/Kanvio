const express = require('express');
const {
  signup,
  login,
  getMe,
  updateProfile,
  changePassword,
  verifyPassword,
  updateAvatar,
  updateStatus,
  getEmailPrefs,
  updateEmailPrefs,
  googleLogin,
  getAuthConfig,
} = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/config', getAuthConfig);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/verify-password', protect, verifyPassword);
router.put('/password', protect, changePassword);
router.put('/avatar', protect, updateAvatar);
router.put('/status', protect, updateStatus);
router.get('/email-prefs', protect, getEmailPrefs);
router.put('/email-prefs', protect, updateEmailPrefs);

module.exports = router;
router.get('/config', (req, res) => {
  res.json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || ''
  });
});

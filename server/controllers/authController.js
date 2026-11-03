const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Board = require('../models/Board');
const { sendMail, emailEnabled } = require('../utils/mailer');
const { welcomeEmail } = require('../utils/emailTemplates');

// Google sign-in is optional. It turns on when GOOGLE_CLIENT_ID is set in server/.env.
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const NO_PASSWORD = 'This account signs in with Google, so it has no password to change.';

const STATUSES = ['active', 'busy', 'away', 'meeting', 'leave'];
const EMAIL_TYPES = ['reminder', 'comment', 'move', 'invite', 'mention', 'assignment'];

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// A status that has run out counts as Active again
const currentStatus = (user) => {
  const expired = user.statusUntil && new Date(user.statusUntil) <= new Date();
  if (expired || !STATUSES.includes(user.status)) {
    return { status: 'active', statusMessage: '', statusUntil: null };
  }
  return {
    status: user.status,
    statusMessage: user.statusMessage || '',
    statusUntil: user.statusUntil || null,
  };
};

const userResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatarImage: user.avatarImage || '',
  ...currentStatus(user),
  token: generateToken(user._id),
});

const emailPrefsOf = (user) =>
  Object.fromEntries(EMAIL_TYPES.map((t) => [t, !!(user.emailPrefs && user.emailPrefs[t])]));

// Lets teammates on shared boards see a picture or status change without refreshing
const announceProfile = async (req, user) => {
  try {
    const boards = await Board.find({ members: user._id }).select('_id');
    const io = req.app.get('io');
    const payload = {
      userId: user._id,
      name: user.name,
      avatarImage: user.avatarImage || '',
      ...currentStatus(user),
    };
    boards.forEach((b) => io.to(`board:${b._id}`).emit('memberUpdated', payload));
  } catch {
    // The change is already saved, so a failed announcement is not an error
  }
};

// POST /api/auth/signup
exports.signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password });

    // Welcome email. It is not awaited, so signup is never slowed down or broken by it.
    sendMail({ to: user.email, ...welcomeEmail(user) });

    res.status(201).json(userResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json(userResponse(user));
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/auth/config  (public)  tells the login pages whether to show the Google button
exports.getAuthConfig = (req, res) => {
  res.json({ googleClientId: GOOGLE_CLIENT_ID });
};

// POST /api/auth/google  body: { credential }  (the ID token Google gives the browser)
exports.googleLogin = async (req, res) => {
  if (!googleClient) {
    return res.status(503).json({ message: 'Google sign-in is not set up on the server' });
  }

  try {
    const { credential } = req.body;
    if (!credential || typeof credential !== 'string') {
      return res.status(400).json({ message: 'Missing Google credential' });
    }

    // Google signs this token. verifyIdToken checks the signature, expiry and that it was made for this app.
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();

    if (!profile || !profile.email || !profile.email_verified) {
      return res.status(401).json({ message: 'Your Google email address is not verified' });
    }

    const email = profile.email.toLowerCase();
    let user = await User.findOne({ email });
    let created = false;

    if (!user) {
      // A new account. It gets a random password nobody knows, because it signs in with Google.
      user = await User.create({
        name: profile.name || email.split('@')[0],
        email,
        password: crypto.randomBytes(24).toString('hex'),
        googleId: profile.sub,
        hasPassword: false,
      });
      created = true;
      sendMail({ to: user.email, ...welcomeEmail(user) });
    } else if (!user.googleId) {
      // The email already has an account: link it, since Google confirmed the person owns this address
      user.googleId = profile.sub;
      await user.save();
    } else if (user.googleId !== profile.sub) {
      return res.status(401).json({ message: 'This email is linked to a different Google account' });
    }

    res.status(created ? 201 : 200).json(userResponse(user));
  } catch (err) {
    console.error('Google sign-in failed:', err.message);
    res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
  }
};

// GET /api/auth/me  (protected)
exports.getMe = (req, res) => {
  res.json(req.user);
};

// PUT /api/auth/profile  (protected)
exports.updateProfile = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const taken = await User.findOne({ email, _id: { $ne: req.user._id } });
    if (taken) {
      return res.status(400).json({ message: 'That email is already in use' });
    }

    const user = await User.findById(req.user._id);
    user.name = name;
    user.email = email;
    await user.save();

    announceProfile(req, user);
    res.json(userResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/auth/avatar  (protected)  body: { avatarImage: "data:image/jpeg;base64,..." } or null to remove
exports.updateAvatar = async (req, res) => {
  try {
    const { avatarImage } = req.body;

    if (avatarImage) {
      const valid =
        typeof avatarImage === 'string' &&
        avatarImage.length <= 90000 &&
        /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatarImage);
      if (!valid) {
        return res.status(400).json({ message: 'Please choose a JPG, PNG or WebP picture' });
      }
    }

    const user = await User.findById(req.user._id);
    user.avatarImage = avatarImage || '';
    await user.save();

    announceProfile(req, user);
    res.json(userResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/auth/status  (protected)  body: { status, statusMessage, statusUntil }
exports.updateStatus = async (req, res) => {
  try {
    const { status, statusMessage, statusUntil } = req.body;

    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Choose a valid status' });
    }

    const message = String(statusMessage || '').trim().slice(0, 80);

    let until = null;
    if (statusUntil) {
      until = new Date(statusUntil);
      const latest = Date.now() + 8 * 24 * 60 * 60 * 1000;
      if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now() || until.getTime() > latest) {
        return res.status(400).json({ message: 'That clear time is not valid' });
      }
    }

    const user = await User.findById(req.user._id);
    user.status = status;
    user.statusMessage = message;
    user.statusUntil = until;
    await user.save();

    announceProfile(req, user);
    res.json(userResponse(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/auth/email-prefs  (protected)
// `available` is false until the server has email settings, which switches the Email column off in Settings
exports.getEmailPrefs = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('emailPrefs');
    res.json({ available: emailEnabled(), prefs: emailPrefsOf(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/auth/email-prefs  (protected)  body: { prefs: { reminder: true, ... } }
exports.updateEmailPrefs = async (req, res) => {
  try {
    const changes = req.body.prefs;
    if (!changes || typeof changes !== 'object') {
      return res.status(400).json({ message: 'prefs are required' });
    }

    const user = await User.findById(req.user._id);
    EMAIL_TYPES.forEach((type) => {
      if (typeof changes[type] === 'boolean') user.set(`emailPrefs.${type}`, changes[type]);
    });
    await user.save();

    res.json({ available: emailEnabled(), prefs: emailPrefsOf(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/auth/password  (protected)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both passwords are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);

    if (user.hasPassword === false) return res.status(400).json({ message: NO_PASSWORD });

    // The shared demo account must keep its password so the demo button keeps working
    if (user.email === 'demo@kanvio.com') {
      return res.status(400).json({ message: 'The demo account password cannot be changed' });
    }

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword; // hashed automatically by the model
    await user.save();

    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/auth/verify-password  (protected)
// Checks the current password only, so the Settings page can unlock the new password fields
exports.verifyPassword = async (req, res) => {
  try {
    const { currentPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ message: 'Enter your current password' });
    }

    const user = await User.findById(req.user._id);

    if (user.hasPassword === false) return res.status(400).json({ message: NO_PASSWORD });

    // The shared demo account must keep its password, so stop here with a clear message
    if (user.email === 'demo@kanvio.com') {
      return res.status(400).json({ message: 'The demo account password cannot be changed' });
    }

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
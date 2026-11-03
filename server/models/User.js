const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },

    // Set when the account was created or linked with Google sign-in
    googleId: { type: String, unique: true, sparse: true },
    // False for accounts made with Google, which have no password the person knows
    hasPassword: { type: Boolean, default: true },
    starredBoards: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Board' }],

    // Display picture: a small square JPEG saved as a data URL (empty = show the colored initials)
    avatarImage: { type: String, default: '' },

    // Status like Amazon Chime. When statusUntil has passed, the user counts as Active again.
    status: {
      type: String,
      enum: ['active', 'busy', 'away', 'meeting', 'leave'],
      default: 'active',
    },
    statusMessage: { type: String, default: '', maxlength: 80 },
    statusUntil: { type: Date, default: null },

    // Which events are also sent by email. Email is opt-in, so everything starts off.
    emailPrefs: {
      reminder: { type: Boolean, default: false },
      comment: { type: Boolean, default: false },
      move: { type: Boolean, default: false },
      invite: { type: Boolean, default: false },
      mention: { type: Boolean, default: false },
      assignment: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Hash the password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare a typed password with the hashed one
userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
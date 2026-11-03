const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Board = require('../models/Board');

module.exports = (io) => {
  // Reject connections that don't carry a valid JWT
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) return next(new Error('User not found'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.name}`);

    // Personal room, used later for reminder notifications
    socket.join(`user:${socket.user._id}`);

    // Join a board room (only if the user is a member)
    socket.on('joinBoard', async (boardId) => {
      try {
        const board = await Board.findById(boardId);
        const isMember =
          board &&
          board.members.some((m) => m.toString() === socket.user._id.toString());

        if (!isMember) {
          return socket.emit('error', { message: 'Access denied to board' });
        }
        socket.join(`board:${boardId}`);
        socket.emit('joinedBoard', boardId);
      } catch (err) {
        socket.emit('error', { message: 'Could not join board' });
      }
    });

    socket.on('leaveBoard', (boardId) => {
      socket.leave(`board:${boardId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.user.name}`);
    });
  });
};
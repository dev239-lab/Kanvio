require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);

// Extra allowed websites for a deployed app, for example:
// CLIENT_ORIGINS=https://kanvio.example.com,https://www.kanvio.example.com
const extraOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// True for this computer and for any device address on a home or office network:
// localhost, 127.x.x.x, 10.x.x.x, 172.16-31.x.x and 192.168.x.x.
// So the site works from your laptop and phone whatever IPv4 address Wi-Fi gives you.
const isLocalNetwork = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === 'localhost' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: (origin, callback) => {
    // No origin means a tool like curl or a server-to-server call
    const allowed = !origin || extraOrigins.includes(origin) || isLocalNetwork(origin);
    callback(null, allowed);
  },
};

const io = new Server(server, {
  cors: corsOptions,
});

require('./sockets/socketHandler')(io);
app.set('io', io);

connectDB();
require('./jobs/reminderScheduler')(io);

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => res.send('balidan'));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/boards', require('./routes/boardRoutes'));
app.use('/api/cards', require('./routes/cardRoutes'));
app.use('/api/reminders', require('./routes/reminderRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/workspaces', require('./routes/WorkspaceRoutes'));

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on port ${PORT}`);
});
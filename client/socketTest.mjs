import { io } from 'socket.io-client';

const API = 'http://localhost:5000';

const res = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', password: '123456' }),
});
const user = await res.json();
const headers = { Authorization: `Bearer ${user.token}` };

const boards = await (await fetch(`${API}/api/boards`, { headers })).json();
const boardId = boards[0]._id;

const socket = io(API, { auth: { token: user.token } });

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('joinBoard', boardId);
});
socket.on('joinedBoard', () => console.log('Joined board, waiting for events...'));
socket.on('connect_error', (e) => console.log('Connection error:', e.message));

['listCreated', 'cardCreated', 'cardUpdated', 'cardMoved', 'cardDeleted', 'commentAdded', 'reminder'].forEach(
  (name) => socket.on(name, (data) => console.log(`EVENT ${name}:`, JSON.stringify(data)))
);
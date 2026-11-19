const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const db = new Database('chat.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_color TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(sender_id) REFERENCES users(id),
    FOREIGN KEY(receiver_id) REFERENCES users(id)
  );
`);

const sessionMiddleware = session({
  secret: 'discord-dm-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
});

app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

io.engine.use(sessionMiddleware);

const colors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245', '#3BA55C', '#FAA61A'];
function getRandomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.trim().length < 2 || password.length < 4) {
    return res.status(400).json({ error: 'Username (min 2 chars) and password (min 4 chars) required.' });
  }
  const cleanUser = username.trim();
  const hashed = bcrypt.hashSync(password, 10);
  try {
    const stmt = db.prepare('INSERT INTO users (username, password, avatar_color) VALUES (?, ?, ?)');
    const info = stmt.run(cleanUser, hashed, getRandomColor());
    req.session.userId = info.lastInsertRowid;
    req.session.username = cleanUser;
    res.json({ id: info.lastInsertRowid, username: cleanUser });
  } catch (err) {
    res.status(400).json({ error: 'Username already taken.' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username?.trim());
  if (!user || !bcrypt.compareSync(password || '', user.password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.json({ id: user.id, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const user = db.prepare('SELECT id, username, avatar_color FROM users WHERE id = ?').get(req.session.userId);
  res.json(user);
});

app.get('/api/users', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const users = db.prepare('SELECT id, username, avatar_color FROM users WHERE id != ? ORDER BY username ASC').all(req.session.userId);
  res.json(users);
});

app.get('/api/messages/:otherId', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const me = req.session.userId;
  const other = Number(req.params.otherId);
  const msgs = db.prepare(`
    SELECT m.id, m.sender_id, m.receiver_id, m.content, m.timestamp, u.username as sender_name, u.avatar_color
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.id ASC
  `).all(me, other, other, me);
  res.json(msgs);
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
  const req = socket.request;
  if (!req.session || !req.session.userId) {
    return socket.disconnect();
  }
  const userId = req.session.userId;
  onlineUsers.set(userId, socket.id);
  io.emit('online_users', Array.from(onlineUsers.keys()));

  socket.on('send_dm', ({ toUserId, content }) => {
    if (!content || !content.trim()) return;
    const cleanText = content.trim();
    const stmt = db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)');
    const info = stmt.run(userId, toUserId, cleanText);

    const saved = db.prepare(`
      SELECT m.id, m.sender_id, m.receiver_id, m.content, m.timestamp, u.username as sender_name, u.avatar_color
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(info.lastInsertRowid);

    socket.emit('new_dm', saved);
    const receiverSocket = onlineUsers.get(Number(toUserId));
    if (receiverSocket) {
      io.to(receiverSocket).emit('new_dm', saved);
    }
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.emit('online_users', Array.from(onlineUsers.keys()));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

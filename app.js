let isRegister = false;
let currentUser = null;
let allUsers = [];
let onlineIds = new Set();
let selectedUser = null;
let socket = null;

const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmit = document.getElementById('auth-submit');
const switchPrompt = document.getElementById('switch-prompt');
const switchMode = document.getElementById('switch-mode');
const authError = document.getElementById('auth-error');

switchMode.addEventListener('click', (e) => {
  e.preventDefault();
  isRegister = !isRegister;
  authError.textContent = '';
  if (isRegister) {
    authTitle.textContent = 'Create an account';
    authSubtitle.textContent = 'No email or phone required. Just pick a username.';
    authSubmit.textContent = 'Register';
    switchPrompt.textContent = 'Already have an account?';
    switchMode.textContent = 'Log In';
  } else {
    authTitle.textContent = 'Welcome back!';
    authSubtitle.textContent = 'Sign in with just a username and password.';
    authSubmit.textContent = 'Log In';
    switchPrompt.textContent = 'Need an account?';
    switchMode.textContent = 'Register';
  }
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  const username = document.getElementById('username-input').value;
  const password = document.getElementById('password-input').value;
  const endpoint = isRegister ? '/api/register' : '/api/login';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) {
    authError.textContent = data.error || 'Something went wrong';
    return;
  }
  initApp();
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.reload();
});

document.getElementById('search-users').addEventListener('input', (e) => {
  renderUsers(e.target.value.toLowerCase());
});

document.getElementById('message-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('message-input');
  if (!input.value.trim() || !selectedUser) return;
  socket.emit('send_dm', { toUserId: selectedUser.id, content: input.value });
  input.value = '';
});

async function initApp() {
  const res = await fetch('/api/me');
  if (!res.ok) return;
  currentUser = await res.json();

  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');

  document.getElementById('me-name').textContent = currentUser.username;
  const meAvatar = document.getElementById('me-avatar');
  meAvatar.textContent = currentUser.username[0].toUpperCase();
  meAvatar.style.background = currentUser.avatar_color;

  socket = io();
  socket.on('online_users', (ids) => {
    onlineIds = new Set(ids);
    renderUsers(document.getElementById('search-users').value.toLowerCase());
  });

  socket.on('new_dm', (msg) => {
    if (
      selectedUser &&
      ((msg.sender_id === currentUser.id && msg.receiver_id === selectedUser.id) ||
        (msg.sender_id === selectedUser.id && msg.receiver_id === currentUser.id))
    ) {
      appendMessage(msg);
    }
    loadUsers();
  });

  await loadUsers();
}

async function loadUsers() {
  const res = await fetch('/api/users');
  if (res.ok) {
    allUsers = await res.json();
    renderUsers(document.getElementById('search-users').value.toLowerCase());
  }
}

function renderUsers(filter = '') {
  const list = document.getElementById('user-list');
  list.innerHTML = '';
  allUsers
    .filter((u) => u.username.toLowerCase().includes(filter))
    .forEach((u) => {
      const div = document.createElement('div');
      div.className = 'user-item' + (selectedUser && selectedUser.id === u.id ? ' active' : '');
      const isOnline = onlineIds.has(u.id);
      div.innerHTML = `
        <div class="avatar" style="background:${u.avatar_color}">
          ${u.username[0].toUpperCase()}
          <span class="status-dot ${isOnline ? 'online' : ''}"></span>
        </div>
        <span>${u.username}</span>
      `;
      div.onclick = () => selectUser(u);
      list.appendChild(div);
    });
}

async function selectUser(user) {
  selectedUser = user;
  renderUsers(document.getElementById('search-users').value.toLowerCase());
  document.getElementById('chat-with-name').textContent = user.username;
  document.getElementById('message-form').classList.remove('hidden');
  document.getElementById('message-input').placeholder = `Message @${user.username}`;

  const res = await fetch(`/api/messages/${user.id}`);
  const msgs = await res.json();
  const box = document.getElementById('messages-box');
  box.innerHTML = '';
  if (msgs.length === 0) {
    box.innerHTML = `<div class="empty-state">This is the beginning of your direct message history with @${user.username}.</div>`;
  } else {
    msgs.forEach(appendMessage);
  }
}

function appendMessage(msg) {
  const box = document.getElementById('messages-box');
  const empty = box.querySelector('.empty-state');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = 'msg-row';
  const timeStr = new Date(msg.timestamp + 'Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  row.innerHTML = `
    <div class="avatar" style="background:${msg.avatar_color}">
      ${msg.sender_name[0].toUpperCase()}
    </div>
    <div class="msg-body">
      <div class="msg-header">
        <span class="msg-author">${msg.sender_name}</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="msg-text"></div>
    </div>
  `;
  row.querySelector('.msg-text').textContent = msg.content;
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

initApp();

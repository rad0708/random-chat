const socket = io();
const homeScreen = document.getElementById('home-screen');
const chatScreen = document.getElementById('chat-screen');
const chatBox = document.getElementById('chat-box');
const nicknameInput = document.getElementById('nickname');
const genderInput = document.getElementById('gender');
const startChat = document.getElementById('startChat');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newBtn = document.getElementById('newBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const homeBtn = document.getElementById('homeBtn');
const themeToggle = document.getElementById('themeToggle');

let nickname = "";
let typingTimeout;

function switchScreen(from, to) {
  from.classList.remove('active');
  to.classList.add('active');
}

// 홈 → 채팅
startChat.addEventListener('click', () => {
  nickname = nicknameInput.value.trim();
  if (!nickname) {
    alert("닉네임을 입력하세요.");
    return;
  }
  switchScreen(homeScreen, chatScreen);
  socket.emit('join', { nickname, gender: genderInput.value });
});

// 홈 버튼 → 다시 홈으로
homeBtn.addEventListener('click', () => {
  socket.emit('leave');
  switchScreen(chatScreen, homeScreen);
});

// 전송
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  } else {
    socket.emit('typing');
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('stopTyping'), 1000);
  }
});

function sendMessage() {
  const msg = messageInput.value.trim();
  if (msg) {
    appendMessage('me', nickname, msg);
    socket.emit('chat message', msg);
    messageInput.value = '';
  }
}

function appendMessage(type, user, msg) {
  const div = document.createElement('div');
  div.classList.add('bubble', type);
  div.innerHTML = `<strong>${user}</strong><br>${msg}<span class="time">${new Date().toLocaleTimeString()}</span>`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

socket.on('chat message', ({ user, msg }) => {
  appendMessage('other', user, msg);
});

socket.on('system message', (msg) => {
  const div = document.createElement('div');
  div.classList.add('system');
  div.textContent = msg;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
});

socket.on('status', (status) => {
  statusEl.textContent = status;
});

socket.on('typing', (user) => {
  statusEl.textContent = `${user} 입력 중...`;
});

socket.on('stopTyping', () => {
  statusEl.textContent = "🟢 연결됨";
});

// 새 상대
newBtn.addEventListener('click', () => {
  socket.emit('new');
  chatBox.innerHTML = "";
});

// 대화 지우기
clearBtn.addEventListener('click', () => {
  if (confirm("대화 내용을 지우시겠습니까?")) {
    chatBox.innerHTML = "";
  }
});

// 테마 토글
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
});

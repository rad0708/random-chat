// 소켓 연결
const socket = io();

// DOM
const profilePane = document.getElementById('profilePane');
const chatPane = document.getElementById('chatPane');
const nicknameEl = document.getElementById('nickname');
const startBtn = document.getElementById('startBtn');
const themeToggle = document.getElementById('themeToggle');
const soundToggle = document.getElementById('soundToggle');
const usersEl = document.getElementById('users');

const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const newBtn = document.getElementById('newBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const typingEl = document.getElementById('typing');

// 상태
let profile = { nickname: '', gender: '비공개' };
let allowSound = true;
let typingTimer = null;
let typingSent = false;

// 저장된 설정 복원
(function bootstrapSettings(){
  const savedTheme = localStorage.getItem('theme') || 'light';
  if(savedTheme === 'dark'){ document.body.classList.add('dark'); themeToggle.textContent='다크'; } else { themeToggle.textContent='라이트'; }
  const savedSound = localStorage.getItem('allowSound');
  if (savedSound !== null) { allowSound = savedSound === 'true'; }
  soundToggle.textContent = allowSound ? '🔔 켜짐' : '🔕 꺼짐';

  const savedNick = localStorage.getItem('nickname');
  if(savedNick) nicknameEl.value = savedNick;
})();

// 유틸
function now(){
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function appendSystem(text){
  const div = document.createElement('div');
  div.className = 'sys';
  div.textContent = text;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}
function appendMsg({text, who, nickname}){
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (who === 'me' ? 'mine' : 'peer');
  const content = document.createElement('div');
  content.className = 'content';
  content.textContent = text;
  const meta = document.createElement('div');
  meta.className = 'meta';
  if(who === 'me'){
    meta.innerHTML = `<span>나</span><span>${now()}</span>`;
  } else {
    meta.innerHTML = `<span>${nickname ?? '상대'}</span><span>${now()}</span>`;
  }
  wrap.appendChild(content);
  wrap.appendChild(meta);
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;

  // 로컬 저장
  const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
  history.push({text, who, time: Date.now(), nickname: nickname || null});
  localStorage.setItem('chatHistory', JSON.stringify(history));
}
function loadHistory(){
  chat.innerHTML='';
  const history = JSON.parse(localStorage.getItem('chatHistory') || '[]');
  for(const m of history){
    appendMsg({text:m.text, who:m.who, nickname:m.nickname});
  }
}

// 사운드 (WebAudio로 간단 비프음)
function beep(){
  if(!allowSound) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
    o.start();
    setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05); o.stop(ctx.currentTime + 0.06); }, 60);
  } catch(e){ /* ignore */ }
}

// 이벤트 바인딩
themeToggle.onclick = () => {
  document.body.classList.toggle('dark');
  const dark = document.body.classList.contains('dark');
  themeToggle.textContent = dark ? '다크' : '라이트';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
};
soundToggle.onclick = () => {
  allowSound = !allowSound;
  soundToggle.textContent = allowSound ? '🔔 켜짐' : '🔕 꺼짐';
  localStorage.setItem('allowSound', String(allowSound));
};

startBtn.onclick = () => {
  const nick = nicknameEl.value.trim() || '손님';
  const gender = document.querySelector('input[name="gender"]:checked')?.value || '비공개';
  profile = { nickname: nick, gender };
  localStorage.setItem('nickname', nick);
  // 화면 전환
  profilePane.classList.add('hidden');
  chatPane.classList.remove('hidden');
  statusEl.textContent = '상대방을 기다리는 중…';
  // 히스토리 불러오기
  loadHistory();
  // 서버에 프로필 전달 후 매칭
  socket.emit('ready', profile);
};

sendBtn.onclick = () => {
  const text = input.value.trim();
  if(!text) return;
  socket.emit('message', text);
  appendMsg({text, who:'me'});
  input.value='';
  socket.emit('typing', {typing:false});
  typingSent = false;
};

input.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    sendBtn.click();
    return;
  }
  // 타이핑 표시(디바운스)
  if(!typingSent){
    socket.emit('typing', {typing:true});
    typingSent = true;
  }
  clearTimeout(typingTimer);
  typingTimer = setTimeout(()=>{
    socket.emit('typing', {typing:false});
    typingSent = false;
  }, 1200);
});

newBtn.onclick = () => {
  localStorage.removeItem('chatHistory');
  chat.innerHTML = '';
  appendSystem('새 상대를 찾는 중…');
  statusEl.textContent = '상대방을 기다리는 중…';
  socket.emit('newPartner');
};
clearBtn.onclick = () => {
  localStorage.removeItem('chatHistory');
  chat.innerHTML='';
  appendSystem('대화창을 지웠습니다.');
};

// 단축키
document.addEventListener('keydown', (e)=>{
  if(e.ctrlKey && e.key.toLowerCase()==='n') newBtn.click();
  if(e.ctrlKey && e.key.toLowerCase()==='l') clearBtn.click();
});

// 소켓 수신
socket.on('users', (count)=>{
  usersEl.textContent = `접속자 ${count}명`;
});
socket.on('status', (text)=>{
  statusEl.textContent = text;
});
socket.on('system', (text)=>{
  appendSystem(text);
});
socket.on('message', ({text, nickname})=>{
  appendMsg({text, who:'peer', nickname});
  beep();
});
socket.on('typing', (isTyping)=>{
  typingEl.textContent = isTyping ? '상대방이 입력 중…' : '';
});

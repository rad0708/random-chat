// 연결
const socket = io();

// 화면 요소
const $home = document.getElementById('home');
const $chat = document.getElementById('chat');
const $startBtn = document.getElementById('startBtn');
const $homeBtn = document.getElementById('homeBtn');
const $brandHome = document.getElementById('brandHome');
const $nickname = document.getElementById('nickname');
const $chatBox = document.getElementById('chatBox');
const $msg = document.getElementById('msg');
const $send = document.getElementById('send');
const $next = document.getElementById('next');
const $clear = document.getElementById('clear');
const $statusDot = document.getElementById('statusDot');
const $statusText = document.getElementById('statusText');
const $online = document.getElementById('online');
const $themeToggle = document.getElementById('themeToggle');

let me = { nickname: "", gender: "none", color: "", initials: "" };
let typingTimer;
let lastDateLabel = "";

// 유틸
function randPastel(){
  const h = Math.floor(Math.random()*360);
  return `hsl(${h} 70% 55%)`;
}
function initials(name){
  if(!name) return "NA";
  const parts = name.trim().split(/\s+/);
  let s = parts[0][0] || '';
  if(parts[1]) s += parts[1][0];
  return s.toUpperCase().slice(0,2);
}
function time(){
  const d = new Date();
  return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
function dateLabel(d=new Date()){
  return d.toLocaleDateString('ko-KR', {year:'numeric', month:'long', day:'numeric', weekday:'short'});
}
function ensureDateSeparator(){
  const label = dateLabel();
  if(label !== lastDateLabel){
    lastDateLabel = label;
    const sep = document.createElement('div');
    sep.className = 'date-sep';
    sep.textContent = label;
    $chatBox.appendChild(sep);
  }
}
function scrollBottom(){
  $chatBox.scrollTo({top:$chatBox.scrollHeight, behavior:'smooth'});
}
function addSystem(text){
  const el = document.createElement('div');
  el.className = 'system';
  el.textContent = text;
  $chatBox.appendChild(el);
  scrollBottom();
}
function avatarEl(color, init){
  const a = document.createElement('div');
  a.className = 'avatar';
  a.style.background = color;
  const span = document.createElement('span');
  span.className = 'initials';
  span.textContent = init;
  a.appendChild(span);
  return a;
}
function setStatus(kind, text){
  $statusDot.className = 'dot ' + (kind==='ok'?'ok': kind==='bad'?'bad':'wait');
  $statusText.textContent = text;
}

function messageEl({mine, user, text}){
  ensureDateSeparator();
  const wrap = document.createElement('div');
  wrap.className = 'msg' + (mine ? ' me':'');
  if(!mine){
    wrap.appendChild(avatarEl(user.color, user.initials));
  }
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerText = text;
  wrap.appendChild(bubble);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const who = document.createElement('span');
  who.textContent = mine ? me.nickname : user.nickname;
  const t = document.createElement('span');
  t.textContent = time();
  meta.appendChild(who);
  meta.appendChild(document.createTextNode(' · '));
  meta.appendChild(t);
  bubble.appendChild(meta);
  $chatBox.appendChild(wrap);
  scrollBottom();
}

// 테마 토글
(function initTheme(){
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = prefersDark ? 'dark':'light';
  $themeToggle.textContent = prefersDark ? '🌞':'🌙';
})();
$themeToggle.addEventListener('click', ()=>{
  const now = document.documentElement.dataset.theme === 'dark' ? 'light':'dark';
  document.documentElement.dataset.theme = now;
  $themeToggle.textContent = now === 'dark' ? '🌞':'🌙';
});

// 홈 → 채팅
function startChat(){
  const name = $nickname.value.trim();
  const gender = (document.querySelector('input[name=gender]:checked')||{}).value || 'none';
  if(!name){
    $nickname.focus();
    $nickname.classList.add('shake');
    setTimeout(()=> $nickname.classList.remove('shake'), 400);
    return;
  }
  me.nickname = name;
  me.gender = gender;
  me.color = randPastel();
  me.initials = initials(name);
  $home.classList.remove('active');
  $chat.classList.add('active');
  $chatBox.innerHTML = '';
  lastDateLabel = '';
  addSystem('상대를 찾는 중…');
  setStatus('wait','대기 중');
  socket.emit('join', { nickname: me.nickname, gender: me.gender, color: me.color, initials: me.initials });
  $msg.focus();
}
$startBtn.addEventListener('click', startChat);
$brandHome.addEventListener('click', ()=>location.reload());

// 홈 버튼 → 홈으로
function goHome(){
  socket.emit('leave');
  $chat.classList.remove('active');
  $home.classList.add('active');
}
$homeBtn.addEventListener('click', goHome);

// 입력/전송
$msg.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    send();
    return;
  }
  socket.emit('typing');
  clearTimeout(typingTimer);
  typingTimer = setTimeout(()=> socket.emit('stopTyping'), 1000);
});

$send.addEventListener('click', send);
function send(){
  const text = $msg.value.trim();
  if(!text) return;
  messageEl({mine:true, user:me, text});
  socket.emit('chat message', text);
  $msg.value = '';
}

// 다음
$next.addEventListener('click', ()=>{
  addSystem('새 상대를 찾는 중…');
  setStatus('wait','대기 중');
  socket.emit('next');
});

// 지우기
$clear.addEventListener('click', ()=>{
  if(confirm('대화 내용을 지우시겠어요?')){
    $chatBox.innerHTML='';
    lastDateLabel='';
  }
});

// 수신 이벤트
socket.on('status', ({kind,text})=> setStatus(kind,text));
socket.on('online', (n)=> $online.textContent = `접속자 ${n}명`);
socket.on('system', addSystem);

socket.on('match', (user)=>{
  // 연결됨
  setStatus('ok','연결됨');
  addSystem('새로운 상대와 연결되었습니다.');
});

socket.on('chat message', ({ user, text })=>{
  messageEl({mine:false, user, text});
});

socket.on('typing', (user)=>{
  setStatus('ok', `${user.nickname} 입력 중…`);
});

socket.on('stopTyping', ()=>{
  setStatus('ok','연결됨');
});

socket.on('partner-left', ()=>{
  setStatus('bad','끊김');
  addSystem('상대방이 나갔습니다.');
});

// Client
(() => {
  const socket = io();
  const $ = (s) => document.querySelector(s);
  const messagesEl = $('#messages');
  const inputEl = $('#input');
  const formEl = $('#form');
  const typingEl = $('#typing');
  const systemEl = $('#system');
  const onlineEl = $('#online');
  const profileBody = $('#profileBody');
  const replyPreview = $('#replyPreview');
  const replyText = $('#replyText');
  const replyCancel = $('#replyCancel');
  const nextBtn = $('#nextBtn');
  const themeBtn = $('#theme');
  const homeBtn = $('#homeBtn');
  const sendBtn = $('#sendBtn');

  // theme
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') document.documentElement.classList.add('light');
  themeBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', document.documentElement.classList.contains('light') ? 'light' : 'dark');
  });

  // mobile 100vh fix
  const setVh = () => {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
  };
  setVh(); window.addEventListener('resize', setVh);

  // Local state
  const myId = Math.random().toString(36).slice(2,8);
  let replyTo = null;
  let typingTimer = null;
  let lastSentId = null;

  function nowStr(ts = Date.now()) {
    const d = new Date(ts);
    const hh = d.getHours().toString().padStart(2,'0');
    const mm = d.getMinutes().toString().padStart(2,'0');
    return `${hh}:${mm}`;
  }

  function addMsg({ id, text, mine=false, time=Date.now(), reply=null, flash=false }) {
    const li = document.createElement('li');
    li.className = `msg ${mine ? 'me' : 'you'}`;
    li.dataset.id = id || '';
    if (reply && reply.text) {
      const snip = document.createElement('div');
      snip.className = 'reply-snippet';
      snip.textContent = reply.text.length > 120 ? reply.text.slice(0,120)+'…' : reply.text;
      li.appendChild(snip);
    }
    const body = document.createElement('div');
    body.textContent = text;
    li.appendChild(body);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML = `<span>${nowStr(time)}</span>` + (mine ? ` <span class="seen" data-seen="${id}">전송됨</span>` : '');
    li.appendChild(meta);

    if (flash) li.classList.add('flash');
    messagesEl.appendChild(li);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (!mine) {
      // send read receipt
      if (id) socket.emit('chat:seen', id);
    }

    // reply on click
    li.addEventListener('click', (e) => {
      if (mine) return;
      replyTo = { id, text };
      replyText.textContent = text.length > 80 ? text.slice(0,80)+'…' : text;
      replyPreview.classList.remove('hidden');
      inputEl.focus();
    });
  }

  function setSystem(text) {
    systemEl.textContent = text;
  }

  // Join immediately with basic profile (can be extended to ask user)
  socket.emit('join', {
    nickname: localStorage.getItem('nickname') || `익명${myId}`,
    age: localStorage.getItem('age') || null,
    gender: localStorage.getItem('gender') || 'N/A',
    interests: (localStorage.getItem('interests') || '').split(',').filter(Boolean).slice(0,3)
  });

  // events
  socket.on('status', (s) => setSystem(s.text || ''));
  socket.on('online', (n) => onlineEl.textContent = `온라인 ${n}`);

  socket.on('match', (profile) => {
    // profile card fill
    profileBody.classList.remove('empty');
    profileBody.innerHTML = '';
    const fields = [
      ['닉네임', profile?.nickname || '익명'],
      ['나이', profile?.age ? `${profile.age}세` : '미공개'],
      ['성별', profile?.gender || 'N/A'],
      ['관심사', (profile?.interests || []).join(', ') || '미설정'],
    ];
    fields.forEach(([k,v]) => {
      const row = document.createElement('div'); row.className='profile-row';
      row.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
      profileBody.appendChild(row);
    });
    setSystem('상대방과 연결되었습니다. 안부를 나눠보세요!');
    messagesEl.innerHTML = '';
  });

  socket.on('partner:left', () => {
    setSystem('상대가 나갔습니다. "다음"으로 새로 찾아보세요.');
    const li = document.createElement('li');
    li.className = 'msg you';
    li.textContent = '상대가 떠났습니다.';
    messagesEl.appendChild(li);
  });

  socket.on('chat:recv', (m) => {
    addMsg({ id: m.id, text: m.text, mine:false, time: m.time, flash: true });
    typingEl.classList.add('hidden');
  });

  socket.on('typing', () => typingEl.classList.remove('hidden'));
  socket.on('typing:stop', () => typingEl.classList.add('hidden'));

  // read receipt ack: mark my message as seen
  socket.on('chat:seen-ack', (messageId) => {
    const el = messagesEl.querySelector(`.seen[data-seen="${messageId}"]`);
    if (el) el.textContent = '읽음';
  });

  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    // prevent double send
    if (lastSentId && Date.now() - lastSentId.t < 500) return;

    const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
    lastSentId = { id, t: Date.now() };

    addMsg({ id, text, mine:true });
    socket.emit('chat:send', { id, text, reply: replyTo?.id || null });
    inputEl.value = '';
    replyTo = null;
    replyPreview.classList.add('hidden');
  });

  inputEl.addEventListener('input', () => {
    socket.emit('typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.emit('typing:stop'), 1200);
  });

  replyCancel.addEventListener('click', () => {
    replyTo = null;
    replyPreview.classList.add('hidden');
    inputEl.focus();
  });

  nextBtn.addEventListener('click', () => {
    socket.emit('next');
    setSystem('새 상대를 찾는 중…');
    profileBody.classList.add('empty');
    profileBody.textContent = '연결을 기다리는 중…';
    messagesEl.innerHTML = '';
  });

  homeBtn.addEventListener('click', () => {
    // scroll to top and focus input (acts like 'home')
    window.scrollTo({ top: 0, behavior: 'smooth' });
    inputEl.focus();
  });

  // keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !replyPreview.classList.contains('hidden')) {
      replyCancel.click();
    }
    if (e.key === 'Enter' && !e.shiftKey && document.activeElement === inputEl) {
      e.preventDefault(); formEl.requestSubmit();
    }
  });
})();


(() => {
  const $ = (s, p=document) => p.querySelector(s);
  const $$ = (s, p=document) => [...p.querySelectorAll(s)];

  // Theme
  const themeToggle = $('#themeToggle');
  const notifToggle = $('#notifToggle');
  const soundToggle = $('#soundToggle');
  const homeBtn = $('#homeBtn');
  const startBtn = $('#startBtn');
  const nextBtn = $('#nextBtn');
  const leaveBtn = $('#leaveBtn');
  const statusEl = $('#status');
  const messages = $('#messages');
  const input = $('#input');
  const form = $('#form');
  const typingEl = $('#typing');
  const onlineEl = $('#online');
  const nickname = $('#nickname');
  const gender = $('#gender');
  const color = $('#color');
  const emojiBtn = $('#emojiBtn');
  const emojiGrid = $('#emojiGrid');
  const replyPreview = $('#replyPreview');
  const rpText = $('#rpText');
  const rpCancel = $('#rpCancel');
  const ding = $('#ding');

  // Load saved prefs
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const notifPref = localStorage.getItem('notif') || 'off';
  const soundPref = localStorage.getItem('sound') || 'on';
  notifToggle.dataset.state = notifPref;
  soundToggle.dataset.state = soundPref;
  nickname.value = localStorage.getItem('nickname') || '';
  gender.value = localStorage.getItem('gender') || 'unknown';
  color.value = localStorage.getItem('color') || '#3b82f6';

  function updateToggleUI(){
    themeToggle.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
    notifToggle.textContent = (notifToggle.dataset.state === 'on') ? '🔔' : '🔕';
    soundToggle.textContent = (soundToggle.dataset.state === 'on') ? '🔊' : '🔈';
  }
  updateToggleUI();

  themeToggle.addEventListener('click', () => {
    const now = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', now);
    localStorage.setItem('theme', now);
    updateToggleUI();
  });
  notifToggle.addEventListener('click', async () => {
    if (notifToggle.dataset.state === 'off') {
      // request permission
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        notifToggle.dataset.state = 'on';
        localStorage.setItem('notif', 'on');
        // register service worker
        if ('serviceWorker' in navigator) {
          try { await navigator.serviceWorker.register('./sw.js'); } catch (e) {}
        }
      } else {
        alert('알림 권한이 거부되었습니다.');
      }
    } else {
      notifToggle.dataset.state = 'off';
      localStorage.setItem('notif', 'off');
    }
    updateToggleUI();
  });
  soundToggle.addEventListener('click', () => {
    soundToggle.dataset.state = soundToggle.dataset.state === 'on' ? 'off' : 'on';
    localStorage.setItem('sound', soundToggle.dataset.state);
    updateToggleUI();
  });

  homeBtn.addEventListener('click', () => {
    window.location.href = '/';
  });

  // Emoji list (compact, popular)
  const EMOJI = "😀😁😂🤣😊😍😘😎🤔🙄😭🙏👏👍🎉❤️🔥✨😴🤩🤗😇😅😉😜😡😱🤯💪🙌🤝";
  EMOJI.split('').forEach(e => {
    const span = document.createElement('button');
    span.type = 'button';
    span.className = 'icon-btn';
    span.style.fontSize = '22px';
    span.textContent = e;
    span.addEventListener('click', () => sendEmoji(e));
    emojiGrid.appendChild(span);
  });

  // Reply state
  let replyTo = null;

  rpCancel.addEventListener('click', () => {
    replyTo = null;
    replyPreview.hidden = true;
  });

  function showReplyPreview(text) {
    replyTo = text.slice(0, 120);
    rpText.textContent = replyTo;
    replyPreview.hidden = false;
  }

  // Socket
  const socket = io();

  socket.on('online', (n) => {
    onlineEl.textContent = `접속자 ${n}`;
  });

  socket.on('status', (st) => {
    statusEl.textContent = `${st.text}`;
  });

  socket.on('system', (text) => {
    addSystem(text);
  });

  socket.on('match', (partnerProfile) => {
    addSystem('상대와 연결되었습니다.');
    stopTypingUI();
  });

  socket.on('chat message', (msg) => {
    addMessage('you', msg);
    maybeNotify(msg);
    maybeDing();
  });

  socket.on('typing', (from) => {
    typingEl.hidden = false;
  });
  socket.on('stopTyping', () => stopTypingUI());

  function stopTypingUI(){ typingEl.hidden = true; }

  socket.on('partner-left', () => {
    addSystem('상대방이 나갔습니다. 다음을 눌러 새로운 상대를 찾아보세요.');
    stopTypingUI();
  });

  // Join
  function join() {
    const profile = {
      nickname: nickname.value.trim() || '게스트',
      gender: gender.value,
      color: color.value
    };
    localStorage.setItem('nickname', profile.nickname);
    localStorage.setItem('gender', profile.gender);
    localStorage.setItem('color', profile.color);
    socket.emit('join', profile);
  }

  startBtn.addEventListener('click', join);
  nextBtn.addEventListener('click', () => socket.emit('next'));
  leaveBtn.addEventListener('click', () => socket.emit('leave'));

  // Typing indicator
  let typingTimer;
  input.addEventListener('input', () => {
    socket.emit('typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => socket.emit('stopTyping'), 800);
  });

  // Send message
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const payload = { type:'text', text, replyTo };
    socket.emit('chat message', payload);
    addMessage('me', { from:{ nickname: nickname.value || '나', color: color.value }, text, replyTo, ts: Date.now(), type:'text' });
    input.value = '';
    replyTo = null;
    replyPreview.hidden = true;
    socket.emit('stopTyping');
  });

  function sendEmoji(ch) {
    const payload = { type:'text', text: ch, replyTo: null };
    socket.emit('chat message', payload);
    addMessage('me', { from:{ nickname: nickname.value || '나', color: color.value }, text: ch, replyTo: null, ts: Date.now(), type:'text' });
  }

  // Stickers
  $$('.sticker').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.sticker;
      const payload = { type:'sticker', text: name, replyTo };
      socket.emit('chat message', payload);
      addMessage('me', { from:{ nickname: nickname.value || '나', color: color.value }, type:'sticker', text: name, replyTo, ts: Date.now() });
      replyTo = null; replyPreview.hidden = true;
    });
  });

  // Render helpers
  function addSystem(text) {
    const li = document.createElement('li');
    li.className = 'message';
    li.innerHTML = `<div class="meta" style="width:100%; text-align:center;">${escapeHTML(text)}</div>`;
    messages.appendChild(li);
    scrollToBottom();
  }
  function addMessage(side, msg) {
    const li = document.createElement('li');
    li.className = `message ${side}`;
    const time = timeStr(msg.ts || Date.now());
    const metaLeft = side === 'you' ? `<span class="meta">${escapeHTML(msg.from?.nickname || '상대')}</span>` : '';
    const metaRight = `<span class="meta">${time}</span>`;

    let inner = '';
    if (msg.replyTo) {
      inner += `<div class="reply-mini">${escapeHTML(msg.replyTo)}</div>`;
    }
    if (msg.type === 'sticker') {
      inner += `<img src="./assets/${escapeAttr(msg.text)}" alt="sticker" style="width:96px;height:96px">`;
    } else {
      inner += `<div>${linkify(escapeHTML(msg.text || ''))}</div>`;
    }

    li.innerHTML = `${metaLeft}<div class="bubble" style="--accent:${escapeAttr(msg.from?.color || '#3b82f6')}">${inner}</div>${metaRight}`;
    // reply on click
    li.addEventListener('click', () => {
      const previewText = (msg.text || '').slice(0, 120);
      if (previewText) showReplyPreview(previewText);
    });
    messages.appendChild(li);
    scrollToBottom();
  }
  function timeStr(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  }
  function escapeHTML(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttr(s){ return escapeHTML(String(s)).replace(/"/g,'&quot;'); }
  function linkify(s){
    return s.replace(/\bhttps?:\/\/[^\s<]+/g, u => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  }
  function scrollToBottom(){ messages.scrollTop = messages.scrollHeight; }

  // Notifications
  async function maybeNotify(msg){
    if (document.hasFocus()) return; // only when unfocused
    if (notifToggle.dataset.state !== 'on') return;
    const title = `${msg.from?.nickname || '상대'}의 메시지`;
    const body = msg.type === 'sticker' ? '[스티커]' : (msg.text || '');
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        reg.showNotification(title, {
          body,
          icon: './assets/favicon.svg',
          tag: 'chat-message',
          data: { url: location.href }
        });
        return;
      }
    }
    // fallback
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: './assets/favicon.svg' });
    }
  }
  function maybeDing(){
    if (soundToggle.dataset.state === 'on') {
      ding.currentTime = 0;
      ding.play().catch(()=>{});
    }
  }

  // Clicking on message list empty area cancels reply
  messages.addEventListener('click', (e) => {
    if (e.target === messages) {
      replyTo = null;
      replyPreview.hidden = true;
    }
  });

})();

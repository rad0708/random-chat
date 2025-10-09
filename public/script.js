// public/script.js — upgraded with guards & UX polish
const socket = io({ transports: ["websocket"] });

const $ = (id) => document.getElementById(id);
const $online = $("online");
const $themeToggle = $("themeToggle");
const $gate = $("gate");
const $start = $("startBtn");
const $chatbox = $("chatbox");
const $status = $("status");
const $timer = $("timer");
const $soundToggle = $("soundToggle");
const $fontToggle = $("fontToggle");
const $chat = $("chat");
const $typing = $("typing");
const $messages = $("messages");
const $input = $("input");
const $send = $("send");
const $next = $("next");
const $adMid = $("adMid");
const $captcha = $("captcha");

let typingTimer = null;
let startTs = null;
let notifEnabled = false;

// Audio context reuse
let audioCtx = null;
function playBeep() {
  if (!$soundToggle.checked) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.value = 0.02;
    o.start(); setTimeout(()=>{ o.stop(); }, 120);
  } catch {}
}

function addMsg(text, cls, ts) {
  const li = document.createElement("li");
  const bubble = document.createElement("div");
  bubble.className = "msg " + cls;
  bubble.textContent = text + (ts ? `  ·  ${fmtTime(ts)}` : "");
  li.appendChild(bubble);
  $messages.appendChild(li);
  $chat.scrollTop = $chat.scrollHeight;
}

function addSystem(text) {
  const li = document.createElement("li");
  const el = document.createElement("span");
  el.className = "system";
  el.textContent = text;
  li.appendChild(el);
  $messages.appendChild(li);
  $chat.scrollTop = $chat.scrollHeight;
}

function fmtTime(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function startTimer() {
  startTs = Date.now();
  const tick = () => {
    if (!startTs) return;
    const delta = Math.floor((Date.now() - startTs) / 1000);
    const m = Math.floor(delta / 60);
    const s = String(delta % 60).padStart(2, "0");
    $timer.textContent = `${m}:${s}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Notifications
function requestNotif() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") notifEnabled = true;
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(p => { notifEnabled = p === "granted"; });
  }
}
function notify(title, body) {
  if (!notifEnabled) return;
  if (document.visibilityState === "visible") return;
  try { new Notification(title, { body }); } catch(e){}
}

// Theme & font
$themeToggle?.addEventListener("click", () => {
  const b = document.body;
  b.classList.toggle("theme-light");
});
$fontToggle?.addEventListener("change", () => {
  document.documentElement.style.fontSize = $fontToggle.checked ? "18px" : "16px";
});

// hCaptcha
function initCaptcha() {
  if (!window.ENV?.HC_SITEKEY || !$captcha) return;
  $captcha.setAttribute("data-sitekey", window.ENV.HC_SITEKEY);
}
function onSubmitCaptcha() {
  const token = window.hcaptcha.getResponse();
  if (!token) return;
  fetch("/verify-captcha", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  }).then(r => r.json()).then(d => {
    if (d.ok) {
      $start.disabled = false;
      addSystem("인증이 완료되었습니다. '채팅 시작하기'를 눌러주세요.");
    } else {
      addSystem("인증에 실패했습니다. 다시 시도해주세요.");
      window.hcaptcha.reset();
    }
  }).catch(() => {
    addSystem("인증 서버와 통신 중 문제가 발생했습니다.");
    window.hcaptcha.reset();
  });
}
window.onSubmitCaptcha = onSubmitCaptcha;

window.addEventListener("load", () => {
  initCaptcha();
  requestNotif();
});

// Socket events
socket.on("online", (n) => { if ($online) $online.textContent = n; });
socket.on("paired", () => { $status.textContent = "상대와 연결됨"; startTimer(); playBeep(); });
socket.on("system", (p) => { if (p?.text) addSystem(p.text); });
socket.on("chat", (p) => {
  if (!p?.text) return;
  addMsg(p.text, "partner", p.ts);
  playBeep();
  notify("새 메시지", p.text);
});
socket.on("typing", (v) => { $typing.hidden = !v; });

// Start / Next / Send
$start?.addEventListener("click", () => {
  $gate.hidden = true;
  $chatbox.hidden = false;
  $status.textContent = "상대를 찾는 중...";
  socket.emit("start", { verified: true });
  // show mid ad after some time
  setTimeout(()=>{ $adMid.hidden = false; }, 90_000); // 1.5분 후 노출
});

$send?.addEventListener("click", sendMsg);
$input?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMsg();
  else {
    socket.emit("typing", true);
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(()=> socket.emit("typing", false), 900);
  }
});
$next?.addEventListener("click", () => {
  socket.emit("next");
  addSystem("새로운 상대를 찾는 중...");
  $status.textContent = "상대를 찾는 중...";
  startTs = Date.now(); // reset timer
});

function sendMsg() {
  const text = ($input.value || "").trim();
  if (!text) return;
  socket.emit("chat", { text });
  addMsg(text, "me", Date.now());
  $input.value = "";
  socket.emit("typing", false);
}
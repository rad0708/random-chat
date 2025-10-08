
(() => {
  const socket = io({ transports: ["websocket", "polling"] });
  const log = document.getElementById("log");
  const typing = document.getElementById("typing");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const count = document.getElementById("count");
  const read = document.getElementById("read");
  const btnSend = document.getElementById("btnSend");
  const btnFind = document.getElementById("btnFind");
  const btnCancel = document.getElementById("btnCancel");
  const btnNext = document.getElementById("btnNext");
  const btnEnd = document.getElementById("btnEnd");
  const btnReport = document.getElementById("btnReport");
  const btnBlock = document.getElementById("btnBlock");
  const nick = document.getElementById("nick");
  const btnSaveNick = document.getElementById("btnSaveNick");
  const auto = document.getElementById("auto");
  const qsize = document.getElementById("qsize");
  const net = document.getElementById("net");
  const btnTheme = document.getElementById("btnTheme");
  const snd = document.getElementById("snd");
  const capState = document.getElementById("capState");
  const captchaBox = document.getElementById("captchaBox");

  let matched = false;
  let captchaReady = false;
  let captchaVerified = false;
  let captchaWidgetId = null;

  function fmtTime(ts){
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }

  function addMsg(text, opts={}){
    const li = document.createElement("li");
    li.className = "msg " + (opts.me ? "me":"you");
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = opts.meta || (opts.me ? "나":"상대");
    const content = document.createElement("div");
    content.textContent = text;
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = fmtTime(opts.at || Date.now());
    li.append(meta, content, time);
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
  }

  function addSys(text){
    const li = document.createElement("li");
    li.className = "msg you";
    const meta = document.createElement("div");
    meta.className = "meta"; meta.textContent = "시스템";
    const content = document.createElement("div");
    content.textContent = text;
    li.append(meta, content);
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
  }

  function setState(state){
    if (state === "idle"){
      matched = false;
      btnFind.disabled = !captchaVerified;
      btnCancel.disabled = true;
      btnNext.disabled = true;
      btnEnd.disabled = true;
      btnSend.disabled = true;
      btnReport.disabled = true;
      btnBlock.disabled = true;
      typing.classList.add("hidden");
    } else if (state === "waiting"){
      btnFind.disabled = true;
      btnCancel.disabled = true; // 캡차 완료 후 바로 대기 → 취소 대신 종료로 유도
      btnNext.disabled = true;
      btnEnd.disabled = false;
      btnSend.disabled = true;
      btnReport.disabled = true;
      btnBlock.disabled = true;
    } else if (state === "chat"){
      matched = true;
      btnFind.disabled = true;
      btnCancel.disabled = true;
      btnNext.disabled = false;
      btnEnd.disabled = false;
      btnSend.disabled = false;
      btnReport.disabled = false;
      btnBlock.disabled = false;
    }
  }

  // theme
  btnTheme.addEventListener("click", ()=>{
    document.documentElement.classList.toggle("light");
  });

  // hCaptcha init
  function renderCaptcha(){
    if (!window.hcaptcha) return setTimeout(renderCaptcha, 300);
    fetch("/captcha/sitekey").then(r=>r.json()).then(({sitekey})=>{
      // If sitekey not set on server, show dev mode
      const sk = sitekey ? undefined : "10000000-ffff-ffff-ffff-000000000001"; // hcaptcha test key
      captchaWidgetId = hcaptcha.render(captchaBox, {
        sitekey: sk || undefined,
        theme: document.documentElement.classList.contains("light") ? "light" : "dark",
        callback: (token)=>{
          capState.textContent = "검증 중...";
          socket.emit("captcha_token", token);
        },
      });
      capState.textContent = "캡차를 완료해주세요.";
      captchaReady = true;
    }).catch(()=>{
      capState.textContent = "캡차 로딩 실패";
    });
  }
  renderCaptcha();

  // captcha result
  socket.on("captcha_ok",(ok)=>{
    if (ok){
      captchaVerified = true;
      capState.textContent = "인증 완료 ✅ 이제 매칭을 시작할 수 있어요.";
      btnFind.disabled = false;
    }else{
      captchaVerified = false;
      capState.textContent = "인증 실패 ❌ 다시 시도하세요.";
      if (window.hcaptcha && captchaWidgetId!==null) hcaptcha.reset(captchaWidgetId);
      btnFind.disabled = true;
    }
  });

  // events
  btnFind.addEventListener("click", () => {
    if (!captchaVerified){
      addSys("캡차 인증이 필요합니다.");
      return;
    }
    addSys("상대를 찾는 중...");
    socket.emit("find");
    setState("waiting");
  });
  btnCancel.addEventListener("click", () => {
    socket.emit("cancel_wait");
    addSys("매칭을 취소했습니다.");
    setState("idle");
  });
  btnNext.addEventListener("click", () => {
    addSys("다음 상대를 찾습니다.");
    socket.emit("next");
    setState("waiting");
  });
  btnEnd.addEventListener("click", () => {
    addSys("연결을 종료했습니다.");
    socket.disconnect();
    setTimeout(() => window.location.reload(), 400);
  });
  btnReport && btnReport.addEventListener("click", () => { if (matched) socket.emit("report"); });
  btnBlock && btnBlock.addEventListener("click", () => { if (matched) socket.emit("block"); });

  // nickname
  btnSaveNick.addEventListener("click", () => {
    const v = (nick.value || "").trim();
    if (v) socket.emit("set_nick", v);
  });

  // compose
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    socket.emit("send", { text });
    input.value = "";
    count.textContent = "0 / 5000";
    socket.emit("typing", false);
  });
  input.addEventListener("keydown",(e)=>{
    if (e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      form.dispatchEvent(new Event("submit"));
    }
  });
  input.addEventListener("input", () => {
    const len = input.value.length;
    count.textContent = `${len} / 5000`;
    if (matched){
      socket.emit("typing", true);
      clearTimeout(window.__typingTimer);
      window.__typingTimer = setTimeout(() => socket.emit("typing", false), 1200);
    }
  });

  // socket handlers
  socket.on("waiting", () => { addSys("대기열에 등록되었습니다. 곧 연결됩니다."); setState("waiting"); });
  socket.on("idle", () => setState("idle"));
  socket.on("matched", () => { addSys("상대와 연결되었습니다. 예의를 지켜 대화해 주세요."); setState("chat"); snd.play().catch(()=>{}); });
  socket.on("recv", (msg) => {
    if (msg.from === "me"){
      addMsg(msg.text, { me: true, meta: "나", at: msg.at });
    } else {
      addMsg(msg.text, { meta: msg.from || "상대", at: msg.at });
      snd.play().catch(()=>{});
    }
  });
  socket.on("typing", (flag) => typing.classList.toggle("hidden", !flag));
  socket.on("warn", (m) => addSys(m));
  socket.on("nick_ok", (n) => addSys(`닉네임이 '${n}'(으)로 저장되었습니다.`));
  socket.on("partner_left", () => { addSys("상대가 나갔습니다."); setState("idle"); });
  socket.on("banned", (m) => { addSys(m || "규칙 위반으로 세션이 종료되었습니다."); setState("idle"); });
  socket.on("seen", (ts)=>{
    read.textContent = `읽음 ${fmtTime(ts)}`;
    setTimeout(()=>read.textContent="", 5000);
  });
  socket.on("queue_size",(n)=> qsize.textContent = n);

  // network indicator
  function setNet(ok){ net.textContent = ok ? "연결됨 ✅" : "연결 끊김 ❌"; }
  socket.on("connect", () => { setNet(true); setState("idle"); });
  socket.on("disconnect", () => setNet(false));
})();

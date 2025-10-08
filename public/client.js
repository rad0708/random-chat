
(()=>{
  const socket = io({ transports:["websocket","polling"] });
  const log = document.getElementById("log");
  const empty = document.getElementById("empty");
  const btnStart = document.getElementById("btnStart");
  const btnSend = document.getElementById("btnSend");
  const input = document.getElementById("input");
  const btnNext = document.getElementById("btnNext");
  const btnEnd = document.getElementById("btnEnd");
  const fab = document.getElementById("fab");
  const toast = document.getElementById("toast");
  const queueInfo = document.getElementById("queueInfo");
  const net = document.getElementById("net");
  const btnProfile = document.getElementById("btnProfile");
  const menu = document.getElementById("menu");
  const mTheme = document.getElementById("mTheme");
  const mNotify = document.getElementById("mNotify");
  const themeVal = document.getElementById("themeVal");
  const notifyVal = document.getElementById("notifyVal");
  const btnTheme = document.getElementById("btnTheme");
  const capdlg = document.getElementById("capdlg");
  const captchaBox = document.getElementById("captchaBox");
  const capClose = document.getElementById("capClose");
  const snd = document.getElementById("snd");

  let matched = false;
  let captchaWidgetId = null;
  let captchaVerified = false;
  let soundMode = "default";

  function setToast(text,type="info"){
    toast.textContent = text;
    toast.classList.add("show");
    setTimeout(()=>toast.classList.remove("show"), 2200);
  }

  function fmtTime(ts){
    const d = new Date(ts); const hh=String(d.getHours()).padStart(2,"0"); const mm=String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }
  function addMsg(text, me=false, at=Date.now()){
    const li = document.createElement("li");
    li.className = "msg " + (me?"me":"you");
    const t = document.createElement("div");
    t.textContent = text;
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = fmtTime(at);
    li.append(t, time);
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    if(!me && soundMode!=="off"){ snd.play().catch(()=>{}); }
  }

  function setState(state){
    if (state === "idle"){
      matched = false;
      empty.classList.remove("hidden");
      fab.classList.add("hidden");
      btnSend.disabled = true;
      document.getElementById("state").textContent = "대기 중";
    } else if (state === "waiting"){
      empty.classList.add("hidden");
      fab.classList.add("hidden");
      btnSend.disabled = true;
      setToast("대기열에 등록되었습니다. 곧 연결됩니다.");
      document.getElementById("state").textContent = "대기 중";
    } else if (state === "chat"){
      matched = true;
      empty.classList.add("hidden");
      fab.classList.remove("hidden");
      btnSend.disabled = false;
      document.getElementById("state").textContent = "채팅 중";
    }
  }

  // Theme
  function applyTheme(mode){
    document.documentElement.classList.remove("dark");
    if (mode==="dark" || (mode==="system" && window.matchMedia("(prefers-color-scheme: dark)").matches)){
      document.documentElement.classList.add("dark");
      btnTheme.textContent = "🌙";
      themeVal.textContent = mode==="dark" ? "다크" : "기기";
    } else {
      btnTheme.textContent = "🌞";
      themeVal.textContent = mode==="light" ? "라이트" : "기기";
    }
    localStorage.setItem("theme", mode);
  }
  const savedTheme = localStorage.getItem("theme") || "system";
  applyTheme(savedTheme);
  btnTheme.addEventListener("click", ()=>{
    const current = localStorage.getItem("theme") || "system";
    const next = current==="light" ? "dark" : (current==="dark" ? "system" : "light");
    applyTheme(next);
  });
  mTheme.addEventListener("click", ()=>{
    const order = ["system","light","dark"];
    const cur = localStorage.getItem("theme") || "system";
    const idx = (order.indexOf(cur)+1)%order.length;
    applyTheme(order[idx]);
    menu.classList.add("hidden");
  });

  // Notify
  function setNotify(mode){
    soundMode = mode; notifyVal.textContent = mode==="off" ? "끄기" : "기본";
    localStorage.setItem("notify", mode);
    menu.classList.add("hidden");
  }
  setNotify(localStorage.getItem("notify") || "default");
  mNotify.addEventListener("click", ()=>{
    setNotify(soundMode==="default" ? "off" : "default");
  });

  // Menu
  btnProfile.addEventListener("click", (e)=>{
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });
  document.addEventListener("click",(e)=>{
    if (!menu.contains(e.target) && e.target!==btnProfile){
      menu.classList.add("hidden");
    }
  });

  // Captcha modal
  async function ensureCaptcha(){
    if (captchaVerified) return true;
    capdlg.showModal();
    // Render widget
    function render(){
      if (!window.hcaptcha) return setTimeout(render, 200);
      fetch("/captcha/sitekey").then(r=>r.json()).then(({provided})=>{
        const sitekey = provided ? undefined : "10000000-ffff-ffff-ffff-000000000001"; // test key
        captchaWidgetId = hcaptcha.render(captchaBox, {
          sitekey: sitekey || undefined,
          callback: (token)=> socket.emit("captcha_token", token),
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        });
      });
    }
    render();
    return new Promise((resolve)=>{
      socket.once("captcha_ok",(ok)=>{
        if (ok){ captchaVerified = true; capdlg.close(); setToast("인증 완료 ✅"); resolve(true); }
        else { setToast("인증 실패 ❌"); resolve(false); }
      });
      capClose.onclick = ()=>{ capdlg.close(); resolve(false); };
    });
  }

  // Start flow
  btnStart.addEventListener("click", async ()=>{
    const ok = await ensureCaptcha();
    if (!ok) return;
    socket.emit("find");
    setState("waiting");
  });

  // Send
  function send(){
    const text = input.value.trim();
    if (!text) return;
    socket.emit("send",{ text });
    input.value = "";
  }
  btnSend.addEventListener("click", send);
  input.addEventListener("keydown",(e)=>{
    if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); }
  });
  input.addEventListener("input", ()=>{
    if (matched){
      socket.emit("typing", true);
      clearTimeout(window.__typing);
      window.__typing = setTimeout(()=> socket.emit("typing", false), 1000);
    }
  });

  // FAB actions
  btnNext.addEventListener("click", ()=>{ setToast("다음 상대를 찾습니다."); socket.emit("next"); setState("waiting"); });
  btnEnd.addEventListener("click", ()=>{ location.reload(); });

  // Sockets
  socket.on("connect", ()=>{ net.textContent = "연결됨 ✅"; setState("idle"); });
  socket.on("disconnect", ()=>{ net.textContent = "연결 끊김 ❌"; });

  socket.on("waiting", ()=> setState("waiting"));
  socket.on("matched", ()=>{ setToast("상대와 연결되었습니다."); setState("chat"); if(soundMode!=="off") snd.play().catch(()=>{}); });
  socket.on("partner_left", ()=>{ setToast("상대가 나갔습니다."); setState("idle"); });
  socket.on("recv", (msg)=>{
    if (msg.from==="me"){ addMsg(msg.text, true, msg.at); }
    else { addMsg(msg.text, false, msg.at); }
  });
  socket.on("typing", (flag)=>{
    // Lightweight typing indicator as toast (optional)
    // flag ? setToast("상대가 입력 중…") : null;
  });
  socket.on("seen", (ts)=>{
    // Could update small checkmarks; kept minimal for clean UI
  });
  socket.on("queue_size",(n)=>{
    queueInfo.textContent = `지금 ${n}명이 기다리는 중`;
  });
  socket.on("toast", ({type,text})=> setToast(text,type));
})();

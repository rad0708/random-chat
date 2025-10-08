(()=>{
  const socket = io({ transports:["websocket","polling"] });
  const log = document.getElementById("log");
  const empty = document.getElementById("empty");
  const startBtn = document.getElementById("startBtn");
  const sendBtn = document.getElementById("sendBtn");
  const input = document.getElementById("input");
  const nextBtn = document.getElementById("nextBtn");
  const endBtn = document.getElementById("endBtn");
  const fab = document.getElementById("fab");
  const qsize = document.getElementById("qsize");
  const net = document.getElementById("net");
  const toast = document.getElementById("toast");
  const capdlg = document.getElementById("capdlg");
  const captchaBox = document.getElementById("captchaBox");
  const capCancel = document.getElementById("capCancel");
  const themeBtn = document.getElementById("themeBtn");
  const profileBtn = document.getElementById("profileBtn");
  const dropdown = document.getElementById("dropdown");
  const themeVal = document.getElementById("themeVal");
  const notifyVal = document.getElementById("notifyVal");
  const mTheme = document.getElementById("mTheme");
  const mNotify = document.getElementById("mNotify");
  const state = document.getElementById("state");
  const snd = document.getElementById("snd");

  let matched = false;
  let captchaReady = false;
  let sound = localStorage.getItem("notify") || "default";

  function t(msg){ toast.textContent=msg; toast.classList.add("show"); setTimeout(()=>toast.classList.remove("show"),2200); }
  function time(ts){ const d=new Date(ts); return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }
  function addMsg(text, me=false, at=Date.now()){
    const li=document.createElement("li");
    li.className="msg " + (me?"me":"you");
    li.innerHTML = `<div>${text}</div><div class="time">${time(at)}</div>`;
    log.appendChild(li); log.scrollTop = log.scrollHeight;
    if(!me && sound!=="off"){ snd.play().catch(()=>{}); }
  }
  function setPhase(p){
    if (p==="idle"){ matched=false; empty.classList.remove("hidden"); fab.classList.add("hidden"); sendBtn.disabled=true; state.textContent="대기 중"; }
    if (p==="waiting"){ empty.classList.add("hidden"); fab.classList.add("hidden"); sendBtn.disabled=true; state.textContent="대기 중"; t("대기열에 등록되었습니다."); }
    if (p==="chat"){ matched=true; empty.classList.add("hidden"); fab.classList.remove("hidden"); sendBtn.disabled=false; state.textContent="채팅 중"; }
  }

  // Theme toggle
  function applyTheme(mode){
    document.documentElement.classList.remove("dark");
    if (mode==="dark" || (mode==="system" && window.matchMedia("(prefers-color-scheme: dark)").matches)){
      document.documentElement.classList.add("dark"); themeBtn.textContent="🌙"; themeVal.textContent=(mode==="dark"?"다크":"기기");
    }else{ themeBtn.textContent="🌞"; themeVal.textContent=(mode==="light"?"라이트":"기기"); }
    localStorage.setItem("theme", mode);
  }
  applyTheme(localStorage.getItem("theme") || "system");
  themeBtn.addEventListener("click", ()=>{
    const order=["system","light","dark"]; const cur=localStorage.getItem("theme")||"system"; const next=order[(order.indexOf(cur)+1)%order.length]; applyTheme(next);
  });
  mTheme.addEventListener("click", ()=>{
    const order=["system","light","dark"]; const cur=localStorage.getItem("theme")||"system"; const next=order[(order.indexOf(cur)+1)%order.length]; applyTheme(next); dropdown.classList.add("hidden");
  });

  // Notify
  function setNotify(v){ sound=v; notifyVal.textContent=(v==="off"?"끄기":"기본"); localStorage.setItem("notify", v); }
  setNotify(sound);
  mNotify.addEventListener("click", ()=>{ setNotify(sound==="off"?"default":"off"); dropdown.classList.add("hidden"); });

  // Profile dropdown
  profileBtn.addEventListener("click",(e)=>{ e.stopPropagation(); dropdown.classList.toggle("hidden"); });
  document.addEventListener("click",(e)=>{ if(!dropdown.contains(e.target) && e.target!==profileBtn) dropdown.classList.add("hidden"); });

  // Captcha open & verify
  function ensureCaptcha(){
    return new Promise((resolve)=>{
      if (captchaReady) return resolve(true);
      capdlg.showModal();
      function render(){
        if (!window.hcaptcha) return setTimeout(render, 150);
        const wid = hcaptcha.render(captchaBox, {
          sitekey: "10000000-ffff-ffff-ffff-000000000001", // test; prod는 대시보드 SiteKey 자동 적용
          callback: (token)=> socket.emit("captcha", token),
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        });
      }
      render();
      socket.once("captcha_ok",(ok)=>{ if(ok){ captchaReady=true; capdlg.close(); t("인증 완료 ✅"); resolve(true); } else { t("인증 실패 ❌"); resolve(false); } });
      capCancel.onclick = ()=>{ capdlg.close(); resolve(false); };
    });
  }

  // Start / next / end
  startBtn.addEventListener("click", async ()=>{ const ok=await ensureCaptcha(); if(!ok) return; socket.emit("find"); setPhase("waiting"); });
  nextBtn.addEventListener("click", ()=>{ socket.emit("next"); setPhase("waiting"); });
  endBtn.addEventListener("click", ()=>{ location.href="/"; });

  // Send
  function send(){ const text=input.value.trim(); if(!text) return; socket.emit("send",{text}); input.value=""; }
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown",(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } });

  // Sockets
  socket.on("connect", ()=>{ net.textContent="연결됨 ✅"; setPhase("idle"); });
  socket.on("disconnect", ()=>{ net.textContent="연결 끊김 ❌"; setPhase("idle"); });
  socket.on("waiting", ()=> setPhase("waiting"));
  socket.on("matched", ()=>{ t("상대와 연결되었습니다."); setPhase("chat"); if(sound!=="off") { snd.play().catch(()=>{});} });
  socket.on("left", ()=>{ t("상대가 나갔습니다."); setPhase("idle"); });
  socket.on("qsize",(n)=> qsize.textContent=`지금 ${n}명이 기다리는 중`);
  socket.on("toast",(m)=> t(m));
  socket.on("recv",(m)=>{ addMsg(m.text, m.from==="me", m.at); });
})();

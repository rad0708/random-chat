
(() => {
  const routes = () => {
    const hash = location.hash || "#home";
    document.getElementById("home").style.display = hash==="#home"?"block":"none";
    document.getElementById("chat").style.display = hash==="#chat"?"grid":"none";
    document.getElementById("legal").style.display = hash==="#legal"?"block":"none";
  };
  window.addEventListener("hashchange", routes);
  routes();

  const socket = io();

  const onlineCount = document.getElementById('onlineCount');
  const matchState = document.getElementById('matchState');
  const chatArea = document.getElementById('chatArea');
  const msgInput = document.getElementById('msgInput');
  const btnSend = document.getElementById('btnSend');
  const btnNew = document.getElementById('btnNew');
  const btnReport = document.getElementById('btnReport');
  const typingHint = document.getElementById('typingHint');
  const stateText = document.getElementById('stateText');
  const stateDot = document.getElementById('stateDot');

  function addMsg(text, mine=false){
    const bubble = document.createElement('div');
    bubble.className = 'msg ' + (mine?'mine':'other');
    const safe = text.replace(/</g,"&lt;").replace(/>/g,"&gt;");
    bubble.innerHTML = safe + `<span class="time">${new Date().toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'})}</span>`;
    chatArea.appendChild(bubble);
    chatArea.scrollTop = chatArea.scrollHeight;
  }
  function addSystem(text){
    const d = document.createElement('div');
    d.className = 'system';
    d.textContent = text;
    chatArea.appendChild(d);
    chatArea.scrollTop = chatArea.scrollHeight;
  }
  function setState(text, color="#22d3ee"){
    stateText.textContent = text;
    stateDot.style.color = color;
  }

  // Join queue when entering chat view
  window.addEventListener("hashchange", () => {
    if(location.hash==="#chat"){
      chatArea.innerHTML = "";
      addSystem("상대방을 찾는 중...");
      socket.emit("joinQueue");
      setState("대기 중", "#aaa");
    } else {
      socket.emit("leaveQueue");
    }
  });

  // Typing indicator
  let typingTimer = null;
  msgInput.addEventListener("input", () => {
    socket.emit("typing");
  });

  // Send
  function send(){
    const v = msgInput.value.trim();
    if(!v) return;
    socket.emit("message", v);
    addMsg(v,true);
    msgInput.value = "";
  }
  btnSend.addEventListener("click", send);
  msgInput.addEventListener("keydown", (e) => {
    if(e.key === "Enter"){ e.preventDefault(); send(); }
  });

  // New partner
  btnNew.addEventListener("click", () => {
    chatArea.innerHTML = "";
    addSystem("새 상대를 찾는 중...");
    socket.emit("newPartner");
    setState("대기 중", "#aaa");
  });

  // Report
  btnReport.addEventListener("click", () => {
    const reason = prompt("신고 사유를 입력하세요 (욕설/스팸/기타):");
    if(reason){
      socket.emit("report", reason.slice(0,200));
      addSystem("신고가 접수되었습니다.");
    }
  });

  // Socket events
  socket.on("onlineCount", (n) => { if(onlineCount) onlineCount.textContent = n; });
  socket.on("system", (msg) => addSystem(msg));
  socket.on("paired", () => {
    addSystem("상대와 연결되었습니다. 매너 채팅 부탁드려요!");
    setState("연결됨", "#22d3ee");
  });
  socket.on("message", (msg) => addMsg(msg,false));
  socket.on("typing", () => {
    typingHint.style.display = 'inline';
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => typingHint.style.display='none', 1200);
  });
  socket.on("partnerLeft", () => {
    addSystem("상대방이 나갔습니다. 자동으로 대기열에 들어갑니다.");
    setState("대기 중", "#aaa");
  });
  socket.on("rateLimited", () => addSystem("메시지를 너무 빠르게 보내고 있습니다."));
})();

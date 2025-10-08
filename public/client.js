
(() => {
  const socket = io({ transports: ["websocket", "polling"] });
  const log = document.getElementById("log");
  const typing = document.getElementById("typing");
  const form = document.getElementById("form");
  const input = document.getElementById("input");
  const count = document.getElementById("count");
  const btnSend = document.getElementById("btnSend");
  const btnFind = document.getElementById("btnFind");
  const btnNext = document.getElementById("btnNext");
  const btnEnd = document.getElementById("btnEnd");
  const btnReport = document.getElementById("btnReport");
  const btnBlock = document.getElementById("btnBlock");
  const nick = document.getElementById("nick");
  const btnSaveNick = document.getElementById("btnSaveNick");

  let matched = false;
  let typingTimer;

  function addLine(text, opts={}){
    const li = document.createElement("li");
    if (opts.me) li.classList.add("me");
    if (opts.meta){
      const m = document.createElement("div");
      m.className = "meta";
      m.textContent = opts.meta;
      li.appendChild(m);
    }
    li.appendChild(document.createTextNode(text));
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
  }

  function setState(state){
    if (state === "idle"){
      matched = false;
      btnFind.disabled = false;
      btnNext.disabled = true;
      btnEnd.disabled = true;
      btnSend.disabled = true;
      btnReport.disabled = true;
      btnBlock.disabled = true;
      typing.classList.add("hidden");
    } else if (state === "waiting"){
      btnFind.disabled = true;
      btnNext.disabled = true;
      btnEnd.disabled = false;
      btnSend.disabled = true;
      btnReport.disabled = true;
      btnBlock.disabled = true;
    } else if (state === "chat"){
      matched = true;
      btnFind.disabled = true;
      btnNext.disabled = false;
      btnEnd.disabled = false;
      btnSend.disabled = false;
      btnReport.disabled = false;
      btnBlock.disabled = false;
    }
  }

  // UI events
  btnFind.addEventListener("click", () => {
    addLine("상대를 찾는 중...", { meta: "시스템" });
    socket.emit("find");
    setState("waiting");
  });

  btnNext.addEventListener("click", () => {
    addLine("다음 상대를 찾습니다.", { meta: "시스템" });
    socket.emit("next");
    setState("waiting");
  });

  btnEnd.addEventListener("click", () => {
    addLine("연결을 종료했습니다.", { meta: "시스템" });
    socket.disconnect();
    setTimeout(() => window.location.reload(), 400);
  });

  btnReport.addEventListener("click", () => {
    if (!matched) return;
    socket.emit("report");
  });

  btnBlock.addEventListener("click", () => {
    if (!matched) return;
    socket.emit("block");
  });

  btnSaveNick.addEventListener("click", () => {
    const v = (nick.value || "").trim();
    if (!v) return;
    socket.emit("set_nick", v);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    socket.emit("send", { text });
    input.value = "";
    count.textContent = "0 / 5000";
    socket.emit("typing", false);
  });

  input.addEventListener("input", () => {
    const len = input.value.length;
    count.textContent = `${len} / 5000`;
    if (matched){
      socket.emit("typing", true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => socket.emit("typing", false), 1200);
    }
  });

  // Socket events
  socket.on("waiting", () => {
    addLine("대기열에 등록되었습니다. 곧 연결됩니다.", { meta: "시스템" });
    setState("waiting");
  });

  socket.on("matched", () => {
    addLine("상대와 연결되었습니다. 예의를 지켜 대화해 주세요.", { meta: "시스템" });
    setState("chat");
  });

  socket.on("recv", (msg) => {
    if (msg.from === "me"){
      addLine(msg.text, { me: true, meta: "나" });
    } else {
      addLine(msg.text, { meta: msg.from || "상대" });
    }
  });

  socket.on("typing", (flag) => {
    typing.classList.toggle("hidden", !flag);
  });

  socket.on("warn", (m) => addLine(m, { meta: "알림" }));
  socket.on("nick_ok", (n) => addLine(`닉네임이 '${n}'(으)로 저장되었습니다.`, { meta: "설정" }));

  socket.on("partner_left", () => {
    addLine("상대가 나갔습니다. 새 상대를 찾아보세요.", { meta: "시스템" });
    setState("idle");
  });

  socket.on("banned", (m) => {
    addLine(m || "규칙 위반으로 세션이 종료되었습니다.", { meta: "시스템" });
    setState("idle");
  });

  socket.on("connect", () => setState("idle"));
  socket.on("disconnect", () => addLine("서버와의 연결이 끊어졌습니다.", { meta: "시스템" }));
})();

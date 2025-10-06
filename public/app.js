const socket = io();

const home = document.getElementById("home");
const chat = document.getElementById("chat");
const startBtn = document.getElementById("startBtn");
const nicknameInput = document.getElementById("nickname");
const leaveBtn = document.getElementById("leaveBtn");
const nextBtn = document.getElementById("nextBtn");
const form = document.getElementById("form");
const input = document.getElementById("input");
const messages = document.getElementById("messages");
const typingDiv = document.getElementById("typing");
const onlineSpan = document.getElementById("online");

let myProfile = null;

startBtn.onclick = () => {
  const name = nicknameInput.value.trim();
  if(!name) return alert("닉네임을 입력하세요!");
  myProfile = { name };
  socket.emit("join", myProfile);
  home.style.display = "none";
  chat.style.display = "block";
};

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if(input.value){
    socket.emit("chat message", input.value);
    addMessage("나", input.value);
    input.value = "";
    socket.emit("stopTyping");
  }
});

input.addEventListener("input", () => {
  if(input.value) socket.emit("typing");
  else socket.emit("stopTyping");
});

nextBtn.onclick = () => {
  socket.emit("next");
  messages.innerHTML = "";
};

leaveBtn.onclick = () => {
  socket.emit("leave");
  chat.style.display = "none";
  home.style.display = "block";
  messages.innerHTML = "";
};

socket.on("chat message", (data) => {
  addMessage(data.user.name, data.text);
});

socket.on("status", (s) => {
  addSystemMessage(s.text);
});

socket.on("system", (msg) => {
  addSystemMessage(msg);
});

socket.on("partner-left", () => {
  addSystemMessage("상대방이 나갔습니다. 새로운 상대를 찾는 중…");
});

socket.on("typing", (user) => {
  typingDiv.textContent = user.name + " 입력 중...";
});
socket.on("stopTyping", () => {
  typingDiv.textContent = "";
});

socket.on("online", (n) => {
  onlineSpan.textContent = "접속자: " + n + "명";
});

function addMessage(user, text){
  const item = document.createElement("li");
  item.innerHTML = "<b>" + user + ":</b> " + text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(text){
  const item = document.createElement("li");
  item.className = "system";
  item.textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

const socket = io();

const chatBox = document.getElementById("chat-box");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const newBtn = document.getElementById("new-btn");

sendBtn.addEventListener("click", () => {
  const msg = messageInput.value.trim();
  if(msg){
    socket.emit("message", msg);
    messageInput.value = "";
  }
});

newBtn.addEventListener("click", () => {
  socket.emit("newChat");
  chatBox.innerHTML = "<p>새로운 상대를 찾는 중...</p>";
});

socket.on("message", (msg) => {
  const p = document.createElement("p");
  p.textContent = msg;
  chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
});
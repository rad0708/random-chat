const socket = io();
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const send = document.getElementById('send');
const newBtn = document.getElementById('new');
const clearBtn = document.getElementById('clear');

function getTime() {
  const now = new Date();
  return now.getHours().toString().padStart(2,'0') + ":" +
         now.getMinutes().toString().padStart(2,'0');
}

function addMsg(msg, type="other") {
  const div = document.createElement('div');
  if(type === "system") {
    div.className = "system";
    div.textContent = msg;
  } else {
    div.className = "msg " + type;
    div.textContent = msg;
    const time = document.createElement('span');
    time.className = "time";
    time.textContent = getTime();
    div.appendChild(time);
  }
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

send.onclick = () => {
  if(input.value.trim()){
    socket.emit('message', input.value);
    addMsg(input.value, "mine");
    input.value = '';
  }
};

input.addEventListener("keydown", (e) => {
  if(e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send.onclick();
  }
});

newBtn.onclick = () => {
  socket.emit("newPartner");
  chat.innerHTML = "";
  addMsg("새 상대를 찾는 중...", "system");
};

clearBtn.onclick = () => {
  chat.innerHTML = "";
  addMsg("대화창이 지워졌습니다.", "system");
};

socket.on('message', msg => addMsg(msg, "other"));
socket.on('system', msg => addMsg(msg, "system"));

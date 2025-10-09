const socket=io();
const $=id=>document.getElementById(id);
const $start=$("startBtn"),$gate=$("gate"),$chatbox=$("chatbox"),$status=$("status"),$online=$("online"),$messages=$("messages"),$input=$("input"),$send=$("send"),$next=$("next"),$timer=$("timer"),$typing=$("typing");

let startTs=null;let notif=false;
function timerTick(){if(!startTs)return;const d=Math.floor((Date.now()-startTs)/1000);$timer.textContent=Math.floor(d/60)+":"+String(d%60).padStart(2,"0");requestAnimationFrame(timerTick);}

function addMsg(t,cls){const li=document.createElement("li");li.textContent=t;li.className=cls;$messages.appendChild(li);$messages.scrollTop=$messages.scrollHeight;}

function onSubmitCaptcha(){const token=window.hcaptcha.getResponse();fetch("/verify-captcha",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).then(r=>r.json()).then(d=>{if(d.ok){$start.disabled=false;}else{window.hcaptcha.reset();}});}
window.onSubmitCaptcha=onSubmitCaptcha;

$start.onclick=()=>{ $gate.hidden=true;$chatbox.hidden=false;socket.emit("start",{verified:true});startTs=Date.now();timerTick(); };
$send.onclick=()=>{const t=$input.value.trim();if(!t)return;socket.emit("chat",{text:t});addMsg("나: "+t,"me");$input.value="";};
$next.onclick=()=>{socket.emit("next");$status.textContent="상대를 찾는 중...";startTs=Date.now();};

socket.on("online",n=>{$online.textContent=n;});
socket.on("paired",()=>{$status.textContent="상대와 연결됨";});
socket.on("system",p=>addMsg(p.text,"sys"));
socket.on("chat",p=>{addMsg("상대: "+p.text,"partner");});
socket.on("typing",v=>{$typing.hidden=!v;});
$input.addEventListener("keydown",e=>{if(e.key==="Enter")$send.onclick();else socket.emit("typing",true);});

import React, { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

type Msg = { senderId: string; content: string; ts: number }

export default function Chat(){
  const [socket, setSocket] = useState<Socket | null>(null)
  const [roomId, setRoomId] = useState<string>('')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle'|'queuing'|'matched'>('idle')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const s = io('/', { path: '/socket.io' })
    setSocket(s)
    s.on('connect', () => console.log('connected'))
    s.on('queue:status', (p: any) => setStatus(p.queued ? 'queuing' : 'idle'))
    s.on('match:found', (p: any) => { setRoomId(p.roomId); setStatus('matched'); setMessages([]) })
    s.on('message:new', (m: Msg & {roomId:string}) => setMessages(prev => [...prev, { senderId: m.senderId, content: m.content, ts: m.ts }]))
    s.on('peer:left', () => { setStatus('idle'); setRoomId('') })
    return () => { s.disconnect() }
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const joinQueue = () => socket?.emit('queue:join')
  const leaveQueue = () => socket?.emit('queue:leave')
  const skip = () => socket?.emit('session:skip')
  const send = () => {
    if (!input.trim() || !roomId) return
    socket?.emit('message:send', { roomId, content: input.trim() })
    setMessages(prev => [...prev, { senderId: 'me', content: input.trim(), ts: Date.now() }])
    setInput('')
  }

  return (
    <div className="min-h-screen max-w-xl mx-auto flex flex-col">
      <header className="p-4 border-b flex items-center justify-between">
        <span className="font-semibold">상태: {status==='idle'?'대기':status==='queuing'?'상대 찾는 중':'연결됨'}</span>
        <div className="space-x-2">
          {status!=='matched' && <button onClick={joinQueue} className="px-3 py-1 rounded bg-black text-white">시작</button>}
          {status==='queuing' && <button onClick={leaveQueue} className="px-3 py-1 rounded border">취소</button>}
          {status==='matched' && <button onClick={skip} className="px-3 py-1 rounded border">다음</button>}
        </div>
      </header>
      <main className="flex-1 p-4 space-y-2 overflow-auto">
        {messages.map((m,i) => (
          <div key={i} className={"max-w-[80%] px-3 py-2 rounded-2xl " + (m.senderId==='me'?'bg-black text-white self-end ml-auto':'bg-gray-200')}>
            <div className="text-sm whitespace-pre-wrap">{m.content}</div>
            <div className="text-[10px] opacity-60 mt-1">{new Date(m.ts).toLocaleTimeString()}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </main>
      <footer className="p-3 border-t flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} className="flex-1 border rounded px-3" placeholder="메시지를 입력하세요" onKeyDown={e=>e.key==='Enter'&&send()} />
        <button onClick={send} className="px-4 rounded bg-black text-white">전송</button>
      </footer>
    </div>
  )
}


import React,{useEffect,useState} from 'react'
import { io } from 'socket.io-client'

export default function Chat(){
  const [messages,setMessages]=useState<string[]>([])
  const [input,setInput]=useState('')
  useEffect(()=>{
    const s=io()
    s.on('connect',()=>console.log('socket connected'))
    s.on('message:new',(m)=>setMessages(p=>[...p,m]))
    return ()=>{s.disconnect()}
  },[])
  return <div className='flex flex-col h-screen'>
    <div className='flex-1 overflow-auto p-4 space-y-2'>
      {messages.map((m,i)=><div key={i} className='p-2 bg-gray-200 rounded'>{m}</div>)}
    </div>
    <div className='p-2 border-t flex gap-2'>
      <input className='flex-1 border rounded px-2' value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setMessages(p=>[...p,input])}/>
      <button onClick={()=>{setMessages(p=>[...p,input]);setInput('')}} className='px-3 bg-black text-white rounded'>전송</button>
    </div>
  </div>
}

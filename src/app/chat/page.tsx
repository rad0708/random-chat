'use client'
import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

export default function Chat(){
 const [messages,setMessages]=useState<string[]>([])
 const [input,setInput]=useState('')
 useEffect(()=>{
  const s=io()
  s.on('message:new',(m)=>setMessages(p=>[...p,m]))
  return ()=>{s.disconnect()}
 },[])
 return <div className='flex flex-col h-screen'>
  <div className='flex-1 overflow-auto p-4'>{messages.map((m,i)=><div key={i}>{m}</div>)}</div>
  <form onSubmit={e=>{e.preventDefault();fetch('/api/socket');}} className='p-2 flex'>
   <input value={input} onChange={e=>setInput(e.target.value)} className='flex-1 border'/>
   <button className='px-2 bg-blue-500 text-white'>전송</button>
  </form>
 </div>
}

import { NextRequest } from 'next/server'
import { Server } from 'socket.io'
let io:Server|null=null
export const GET=async(req:NextRequest)=>{
 if(!io){
  // @ts-ignore
  io=new Server(globalThis.server,{path:'/api/socket'})
  io.on('connection',s=>{s.on('message:send',(m)=>{io?.emit('message:new',m)})})
 }
 return new Response('ok')
}
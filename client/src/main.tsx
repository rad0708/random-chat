
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Chat from './pages/Chat'
import './styles/index.css'

function Home(){
  return <div className='flex flex-col items-center justify-center h-screen gap-4'>
    <h1 className='text-4xl font-bold'>ShuffleChat</h1>
    <Link to='/chat' className='px-4 py-2 bg-black text-white rounded'>채팅 시작</Link>
  </div>
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Routes>
      <Route path='/' element={<Home/>}/>
      <Route path='/chat' element={<Chat/>}/>
    </Routes>
  </BrowserRouter>
)


import React from 'react'
import { Link } from 'react-router-dom'

export default function Home(){
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">ShuffleChat</h1>
      <p className="text-gray-600">익명 1:1 랜덤 채팅을 시작해 보세요.</p>
      <Link to="/chat" className="px-6 py-3 rounded-xl bg-black text-white hover:opacity-90">채팅 시작</Link>
      <footer className="absolute bottom-5 text-xs text-gray-400">© 2025 ShuffleChat</footer>
    </div>
  )
}

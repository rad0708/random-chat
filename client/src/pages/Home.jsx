import React from 'react'

export default function Home({ onStart }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">랜덤채팅 (Beta)</h1>
        <p className="text-gray-600 mb-8">본 서비스는 한국어 전용 1대1 랜덤 채팅 서비스입니다.</p>
        <button
          onClick={onStart}
          className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition"
        >
          채팅 시작하기
        </button>
      </div>
      <p className="mt-6 text-sm text-gray-500">한국어만 사용해주세요. 서비스 이용 중 부적절한 표현은 *** 처리됩니다.</p>
    </div>
  )
}

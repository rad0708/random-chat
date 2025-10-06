import React from 'react'

export default function MessageBubble({ mine, text, time }) {
  return (
    <div className={`w-full flex ${mine ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow text-sm ${mine ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm'}`}>
        <p className="whitespace-pre-wrap break-words">{text}</p>
        <div className={`mt-1 text-[10px] ${mine ? 'text-indigo-100' : 'text-gray-400'}`}>{time}</div>
      </div>
    </div>
  )
}

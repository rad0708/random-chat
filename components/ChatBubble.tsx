'use client'
import clsx from 'clsx'

export interface ChatBubbleProps {
  isOwn: boolean
  nickname: string
  message: string
  timestamp: string
}

export function ChatBubble({ isOwn, nickname, message, timestamp }: ChatBubbleProps) {
  const t = new Date(timestamp)
  const time = isNaN(t.getTime()) ? '' : t.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={clsx('flex w-full flex-col gap-1', { 'items-end text-right': isOwn, 'items-start text-left': !isOwn })}>
      <span className="text-xs text-gray-500">{nickname}{time ? ` · ${time}` : ''}</span>
      <div
        className={clsx('max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow', {
          'rounded-br-sm bg-primary text-white': isOwn,
          'rounded-bl-sm bg-white text-gray-900': !isOwn,
        })}
        role="text"
        aria-label={`${nickname}의 메시지`}
      >
        {message}
      </div>
    </div>
  )
}

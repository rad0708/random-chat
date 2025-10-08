'use client';
import clsx from 'clsx';

export default function ChatBubble({ isOwn, nickname, message, timestamp }:
  { isOwn: boolean; nickname: string; message: string; timestamp: string; }) {
  return (
    <div className={clsx('flex w-full flex-col gap-1', { 'items-end text-right': isOwn, 'items-start text-left': !isOwn })}>
      <span className="text-xs text-gray-500">
        {nickname} · {new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <div className={clsx('max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow', { 'rounded-br-sm bg-primary text-white': isOwn, 'rounded-bl-sm bg-white text-gray-900': !isOwn })} role="text">
        {message}
      </div>
    </div>
  );
}

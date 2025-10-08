'use client'
export function TypingIndicator({ nickname }: { nickname: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500" role="status" aria-live="polite">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
      </span>
      <span>{nickname} 님이 입력 중…</span>
    </div>
  )
}

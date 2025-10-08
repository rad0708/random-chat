'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AdBanner from '@/components/AdBanner'

const tips = [
  '새로운 사람과 부담 없이 대화해 보세요.',
  '닉네임은 접속 때마다 새롭게 생성됩니다.',
  '매너 채팅을 지켜주세요 🙂',
]

export default function HomePage() {
  const router = useRouter()
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const i = setInterval(() => setTipIndex((p) => (p + 1) % tips.length), 4000)
    return () => clearInterval(i)
  }, [])

  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-4xl font-bold text-dark sm:text-5xl">셔플챗과 함께 새로운 만남을 시작하세요</h1>
        <p className="text-lg text-gray-700 sm:text-xl">
          셔플챗은 익명으로 즐기는 1:1 랜덤 채팅 서비스입니다. 지금 바로 랜덤 채팅을 시작해보세요.
        </p>
        <button
          type="button"
          className="rounded-full bg-primary px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-secondary focus-visible:outline-none"
          onClick={() => router.push('/chat')}
        >
          랜덤 채팅 시작
        </button>
        <p className="text-sm text-gray-500" key={tipIndex}>{tips[tipIndex]}</p>

        <div className="mx-auto max-w-2xl">
          <AdBanner />
        </div>
      </div>
    </section>
  )
}

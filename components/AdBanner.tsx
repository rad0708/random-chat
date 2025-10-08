'use client'

import { useEffect } from 'react'

export default function AdBanner() {
  useEffect(() => {
    // 실제 광고 스크립트 삽입 위치
  }, [])

  return (
    <div
      role="complementary"
      aria-label="광고 영역"
      className="w-full rounded-xl border border-dashed border-gray-300 bg-white/70 p-4 text-center text-sm text-gray-600"
    >
      광고가 여기에 표시됩니다.
    </div>
  )
}

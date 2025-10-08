'use client';

import { useEffect, useRef } from 'react';

/**
 * 광고 배너 컴포넌트
 * - 환경변수 NEXT_PUBLIC_ADSENSE_CLIENT / NEXT_PUBLIC_ADSENSE_SLOT 이 설정되면 AdSense 렌더링
 * - 없으면 심플한 플레이스홀더 표시
 */
export function AdBanner() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;
  const adRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!client || !slot) return;
    // 동적으로 스크립트 삽입
    const id = 'adsbygoogle-js';
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.async = true;
      s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + client;
      s.crossOrigin = 'anonymous';
      document.head.appendChild(s);
    }
    // 광고 요청 트리거
    // @ts-ignore
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }, [client, slot]);

  if (!client || !slot) {
    return (
      <div className="w-full rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-sm text-gray-500">
        광고 영역 — 환경변수(NEXT_PUBLIC_ADSENSE_CLIENT, NEXT_PUBLIC_ADSENSE_SLOT)를 설정하면 실제 광고가 노출됩니다.
      </div>
    );
  }

  return (
    <ins
      ref={adRef as any}
      className="adsbygoogle block w-full"
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

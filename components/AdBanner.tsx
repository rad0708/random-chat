'use client';
import { useEffect } from 'react';

/**
 * 실제 광고 스크립트를 붙여넣을 위치.
 * 기본은 플레이스홀더 스타일로 표시됩니다.
 */
export default function AdBanner() {
  useEffect(() => {
    // 예: (Google AdSense를 쓴다면 스크립트 로드)
    // const s = document.createElement('script');
    // s.async = true;
    // s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXX';
    // s.crossOrigin = 'anonymous';
    // document.body.appendChild(s);
    // return () => { document.body.removeChild(s); };
  }, []);

  return (
    <div className="w-full rounded-xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
      광고 영역 (ads.txt 참고) — 운영 시 실제 광고 스크립트를 삽입하세요.
    </div>
  );
}

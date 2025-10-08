import type { Metadata } from 'next';

export const metadata: Metadata = { title: '셔플챗 개인정보 처리방침' };

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-dark">셔플챗 개인정보 처리방침</h1>
      <p className="mt-4 text-sm text-gray-600">최종 업데이트: 2024-05-01</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-dark">1. 수집하는 개인정보</h2>
          <p>로그인 없이 이용 가능하며, 서버는 식별 가능한 개인정보를 저장하지 않습니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">2. 이용 목적</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>익명 채팅 매칭을 위한 임시 세션 관리(메모리)</li>
            <li>서비스 품질 개선을 위한 최소한의 로그</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">3. 보관 및 파기</h2>
          <p>메모리 기반으로 세션이 종료되면 즉시 파기됩니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">4. 제3자 제공</h2>
          <p>개인정보를 제3자에게 제공하지 않습니다.</p>
        </section>
      </div>
    </section>
  );
}

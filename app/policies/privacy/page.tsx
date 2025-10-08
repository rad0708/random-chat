import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '셔플챗 개인정보 처리방침',
};

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-dark">셔플챗 개인정보 처리방침</h1>
      <p className="mt-4 text-sm text-gray-600">최종 업데이트: 2024-05-01</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-dark">1. 수집하는 개인정보</h2>
          <p>
            셔플챗은 로그인 없이 이용 가능한 서비스로, 식별 가능한 개인정보를 수집하지 않습니다. 서비스 이용 중 생성되는 임시 닉네임과 세션 정보는 서버 메모리에서만 관리되며 저장되지 않습니다.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">2. 개인정보의 이용 목적</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>익명 채팅 매칭을 위한 임시 세션 관리</li>
            <li>실시간 채팅 제공</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">3. 보관 및 파기</h2>
          <p>
            서버는 최소한의 정보를 메모리로만 관리하며, 연결 종료 시 즉시 파기됩니다.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">4. 제3자 제공</h2>
          <p>셔플챗은 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.</p>
        </section>
      </div>
    </section>
  );
}

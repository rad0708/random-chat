import type { Metadata } from 'next';

export const metadata: Metadata = { title: '셔플챗 이용약관' };

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-dark">셔플챗 이용약관</h1>
      <p className="mt-4 text-sm text-gray-600">최종 업데이트: 2024-05-01</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-dark">제1조 (목적)</h2>
          <p>익명 랜덤 채팅 서비스 이용에 관한 권리와 의무를 규정합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">제2조 (이용자의 의무)</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>법령과 본 약관 준수</li>
            <li>욕설/비방/음란물 전송 금지</li>
          </ul>
        </section>
      </div>
    </section>
  );
}

export const metadata = { title: '이용약관 - 셔플챗' };
export default function Terms() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-dark">이용약관</h1>
      <p className="mt-4 text-sm text-gray-600">최종 업데이트: 2024-05-01</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <ul className="list-disc pl-6 space-y-2">
          <li>서비스는 익명 1:1 채팅을 제공합니다.</li>
          <li>욕설/불법행위 등 부적절한 이용은 금지됩니다.</li>
          <li>서비스는 중단/변경될 수 있습니다.</li>
        </ul>
      </div>
    </section>
  );
}

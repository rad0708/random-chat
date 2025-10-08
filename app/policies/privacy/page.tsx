export const metadata = { title: '셔플챗 개인정보 처리방침' }

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-dark">셔플챗 개인정보 처리방침</h1>
      <p className="mt-4 text-sm text-gray-600">최종 업데이트: 2024-05-01</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-dark">1. 수집하는 개인정보</h2>
          <p>본 서비스는 로그인 없이 이용 가능하며, 식별 가능한 개인정보를 수집하지 않습니다. 단, 서비스 운영을 위해 세션 ID, 임시 닉네임 등 비식별 정보를 일시적으로 메모리에 저장할 수 있습니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">2. 이용 목적</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>익명 채팅 매칭을 위한 임시 세션 관리</li>
            <li>서비스 품질 개선</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">3. 보관 및 파기</h2>
          <p>정보는 메모리 기반으로 운영되며, 연결 종료 시 점진적으로 파기됩니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">4. 제3자 제공</h2>
          <p>동의 없이 개인정보를 제3자에게 제공하지 않습니다.</p>
        </section>
      </div>
    </section>
  )
}

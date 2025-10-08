export const metadata = { title: '셔플챗 이용약관' }

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-dark">셔플챗 이용약관</h1>
      <p className="mt-4 text-sm text-gray-600">최종 업데이트: 2024-05-01</p>
      <div className="mt-8 space-y-6 text-sm leading-7 text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-dark">제1조 (목적)</h2>
          <p>본 약관은 셔플챗(이하 “서비스”)의 이용과 관련하여 서비스와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">제2조 (용어의 정의)</h2>
          <p>“이용자”란 본 약관에 따라 서비스를 이용하는 자를 말하며, 셔플챗은 익명 랜덤 채팅을 제공하는 플랫폼입니다.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">제3조 (서비스의 제공)</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>셔플챗은 익명 랜덤 1:1 채팅 서비스를 제공합니다.</li>
            <li>서비스는 시스템 점검 등 필요한 경우 일시 중단될 수 있습니다.</li>
            <li>서비스는 이용자에게 익명 닉네임을 자동 부여합니다.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">제4조 (이용자의 의무)</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>이용자는 관련 법령과 본 약관을 준수해야 합니다.</li>
            <li>욕설, 비방, 음란물 전송 등 타인에게 피해를 주는 행위를 할 수 없습니다.</li>
            <li>서비스 이용 중 알게 된 개인정보를 무단으로 수집, 이용 또는 공개할 수 없습니다.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-dark">제5조 (면책)</h2>
          <p>서비스는 이용자 간 분쟁에 대해 법령상 책임이 없는 경우 책임을 지지 않습니다. 단, 건전한 이용 환경을 위해 최선을 다합니다.</p>
        </section>
      </div>
    </section>
  )
}

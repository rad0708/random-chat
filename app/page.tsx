export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-4">ShuffleChat</h1>
      <p className="mb-6">익명 1:1 랜덤 채팅 서비스</p>
      <a href="/chat" className="bg-blue-500 text-white px-6 py-3 rounded-lg">랜덤 채팅 시작</a>
      <footer className="mt-10 text-sm text-gray-500">
        <a href="/policies/terms" className="mr-4">이용약관</a>
        <a href="/policies/privacy">개인정보 처리방침</a>
      </footer>
    </main>
  );
}
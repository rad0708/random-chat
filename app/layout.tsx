import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '셔플챗 | 익명 랜덤 채팅',
  description: '로그인 없이 즐기는 1:1 랜덤 채팅 서비스',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen flex flex-col bg-gradient-to-b from-white to-indigo-50">
          <header className="w-full border-b border-indigo-100 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
              <a className="text-2xl font-bold text-primary" href="/">셔플챗</a>
              <nav aria-label="주요 메뉴" className="flex gap-4 text-sm text-gray-600">
                <a href="/policies/terms">이용약관</a>
                <a href="/policies/privacy">개인정보 처리방침</a>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-indigo-100 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-gray-600 sm:flex-row">
              <p className="text-center">© {new Date().getFullYear()} 셔플챗</p>
              <div className="flex gap-4">
                <a href="/policies/terms">이용약관</a>
                <a href="/policies/privacy">개인정보 처리방침</a>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

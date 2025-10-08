import './styles/globals.css'
import { ReactNode } from 'react'

export const metadata = {
  title: 'NextChat',
  description: '랜덤 채팅 서비스',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  )
}

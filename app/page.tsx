'use client';
import { useRouter } from 'next/navigation';
import AdBanner from '@/components/AdBanner';

export default function HomePage() {
  const router = useRouter();
  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="mx-auto max-w-3xl space-y-8">
        <h1 className="text-4xl font-bold text-dark sm:text-5xl">셔플챗과 함께 새로운 만남을 시작하세요</h1>
        <p className="text-lg text-gray-700 sm:text-xl">익명으로 즐기는 1:1 랜덤 채팅 서비스. 버튼 한 번으로 바로 매칭!</p>
        <button
          type="button"
          className="rounded-full bg-primary px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-secondary"
          onClick={() => router.push('/chat')}
        >
          랜덤 채팅 시작
        </button>
        <div className="pt-4">
          <AdBanner />
        </div>
      </div>
    </section>
  );
}

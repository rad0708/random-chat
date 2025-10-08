'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import ChatBubble from '@/components/ChatBubble';
import TypingIndicator from '@/components/TypingIndicator';
import AdBanner from '@/components/AdBanner';

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  nickname: string;
  content: string;
  createdAt: string;
}
interface SessionPayload { sessionId: string; nickname: string; }
interface MatchPayload { roomId: string; partnerNickname: string; }
interface TypingPayload { isTyping: boolean; nickname: string; }

const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? undefined;

export default function ChatPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [partnerNickname, setPartnerNickname] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [statusMessage, setStatusMessage] = useState('상대를 찾는 중입니다...');
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  const isMatched = useMemo(() => Boolean(roomId && partnerNickname), [roomId, partnerNickname]);

  useEffect(() => {
    const socket = io(socketUrl, { withCredentials: true });
    socketRef.current = socket;
    socket.on('connect', () => { setStatusMessage('상대를 찾는 중입니다...'); socket.emit('queue:join'); });
    socket.on('session:init', (payload: SessionPayload) => setSession(payload));
    socket.on('match:found', (payload: MatchPayload) => {
      setRoomId(payload.roomId);
      setPartnerNickname(payload.partnerNickname);
      setStatusMessage('연결되었습니다! 즐거운 대화 나눠보세요.');
      setMessages([]);
    });
    socket.on('message:new', (message: ChatMessage) => setMessages(prev => [...prev, message]));
    socket.on('typing', (payload: TypingPayload) => setIsPartnerTyping(payload.isTyping));
    socket.on('session:end', () => {
      setStatusMessage('상대방이 나갔습니다. 다음 상대를 찾을 수 있어요.');
      setPartnerNickname(''); setRoomId(null); setMessages([]);
    });
    socket.on('queue:waiting', () => setStatusMessage('상대를 찾는 중입니다...'));
    socket.on('disconnect', () => setStatusMessage('연결이 종료되었습니다. 새로고침 후 다시 시도해 주세요.'));
    return () => { socket.emit('queue:leave'); socket.disconnect(); };
  }, []);

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!socketRef.current || !roomId || !input.trim()) return;
    socketRef.current.emit('message:send', { roomId, content: input.trim() });
    setInput('');
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    socketRef.current.emit('typing', { isTyping: false });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    if (!socketRef.current || !roomId) return;
    socketRef.current.emit('typing', { isTyping: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { socketRef.current?.emit('typing', { isTyping: false }); }, 800);
  };

  const handleFindNext = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('session:end');
    socketRef.current.emit('queue:join');
    setStatusMessage('다음 상대를 찾는 중입니다...');
    setMessages([]);
    setPartnerNickname('');
    setRoomId(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8">
      <div className="rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-dark">랜덤 채팅</h1>
            <p className="text-sm text-gray-600" role="status" aria-live="polite">{statusMessage}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
            {session && <span>내 닉네임: {session.nickname}</span>}
            {isMatched && <span>상대 닉네임: {partnerNickname}</span>}
          </div>
        </div>
        <div className="mt-6 flex h-[60vh] flex-col gap-4">
          <div className="flex-1 overflow-y-auto rounded-2xl bg-indigo-50/60 p-4" role="log" aria-live="polite">
            {messages.length === 0 && (<p className="text-center text-sm text-gray-500">대화를 시작해 보세요!</p>)}
            <div className="flex flex-col gap-4">
              {messages.map((m) => (
                <ChatBubble key={m.id} isOwn={m.senderId === session?.sessionId} nickname={m.nickname} message={m.content} timestamp={m.createdAt} />
              ))}
            </div>
          </div>
          {isPartnerTyping && partnerNickname && <TypingIndicator nickname={partnerNickname} />}
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleSendMessage}>
            <label className="sr-only" htmlFor="message">메시지 입력</label>
            <input id="message" type="text" value={input} onChange={handleInputChange} placeholder={isMatched ? '메시지를 입력하세요.' : '매칭 후 메시지를 보낼 수 있습니다.'} disabled={!isMatched} className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm shadow-sm disabled:bg-gray-100" />
            <button type="submit" disabled={!isMatched || !input.trim()} className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:bg-gray-300">전송</button>
          </form>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={handleFindNext} className="rounded-full border border-primary px-4 py-2 font-semibold text-primary transition hover:bg-primary hover:text-white">다음 찾기</button>
          </div>
          <div className="pt-2"><AdBanner /></div>
        </div>
      </div>
    </div>
  );
}

'use client'
import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { ChatBubble } from '../../components/ChatBubble';
import { TypingIndicator } from '../../components/TypingIndicator';

const socket = io();

export default function ChatPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    socket.on('message:new', (msg) => {
      setMessages((prev) => [...prev, msg]);
    });
    socket.on('typing', ({ isTyping }) => {
      setTyping(isTyping);
    });
    return () => {
      socket.off('message:new');
      socket.off('typing');
    };
  }, []);

  const sendMessage = () => {
    if (input.trim()) {
      socket.emit('message:send', { roomId: 'default', content: input });
      setInput('');
    }
  };

  return (
    <div className="p-4">
      <div className="border rounded p-2 h-96 overflow-y-auto mb-4">
        {messages.map((msg, i) => (
          <ChatBubble key={i} nickname={msg.nickname} content={msg.content} />
        ))}
        {typing && <TypingIndicator />}
      </div>
      <div className="flex">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            socket.emit('typing', { isTyping: e.target.value.length > 0 });
          }}
          className="border flex-1 rounded px-2"
        />
        <button onClick={sendMessage} className="ml-2 bg-blue-500 text-white px-4 py-2 rounded">
          보내기
        </button>
      </div>
    </div>
  );
}
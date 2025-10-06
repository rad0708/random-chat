import React, { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io(import.meta.env.VITE_SERVER_URL);

export default function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    socket.on("matched", () => setConnected(true));
    socket.on("message", (msg) => setMessages((prev) => [...prev, { from: "partner", text: msg }]));
    socket.on("partner-disconnected", () => {
      setConnected(false);
      setMessages([]);
    });
  }, []);

  const sendMessage = () => {
    if (input.trim()) {
      socket.emit("message", input);
      setMessages((prev) => [...prev, { from: "me", text: input }]);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      {!connected ? (
        <button
          onClick={() => socket.emit("next")}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          채팅 시작하기
        </button>
      ) : (
        <div className="w-full max-w-md bg-white p-4 rounded shadow">
          <div className="h-80 overflow-y-auto border mb-2 p-2">
            {messages.map((msg, i) => (
              <div key={i} className={msg.from === "me" ? "text-right" : "text-left"}>
                <span className="inline-block px-2 py-1 m-1 rounded bg-gray-200">
                  {msg.text}
                </span>
              </div>
            ))}
          </div>
          <div className="flex">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 border px-2 py-1"
            />
            <button onClick={sendMessage} className="px-4 bg-green-500 text-white">
              전송
            </button>
          </div>
          <div className="flex justify-between mt-2">
            <button
              onClick={() => socket.emit("next")}
              className="px-4 py-1 bg-yellow-500 text-white rounded"
            >
              NEXT
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1 bg-red-500 text-white rounded"
            >
              EXIT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";

export interface ChatMessage {
  from_user_id: number;
  to_user_id: number;
  message: string;
  from_username: string;
  is_auto_reply?: boolean;
}

interface Props {
  targetUserId: number;
  targetUsername: string;
  myUserId: number;
  messages: ChatMessage[];
  onSend: (message: string) => void;
  onClose: () => void;
}

export default function ChatPanel({
  targetUsername,
  myUserId,
  messages,
  onSend,
  onClose,
}: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className="pixel-panel flex flex-col w-80 h-96">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-600">
        <span className="text-sm font-bold">Chat with {targetUsername}</span>
        <button onClick={onClose} className="text-red-400 hover:text-red-300 text-xs">
          [X]
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 mb-2 pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-gray-500 text-center mt-8">No messages yet. Say hi!</p>
        )}
        {messages.map((m, i) => {
          const isMe = m.from_user_id === myUserId;
          return (
            <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              <span className="text-[10px] text-gray-400 mb-0.5">
                {m.from_username}
                {m.is_auto_reply ? " [Auto]" : ""}
              </span>
              <div
                className={`px-2 py-1 rounded text-xs max-w-[80%] ${
                  isMe
                    ? "bg-blue-700 text-white"
                    : m.is_auto_reply
                    ? "bg-yellow-800 text-yellow-100"
                    : "bg-gray-700 text-gray-100"
                }`}
              >
                {m.message}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex gap-1">
        <input
          className="pixel-input flex-1 text-xs"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
        />
        <button className="pixel-btn text-xs" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

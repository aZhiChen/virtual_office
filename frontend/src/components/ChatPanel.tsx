"use client";

import { useState, useRef, useEffect } from "react";
import {
  EMOJI_LIST,
  getEmojiUrl,
  formatEmojiMessage,
  parseMixedMessage,
} from "@/lib/emoji";

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
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
}

export default function ChatPanel({
  targetUsername,
  myUserId,
  messages,
  onSend,
  onClose,
  onHeaderPointerDown,
}: Props) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  const extractInputContent = (): string => {
    const el = inputRef.current;
    if (!el) return "";
    const parts: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || "");
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const elem = node as HTMLElement;
        if (elem.tagName === "IMG" && elem.dataset.emoji) {
          parts.push(formatEmojiMessage(elem.dataset.emoji));
        } else {
          node.childNodes.forEach(walk);
        }
      }
    };
    el.childNodes.forEach(walk);
    return parts.join("");
  };

  const clearInput = () => {
    const el = inputRef.current;
    if (el) {
      el.innerHTML = "";
      el.focus();
    }
  };

  const handleSend = () => {
    const text = extractInputContent().trim();
    if (!text) return;
    onSend(text);
    clearInput();
  };

  const insertEmoji = (filename: string) => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const img = document.createElement("img");
    img.src = getEmojiUrl(filename);
    img.alt = filename;
    img.dataset.emoji = filename;
    img.className = "h-5 w-auto object-contain inline-block align-middle";
    img.contentEditable = "false";

    const sel = window.getSelection();
    const range = document.createRange();

    if (sel && sel.rangeCount > 0) {
      const selRange = sel.getRangeAt(0);
      if (el.contains(selRange.commonAncestorContainer)) {
        try {
          range.setStart(selRange.startContainer, selRange.startOffset);
          range.collapse(true);
          range.insertNode(img);
          range.setStartAfter(img);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          return;
        } catch {
          /* fallback to append */
        }
      }
    }
    el.appendChild(img);
    range.setStartAfter(img);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const renderMessageContent = (message: string) => {
    const segments = parseMixedMessage(message);
    return segments.map((seg, i) =>
      seg.type === "text" ? (
        <span key={i}>{seg.value}</span>
      ) : (
        <img
          key={i}
          src={getEmojiUrl(seg.filename)}
          alt="emoji"
          className="h-5 w-auto object-contain inline-block align-middle"
        />
      )
    );
  };

  return (
    <div className="pixel-panel flex flex-col w-80 h-96">
      {/* Header - drag handle when onHeaderPointerDown provided */}
      <div
        className={`flex items-center justify-between mb-2 pb-2 border-b border-gray-600 ${onHeaderPointerDown ? "cursor-grab active:cursor-grabbing touch-none select-none" : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        <span className="text-sm font-bold">Chat with {targetUsername}</span>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-red-400 hover:text-red-300 text-xs"
        >
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
                {renderMessageContent(m.message)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="flex gap-1 items-center relative" ref={emojiPickerRef}>
        <button
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          className="pixel-btn text-xs shrink-0 w-9 h-9 flex items-center justify-center p-0"
          title="Emoji"
          aria-label="Choose emoji"
        >
          <span className="text-base">😀</span>
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 mb-1 pixel-panel p-2 max-h-40 overflow-y-auto z-50">
            <p className="text-[10px] text-gray-400 mb-1">Click to insert</p>
            <div className="grid grid-cols-4 gap-1">
              {EMOJI_LIST.map((filename) => (
                <button
                  key={filename}
                  type="button"
                  onClick={() => insertEmoji(filename)}
                  className="hover:bg-gray-600 rounded p-0.5 transition-colors"
                >
                  <img
                    src={getEmojiUrl(filename)}
                    alt={filename}
                    className="w-10 h-10 object-contain"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
        <div
          ref={inputRef}
          contentEditable
          className="pixel-input flex-1 text-xs min-h-[36px] overflow-y-auto"
          data-placeholder="Type a message"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          suppressContentEditableWarning
        />
        <button className="pixel-btn text-xs" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

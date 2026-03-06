"use client";

import { useState, useRef, useEffect } from "react";
import {
  EMOJI_LIST,
  getEmojiUrl,
  formatEmojiMessage,
  getMixedContentLength,
  parseMixedMessage,
} from "@/lib/emoji";

interface Props {
  currentStatus: string;
  onSave: (status: string) => void;
  onClose: () => void;
  onHeaderPointerDown?: (e: React.PointerEvent) => void;
}

export default function StatusSetter({ currentStatus, onSave, onClose, onHeaderPointerDown }: Props) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [inputVersion, setInputVersion] = useState(0);
  const inputRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current && !inputRef.current.textContent) {
      // Initialize with current status
      const segments = parseMixedMessage(currentStatus);
      inputRef.current.innerHTML = "";
      segments.forEach((seg) => {
        if (seg.type === "text") {
          inputRef.current!.appendChild(document.createTextNode(seg.value));
        } else {
          const img = document.createElement("img");
          img.src = getEmojiUrl(seg.filename);
          img.alt = seg.filename;
          img.dataset.emoji = seg.filename;
          img.className = "h-5 w-auto object-contain inline-block align-middle";
          img.contentEditable = "false";
          inputRef.current!.appendChild(img);
        }
      });
      setInputVersion((v) => v + 1);
    }
  }, [currentStatus]);

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

  const extractContent = (): string => {
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

  const content = extractContent();
  const displayLen = getMixedContentLength(content);
  const canSave = displayLen <= 15;

  const insertEmoji = (filename: string) => {
    const el = inputRef.current;
    if (!el || displayLen >= 15) return;
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
          /* fallback */
        }
      }
    }
    el.appendChild(img);
    range.setStartAfter(img);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  const handleInput = () => {
    setInputVersion((v) => v + 1);
  };

  const handleSave = async () => {
    const raw = extractContent().trim();
    if (getMixedContentLength(raw) > 15) return;
    await onSave(raw);
    onClose();
  };

  const handleClear = () => {
    if (inputRef.current) {
      inputRef.current.innerHTML = "";
      inputRef.current.focus();
      setInputVersion((v) => v + 1);
    }
  };

  return (
    <div className="pixel-panel flex flex-col w-80">
      <div
        className={`flex items-center justify-between mb-2 pb-2 border-b border-gray-600 ${onHeaderPointerDown ? "cursor-grab active:cursor-grabbing touch-none select-none" : ""}`}
        onPointerDown={onHeaderPointerDown}
      >
        <span className="text-sm font-bold">设置人物状态</span>
        <button
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          [X]
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mb-2">
        可使用表情包或文字，总长度不超过15字
      </p>
      <div className="flex gap-1 items-center relative mb-2" ref={emojiPickerRef}>
        <button
          type="button"
          onClick={() => setShowEmojiPicker((v) => !v)}
          className="pixel-btn text-xs shrink-0 w-9 h-9 flex items-center justify-center p-0"
          title="选择表情"
        >
          <span className="text-base">😀</span>
        </button>
        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 mb-1 pixel-panel p-2 max-h-40 overflow-y-auto z-50">
            <p className="text-[10px] text-gray-400 mb-1">点击插入</p>
            <div className="grid grid-cols-4 gap-1">
              {EMOJI_LIST.map((filename) => (
                <button
                  key={filename}
                  type="button"
                  onClick={() => insertEmoji(filename)}
                  disabled={displayLen >= 15}
                  className="hover:bg-gray-600 rounded p-0.5 transition-colors disabled:opacity-50"
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
          data-placeholder="输入状态文字..."
          onInput={handleInput}
          suppressContentEditableWarning
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] ${displayLen > 15 ? "text-red-400" : "text-gray-400"}`}
        >
          {displayLen}/15
        </span>
        <div className="flex gap-2">
          <button className="pixel-btn text-xs" onClick={handleClear}>
            清空
          </button>
          <button
            className="pixel-btn text-xs !bg-[var(--pixel-accent)]"
            onClick={handleSave}
            disabled={!canSave}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

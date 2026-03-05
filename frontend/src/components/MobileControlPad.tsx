"use client";

import { useState, useEffect } from "react";

const KEY_CODES = {
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  Space: 32,
} as const;

function dispatchKey(key: keyof typeof KEY_CODES, type: "keydown" | "keyup") {
  const keyCode = KEY_CODES[key];
  const keyName = key === "Space" ? " " : key;
  const event = new KeyboardEvent(type, {
    key: keyName,
    code: key,
    keyCode,
    which: keyCode,
    bubbles: true,
  });
  document.dispatchEvent(event);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const hasTouch = "ontouchstart" in window;
      const narrowScreen = window.innerWidth <= 768;
      setIsMobile(hasTouch && narrowScreen);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
}

export default function MobileControlPad() {
  const isMobile = useIsMobile();
  const [pressed, setPressed] = useState<Set<string>>(new Set());

  const handlePointerDown = (key: keyof typeof KEY_CODES) => (e: React.PointerEvent) => {
    e.preventDefault();
    setPressed((prev) => new Set(prev).add(key));
    dispatchKey(key, "keydown");
  };

  const handlePointerUp = (key: keyof typeof KEY_CODES) => (e: React.PointerEvent) => {
    e.preventDefault();
    setPressed((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    dispatchKey(key, "keyup");
  };

  const handlePointerLeave = (key: keyof typeof KEY_CODES) => () => {
    if (pressed.has(key)) {
      setPressed((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      dispatchKey(key, "keyup");
    }
  };

  if (!isMobile) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-30 flex items-end justify-between pointer-events-none touch-none"
      style={{ touchAction: "none" }}
    >
      {/* D-pad */}
      <div
        className="pointer-events-auto flex flex-col items-center gap-1 select-none"
        style={{ touchAction: "none" }}
      >
        <button
          onPointerDown={handlePointerDown("ArrowUp")}
          onPointerUp={handlePointerUp("ArrowUp")}
          onPointerLeave={handlePointerLeave("ArrowUp")}
          onPointerCancel={handlePointerLeave("ArrowUp")}
          className={`pixel-btn w-12 h-12 flex items-center justify-center text-lg font-bold ${
            pressed.has("ArrowUp") ? "!bg-[var(--pixel-accent)]" : ""
          }`}
          style={{ touchAction: "none" }}
          aria-label="Up"
        >
          ▲
        </button>
        <div className="flex gap-1">
          <button
            onPointerDown={handlePointerDown("ArrowLeft")}
            onPointerUp={handlePointerUp("ArrowLeft")}
            onPointerLeave={handlePointerLeave("ArrowLeft")}
            onPointerCancel={handlePointerLeave("ArrowLeft")}
            className={`pixel-btn w-12 h-12 flex items-center justify-center text-lg font-bold ${
              pressed.has("ArrowLeft") ? "!bg-[var(--pixel-accent)]" : ""
            }`}
            style={{ touchAction: "none" }}
            aria-label="Left"
          >
            ◀
          </button>
          <div className="w-12 h-12" />
          <button
            onPointerDown={handlePointerDown("ArrowRight")}
            onPointerUp={handlePointerUp("ArrowRight")}
            onPointerLeave={handlePointerLeave("ArrowRight")}
            onPointerCancel={handlePointerLeave("ArrowRight")}
            className={`pixel-btn w-12 h-12 flex items-center justify-center text-lg font-bold ${
              pressed.has("ArrowRight") ? "!bg-[var(--pixel-accent)]" : ""
            }`}
            style={{ touchAction: "none" }}
            aria-label="Right"
          >
            ▶
          </button>
        </div>
        <button
          onPointerDown={handlePointerDown("ArrowDown")}
          onPointerUp={handlePointerUp("ArrowDown")}
          onPointerLeave={handlePointerLeave("ArrowDown")}
          onPointerCancel={handlePointerLeave("ArrowDown")}
          className={`pixel-btn w-12 h-12 flex items-center justify-center text-lg font-bold ${
            pressed.has("ArrowDown") ? "!bg-[var(--pixel-accent)]" : ""
          }`}
          style={{ touchAction: "none" }}
          aria-label="Down"
        >
          ▼
        </button>
      </div>

      {/* Space key */}
      <button
        onPointerDown={handlePointerDown("Space")}
        onPointerUp={handlePointerUp("Space")}
        onPointerLeave={handlePointerLeave("Space")}
        onPointerCancel={handlePointerLeave("Space")}
        className={`pointer-events-auto pixel-btn px-6 py-4 text-sm font-bold ${
          pressed.has("Space") ? "!bg-green-700" : ""
        }`}
        style={{ touchAction: "none" }}
        aria-label="Space - 交互"
      >
        空格
      </button>
    </div>
  );
}

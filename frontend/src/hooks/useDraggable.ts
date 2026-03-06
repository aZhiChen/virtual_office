"use client";

import { useState, useRef, useCallback } from "react";

/** Returns delta from drag start. Apply with transform: translate(delta.x, delta.y). movedRef is set true when user dragged (use to skip click) */
export function useDraggable() {
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const startRef = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const movedRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    movedRef.current = false;
    if (e.button !== 0 && e.button !== undefined) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    startRef.current = {
      x: delta.x,
      y: delta.y,
      clientX: e.clientX,
      clientY: e.clientY,
    };

    const onMove = (ev: PointerEvent) => {
      if (!startRef.current) return;
      movedRef.current = true;
      setDelta({
        x: startRef.current.x + ev.clientX - startRef.current.clientX,
        y: startRef.current.y + ev.clientY - startRef.current.clientY,
      });
    };
    const onUp = () => {
      startRef.current = null;
      el.releasePointerCapture?.(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [delta.x, delta.y]);

  return { delta, handlePointerDown, movedRef };
}

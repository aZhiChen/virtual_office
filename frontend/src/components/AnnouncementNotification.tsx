"use client";

import { useEffect, useState } from "react";

export interface AnnouncementNotificationData {
  id: string;
  text: string;
}

interface Props {
  notification: AnnouncementNotificationData | null;
  onClose: () => void;
  onClick: () => void;
}

export default function AnnouncementNotification({ notification, onClose, onClick }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!notification) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 3000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  return (
    <div
      className={`fixed bottom-24 right-6 z-50 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div
        onClick={onClick}
        className="pixel-panel cursor-pointer hover:scale-105 transition-transform bg-indigo-900 border-indigo-600 shadow-xl max-w-xs"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">📢</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-indigo-100 mb-1">新公告</div>
            <div className="text-xs text-indigo-200 leading-relaxed">{notification.text}</div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setVisible(false);
              setTimeout(onClose, 300);
            }}
            className="flex-shrink-0 text-indigo-400 hover:text-indigo-200 text-xs ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

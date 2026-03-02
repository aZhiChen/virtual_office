"use client";

import { useEffect, useState } from "react";

export interface Notification {
  id: string;
  fromUserId: number;
  fromUsername: string;
}

interface Props {
  notification: Notification | null;
  onClose: () => void;
  onClick: (userId: number) => void;
}

export default function MessageNotification({ notification, onClose, onClick }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for fade-out animation
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const handleClick = () => {
    onClick(notification.fromUserId);
    setVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <div
        onClick={handleClick}
        className="pixel-panel cursor-pointer hover:scale-105 transition-transform bg-yellow-900 border-yellow-600 shadow-xl max-w-xs"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-2xl">💬</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-yellow-100 mb-1">
              {notification.fromUsername} 有事找你
            </div>
            <div className="text-xs text-yellow-200 leading-relaxed">
              谨记：要转账是诈骗！
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setVisible(false);
              setTimeout(onClose, 300);
            }}
            className="flex-shrink-0 text-yellow-400 hover:text-yellow-200 text-xs ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

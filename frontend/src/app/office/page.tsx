"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { getWSClient, destroyWSClient } from "@/lib/ws";
import ChatPanel, { ChatMessage } from "@/components/ChatPanel";
import ControlToggle from "@/components/ControlToggle";
import MessageNotification, { Notification } from "@/components/MessageNotification";

// Dynamically import PhaserGame so it only loads client-side
const PhaserGame = dynamic(() => import("@/components/PhaserGame"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-400">
      Loading game engine...
    </div>
  ),
});

interface UserProfile {
  id: number;
  username: string;
  display_name: string;
  avatar_config: Record<string, number>;
  has_pet: boolean;
  pet_type: string;
  personality: string;
  is_afk: boolean;
}

export default function OfficePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [controlTarget, setControlTarget] = useState<"character" | "pet">("character");
  const [isAfk, setIsAfk] = useState(false);
  const [isSitting, setIsSitting] = useState(false);
  const [nearbyDesks, setNearbyDesks] = useState<number[]>([]);
  const [nearbyUsers, setNearbyUsers] = useState<number[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const [chatTarget, setChatTarget] = useState<{ id: number; name: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatHistoryCache, setChatHistoryCache] = useState<Record<number, ChatMessage[]>>({});
  const [notification, setNotification] = useState<Notification | null>(null);
  const wsRef = useRef<ReturnType<typeof getWSClient> | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  const chatTargetRef = useRef<{ id: number; name: string } | null>(null);
  const onlineUsersRef = useRef<Record<string, any>>({});
  const presenceSnapshotRef = useRef<{ users: Record<string, any>; desks?: Record<string, number>; animals?: any[] }>({ users: {} });

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    chatTargetRef.current = chatTarget;
  }, [chatTarget]);

  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  // Load profile
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    api
      .getProfile()
      .then((p) => {
        setProfile(p as UserProfile);
        setIsAfk(p.is_afk);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  // WebSocket connection
  useEffect(() => {
    if (!profile) return;
    const token = localStorage.getItem("token")!;
    const ws = getWSClient(token);
    wsRef.current = ws;

    ws.on("presence_snapshot", (data: any) => {
      presenceSnapshotRef.current = { users: data.users || {}, desks: data.desks, animals: data.animals };
      setOnlineUsers(data.users || {});
      // Trigger check to see if game is ready and dispatch if so
      window.dispatchEvent(new CustomEvent("presence:check"));
    });

    ws.on("user_joined", (data: any) => {
      setOnlineUsers((prev) => ({
        ...prev,
        [data.user_id]: { profile: data.profile, position: data.position, pet_position: data.pet_position },
      }));
      window.dispatchEvent(new CustomEvent("react:user_joined", { detail: data }));
    });

    ws.on("user_left", (data: any) => {
      setOnlineUsers((prev) => {
        const copy = { ...prev };
        delete copy[data.user_id];
        return copy;
      });
      window.dispatchEvent(new CustomEvent("react:user_left", { detail: data }));
    });

    ws.on("entity_moved", (data: any) => {
      window.dispatchEvent(new CustomEvent("react:entity_moved", { detail: data }));
    });

    ws.on("chat_message", (data: ChatMessage) => {
      console.log("📨 Received chat_message:", data);
      setChatMessages((prev) => {
        const updated = [...prev, data];
        console.log("💬 Updated chatMessages:", updated);
        return updated;
      });
      
      // Show notification if message is for current user and chat window is not open
      const currentProfile = profileRef.current;
      const currentChatTarget = chatTargetRef.current;
      
      if (currentProfile && data.to_user_id === currentProfile.id && data.from_user_id !== currentProfile.id) {
        // Only show notification if chat with sender is not currently open
        if (!currentChatTarget || currentChatTarget.id !== data.from_user_id) {
          console.log("🔔 Showing notification for message from:", data.from_username);
          setNotification({
            id: `${data.from_user_id}-${Date.now()}`,
            fromUserId: data.from_user_id,
            fromUsername: data.from_username,
          });
        }
      }
    });

    ws.on("device_occupied", (data: any) => {
      window.dispatchEvent(new CustomEvent("react:device_occupied", { detail: data }));
    });

    ws.on("afk_changed", (data: any) => {
      const { user_id, is_afk } = data;
      setOnlineUsers((prev) => {
        const key = String(user_id);
        if (!(key in prev)) return prev;
        return {
          ...prev,
          [key]: {
            ...prev[key],
            profile: { ...prev[key].profile, is_afk },
          },
        };
      });
      window.dispatchEvent(new CustomEvent("react:afk_changed", { detail: data }));
    });

    ws.on("office_animals", (data: any) => {
      window.dispatchEvent(new CustomEvent("react:office_animals", { detail: data }));
    });

    ws.on("seat_state", (data: any) => {
      // Handle sitting state updates from server
      if (data.user_id === profile.id && data.action === "sit") {
        setIsSitting(true);
        // For desk type, trigger local rendering
        if (data.seat_type === "desk") {
          window.dispatchEvent(new CustomEvent("react:sit_at_desk", { detail: { desk_id: data.seat_id } }));
        }
      }
      if (data.user_id === profile.id && data.action === "stand") {
        setIsSitting(false);
        window.dispatchEvent(new CustomEvent("react:stand_up"));
      }
      window.dispatchEvent(new CustomEvent("react:seat_state", { detail: data }));
    });

    ws.connect();

    return () => {
      destroyWSClient();
    };
  }, [profile]);

  // When game scene is ready, send presence snapshot (users + animals) so it can show everyone
  useEffect(() => {
    let gameReady = false;
    const onGameReady = () => {
      gameReady = true;
      const snap = presenceSnapshotRef.current;
      if (Object.keys(snap.users).length > 0) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("react:presence_snapshot", { detail: snap }),
          );
        }, 0);
      }
    };
    window.addEventListener("game:ready", onGameReady);
    
    // If presence_snapshot arrives after game:ready, dispatch it immediately
    const checkAndDispatch = () => {
      if (gameReady) {
        const snap = presenceSnapshotRef.current;
        if (Object.keys(snap.users).length > 0) {
          window.dispatchEvent(
            new CustomEvent("react:presence_snapshot", { detail: snap }),
          );
        }
      }
    };
    window.addEventListener("presence:check", checkAndDispatch);
    
    return () => {
      window.removeEventListener("game:ready", onGameReady);
      window.removeEventListener("presence:check", checkAndDispatch);
    };
  }, []);

  // Game event listeners
  useEffect(() => {
    const handlePlayerMoved = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      wsRef.current?.send({
        type: "move",
        x: detail.x,
        y: detail.y,
        target: detail.target || "character",
      });
    };

    const handleNearbyDesks = (e: Event) => {
      setNearbyDesks((e as CustomEvent).detail);
    };

    const handleNearbyUsers = (e: Event) => {
      setNearbyUsers((e as CustomEvent).detail);
    };

    const handleSeat = (e: Event) => {
      const { seat_type, seat_id } = (e as CustomEvent).detail;
      if (seat_type === "meeting_chair") wsRef.current?.send({ type: "sit_meeting_chair", chair_id: seat_id });
      else if (seat_type === "dining_chair") wsRef.current?.send({ type: "sit_dining_chair", index: seat_id });
      else if (seat_type === "treadmill") wsRef.current?.send({ type: "on_treadmill", index: seat_id });
    };

    const handleGameStandUp = () => {
      wsRef.current?.send({ type: "stand_up" });
      window.dispatchEvent(new CustomEvent("react:stand_up"));
      setIsSitting(false);
    };

    const handleSitAtDesk = (e: Event) => {
      const { desk_id } = (e as CustomEvent).detail;
      wsRef.current?.send({ type: "sit_at_desk", desk_id });
    };

    window.addEventListener("game:player_moved", handlePlayerMoved);
    window.addEventListener("game:nearby_desks", handleNearbyDesks);
    window.addEventListener("game:nearby_users", handleNearbyUsers);
    window.addEventListener("game:seat", handleSeat);
    window.addEventListener("game:stand_up", handleGameStandUp);
    window.addEventListener("game:sit_at_desk", handleSitAtDesk);

    return () => {
      window.removeEventListener("game:player_moved", handlePlayerMoved);
      window.removeEventListener("game:nearby_desks", handleNearbyDesks);
      window.removeEventListener("game:nearby_users", handleNearbyUsers);
      window.removeEventListener("game:seat", handleSeat);
      window.removeEventListener("game:stand_up", handleGameStandUp);
      window.removeEventListener("game:sit_at_desk", handleSitAtDesk);
    };
  }, []);

  // ---- actions ----

  const toggleControl = useCallback(() => {
    const next = controlTarget === "character" ? "pet" : "character";
    setControlTarget(next);
    window.dispatchEvent(new CustomEvent("react:control_target", { detail: next }));
  }, [controlTarget]);

  const toggleAfk = useCallback(() => {
    const next = !isAfk;
    setIsAfk(next);
    wsRef.current?.send({ type: "set_afk", is_afk: next });
    api.updateAfk(next).catch(() => {});
  }, [isAfk]);

  const sitAtDesk = useCallback((deskId: number) => {
    wsRef.current?.send({ type: "sit_at_desk", desk_id: deskId });
    // Wait for desk_state from server before updating UI (avoids flash when desk is occupied)
  }, []);

  const standUp = useCallback(() => {
    wsRef.current?.send({ type: "stand_up" });
    window.dispatchEvent(new CustomEvent("react:stand_up"));
    setIsSitting(false);
  }, []);

  const openChat = useCallback(
    (userId: number) => {
      const u = onlineUsers[userId];
      const name = u?.profile?.display_name || u?.profile?.username || `User ${userId}`;
      setChatTarget({ id: userId, name });
      api.getChatHistory(userId).then((history: ChatMessage[]) => {
        setChatHistoryCache((prev) => ({ ...prev, [userId]: history }));
      }).catch(() => {
        setChatHistoryCache((prev) => ({ ...prev, [userId]: [] }));
      });
    },
    [onlineUsers]
  );

  const sendChat = useCallback(
    (message: string) => {
      if (!chatTarget) return;
      wsRef.current?.send({
        type: "chat_send",
        to_user_id: chatTarget.id,
        message,
      });
    },
    [chatTarget]
  );

  // ---- render ----

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Entering office...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--pixel-surface)] border-b border-gray-700">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold">{profile.display_name}</span>
          <span className="text-xs text-green-400">Online</span>
          <span className="text-xs text-gray-500">
            | {Object.keys(onlineUsers).length + 1} online
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ControlToggle
            controlTarget={controlTarget}
            hasPet={profile.has_pet}
            isAfk={isAfk}
            isSitting={isSitting}
            onToggleControl={toggleControl}
            onToggleAfk={toggleAfk}
            onStandUp={standUp}
          />
          <button
            className="pixel-btn text-xs"
            onClick={() => router.push("/customize/personality")}
          >
            Edit Personality
          </button>
          <button
            className="pixel-btn text-xs"
            onClick={() => router.push("/customize")}
          >
            Edit Avatar
          </button>
          <button
            className="pixel-btn text-xs !bg-red-900"
            onClick={() => {
              localStorage.clear();
              router.push("/login");
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 relative overflow-hidden">
        <PhaserGame playerConfig={profile} />

        {/* Floating action buttons */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-10">
          {/* Desk actions */}
          {nearbyDesks.length > 0 &&
            !isSitting &&
            nearbyDesks.map((deskId) => (
              <button
                key={`desk-${deskId}`}
                className="pixel-btn text-xs"
                onClick={() => sitAtDesk(deskId)}
              >
                Sit at Desk #{deskId}
              </button>
            ))}

          {/* Chat with nearby users */}
          {nearbyUsers.map((uid) => {
            const u = onlineUsers[uid];
            const name = u?.profile?.display_name || `User ${uid}`;
            return (
              <button
                key={`chat-${uid}`}
                className="pixel-btn text-xs"
                onClick={() => openChat(uid)}
              >
                Chat with {name}
                {u?.profile?.is_afk ? " [AFK]" : ""}
              </button>
            );
          })}
        </div>

        {/* Chat panel */}
        {chatTarget && (
          <div className="absolute top-4 right-4 z-20">
            <ChatPanel
              targetUserId={chatTarget.id}
              targetUsername={chatTarget.name}
              myUserId={profile.id}
              messages={(() => {
                const history = chatHistoryCache[chatTarget.id] ?? [];
                const live = chatMessages.filter(
                  (m) =>
                    (m.from_user_id === chatTarget.id && m.to_user_id === profile.id) ||
                    (m.from_user_id === profile.id && m.to_user_id === chatTarget.id)
                );
                const seen = new Set(
                  history.map((m) => `${m.from_user_id}-${m.to_user_id}-${m.message}`)
                );
                const newFromLive = live.filter(
                  (m) => !seen.has(`${m.from_user_id}-${m.to_user_id}-${m.message}`)
                );
                return [...history, ...newFromLive];
              })()}
              onSend={sendChat}
              onClose={() => setChatTarget(null)}
            />
          </div>
        )}

        {/* Message notification */}
        <MessageNotification
          notification={notification}
          onClose={() => setNotification(null)}
          onClick={(userId) => {
            openChat(userId);
            setNotification(null);
          }}
        />

        {/* Online users sidebar */}
        <div className="absolute top-4 left-4 z-10">
          <div className="pixel-panel text-xs opacity-80 max-h-48 overflow-y-auto">
            <p className="font-bold mb-1">Online ({Object.keys(onlineUsers).length + 1})</p>
            <p className="text-green-400">
              {profile.display_name} (you){isAfk ? " [AFK]" : ""}
            </p>
            {Object.entries(onlineUsers).map(([uid, u]: [string, any]) => (
              <p key={uid} className={u.profile?.is_afk ? "text-yellow-400" : "text-gray-300"}>
                {u.profile?.display_name || `User ${uid}`}
                {u.profile?.is_afk ? " [AFK]" : ""}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

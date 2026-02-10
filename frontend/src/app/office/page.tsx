"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { getWSClient, destroyWSClient } from "@/lib/ws";
import ChatPanel, { ChatMessage } from "@/components/ChatPanel";
import ControlToggle from "@/components/ControlToggle";

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
  const wsRef = useRef<ReturnType<typeof getWSClient> | null>(null);

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
      setOnlineUsers(data.users || {});
      window.dispatchEvent(new CustomEvent("react:presence_snapshot", { detail: data }));
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
      setChatMessages((prev) => [...prev, data]);
    });

    ws.on("desk_state", (data: any) => {
      if (data.user_id === profile.id && data.action === "sit") {
        setIsSitting(true);
      }
    });

    ws.on("afk_changed", (data: any) => {
      window.dispatchEvent(new CustomEvent("react:afk_changed", { detail: data }));
    });

    ws.connect();

    return () => {
      destroyWSClient();
    };
  }, [profile]);

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

    window.addEventListener("game:player_moved", handlePlayerMoved);
    window.addEventListener("game:nearby_desks", handleNearbyDesks);
    window.addEventListener("game:nearby_users", handleNearbyUsers);

    return () => {
      window.removeEventListener("game:player_moved", handlePlayerMoved);
      window.removeEventListener("game:nearby_desks", handleNearbyDesks);
      window.removeEventListener("game:nearby_users", handleNearbyUsers);
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

  const sitAtDesk = useCallback(
    (deskId: number) => {
      wsRef.current?.send({ type: "sit_at_desk", desk_id: deskId });
      window.dispatchEvent(new CustomEvent("react:sit_at_desk", { detail: { desk_id: deskId } }));
      setIsSitting(true);
    },
    []
  );

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
              messages={chatMessages.filter(
                (m) =>
                  (m.from_user_id === chatTarget.id && m.to_user_id === profile.id) ||
                  (m.from_user_id === profile.id && m.to_user_id === chatTarget.id)
              )}
              onSend={sendChat}
              onClose={() => setChatTarget(null)}
            />
          </div>
        )}

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

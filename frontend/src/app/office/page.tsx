"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import { getWSClient, destroyWSClient } from "@/lib/ws";
import ChatPanel, { ChatMessage } from "@/components/ChatPanel";
import ControlToggle from "@/components/ControlToggle";
import MessageNotification, { Notification } from "@/components/MessageNotification";
import NotePanel from "@/components/NotePanel";
import AnnouncementPanel from "@/components/AnnouncementPanel";
import AnnouncementNotification, {
  AnnouncementNotificationData,
} from "@/components/AnnouncementNotification";
import StatusSetter from "@/components/StatusSetter";
import EasterEggSetter from "@/components/EasterEggSetter";

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
  status?: string;
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
  const [showNote, setShowNote] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [showStatusSetter, setShowStatusSetter] = useState(false);
  const [showEasterEggSetter, setShowEasterEggSetter] = useState(false);
  const [easterEggPlantId, setEasterEggPlantId] = useState<number | null>(null);
  const [plantEggs, setPlantEggs] = useState<Record<number, { content: string; hider_user_id: number; hider_display_name: string }>>({});
  const [announcementNotification, setAnnouncementNotification] =
    useState<AnnouncementNotificationData | null>(null);
  const [unreadSystem, setUnreadSystem] = useState(0);
  const [unreadPersonal, setUnreadPersonal] = useState(0);
  const latestSystemRef = useRef<string | null>(null);
  const latestPersonalRef = useRef<string | null>(null);
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

  const openAnnouncementPanel = useCallback(() => {
    setShowAnnouncement(true);
    setAnnouncementNotification(null);
  }, []);

  const ANNOUNCEMENT_LAST_READ_KEY = "announcement_last_read";

  const fetchUnreadCount = useCallback(async () => {
    if (!profile) return;
    try {
      const lastSystem = localStorage.getItem(`${ANNOUNCEMENT_LAST_READ_KEY}_system_${profile.id}`);
      const lastPersonal = localStorage.getItem(`${ANNOUNCEMENT_LAST_READ_KEY}_personal_${profile.id}`);
      const res = (await api.getAnnouncementUnreadCount(
        lastSystem || undefined,
        lastPersonal || undefined
      )) as { system: number; personal: number };
      setUnreadSystem(res.system);
      setUnreadPersonal(res.personal);
    } catch {
      /* ignore */
    }
  }, [profile]);

  const markAnnouncementReadSystem = useCallback(
    (latestAt: string) => {
      if (!profile) return;
      localStorage.setItem(`${ANNOUNCEMENT_LAST_READ_KEY}_system_${profile.id}`, latestAt);
      fetchUnreadCount();
    },
    [profile, fetchUnreadCount]
  );

  const markAnnouncementReadPersonal = useCallback(
    (latestAt: string) => {
      if (!profile) return;
      localStorage.setItem(`${ANNOUNCEMENT_LAST_READ_KEY}_personal_${profile.id}`, latestAt);
      fetchUnreadCount();
    },
    [profile, fetchUnreadCount]
  );

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

    ws.on("status_changed", (data: any) => {
      const { user_id, status } = data;
      setOnlineUsers((prev) => {
        const key = String(user_id);
        if (!(key in prev)) return prev;
        return {
          ...prev,
          [key]: {
            ...prev[key],
            profile: { ...prev[key].profile, status: status || "" },
          },
        };
      });
      setProfile((prev) => {
        if (!prev || prev.id !== user_id) return prev;
        return { ...prev, status: status || "" };
      });
      window.dispatchEvent(new CustomEvent("react:status_changed", { detail: data }));
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

    ws.on("area_activity_notification", (data: any) => {
      setAnnouncementNotification({
        id: `area-activity-${Date.now()}`,
        text: data.text || "",
      });
    });

    ws.on("easter_egg_discovered", (data: any) => {
      window.dispatchEvent(
        new CustomEvent("react:easter_egg_discovered", {
          detail: {
            plant_id: data.plant_id,
            content: data.content,
            discoverer_name: data.discoverer_name,
          },
        })
      );
      setPlantEggs((prev) => {
        const next = { ...prev };
        delete next[data.plant_id];
        return next;
      });
      setAnnouncementNotification({
        id: `easter-egg-${Date.now()}`,
        text: data.announcement_text || "有人发现了彩蛋！",
      });
    });

    ws.on("easter_egg_hidden", (data: any) => {
      setPlantEggs((prev) => {
        const next = { ...prev };
        next[data.plant_id] = {
          content: data.content,
          hider_user_id: data.hider_user_id,
          hider_display_name: data.hider_display_name || `User${data.hider_user_id}`,
        };
        window.dispatchEvent(
          new CustomEvent("react:plant_eggs_update", { detail: { eggs: next } })
        );
        return next;
      });
    });

    ws.on("announcement_updated", (data: any) => {
      const currentProfile = profileRef.current;
      const actorUserId = Number(data.actor_user_id || 0);
      const isFromMe = !!currentProfile && actorUserId === currentProfile.id;
      window.dispatchEvent(new CustomEvent("announcement:refresh", { detail: data }));
      fetchUnreadCount();
      if (isFromMe) return;

      const action = data.action as string;
      // area_activity: 会议室/用餐区通知已由 area_activity_notification 展示，不重复 toast
      if (action === "area_activity") return;

      const text =
        action === "comment_created"
          ? "有同事发表了新评论"
          : action === "liked"
          ? "有同事点赞了公告"
          : action === "unliked"
          ? "有同事取消了点赞"
          : action === "post_deleted"
          ? "有同事删除了一条动态"
          : action === "system_generated"
          ? "收到新的系统鼓励消息"
          : "有同事发布了新动态";
      setAnnouncementNotification({
        id: `announcement-${Date.now()}`,
        text,
      });
    });

    ws.connect();

    return () => {
      destroyWSClient();
    };
  }, [profile, fetchUnreadCount]);

  useEffect(() => {
    if (!profile) return;
    let stopped = false;

    const checkAnnouncements = async (silent = false) => {
      try {
        const summary = (await api.getAnnouncementFeedSummary()) as {
          latest_system_created_at: string | null;
          latest_personal_created_at: string | null;
        };
        const firstRun = latestSystemRef.current === null && latestPersonalRef.current === null;
        const hasNewSystem =
          !!latestSystemRef.current &&
          !!summary.latest_system_created_at &&
          summary.latest_system_created_at !== latestSystemRef.current;
        const hasNewPersonal =
          !!latestPersonalRef.current &&
          !!summary.latest_personal_created_at &&
          summary.latest_personal_created_at !== latestPersonalRef.current;

        latestSystemRef.current = summary.latest_system_created_at;
        latestPersonalRef.current = summary.latest_personal_created_at;

        if (!silent && !firstRun && (hasNewSystem || hasNewPersonal)) {
          const text = hasNewSystem && hasNewPersonal
            ? "系统消息和同事动态都有更新"
            : hasNewSystem
            ? "收到新的系统鼓励消息"
            : "有同事发布了新动态";
          setAnnouncementNotification({
            id: `announcement-${Date.now()}`,
            text,
          });
        }
      } catch {
        /* ignore */
      }
    };

    checkAnnouncements(true);
    const timer = setInterval(() => {
      if (!stopped) checkAnnouncements(false);
    }, 20000);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [profile]);

  // Fetch unread count on load, on announcement_updated, and periodically
  useEffect(() => {
    if (!profile) return;
    fetchUnreadCount();
    const timer = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(timer);
  }, [profile, fetchUnreadCount]);

  // Initialize lastRead from summary on first load (so we don't show all as unread)
  useEffect(() => {
    if (!profile) return;
    const keySystem = `${ANNOUNCEMENT_LAST_READ_KEY}_system_${profile.id}`;
    const keyPersonal = `${ANNOUNCEMENT_LAST_READ_KEY}_personal_${profile.id}`;
    if (localStorage.getItem(keySystem) && localStorage.getItem(keyPersonal)) return;

    api.getAnnouncementFeedSummary().then((summary: { latest_system_created_at: string | null; latest_personal_created_at: string | null }) => {
      const now = new Date().toISOString();
      if (!localStorage.getItem(keySystem)) {
        localStorage.setItem(keySystem, summary.latest_system_created_at || now);
      }
      if (!localStorage.getItem(keyPersonal)) {
        localStorage.setItem(keyPersonal, summary.latest_personal_created_at || now);
      }
      fetchUnreadCount();
    }).catch(() => {});
  }, [profile, fetchUnreadCount]);

  useEffect(() => {
    const handleOpenAnnouncement = () => {
      openAnnouncementPanel();
    };
    window.addEventListener("game:open_announcement", handleOpenAnnouncement);
    return () => {
      window.removeEventListener("game:open_announcement", handleOpenAnnouncement);
    };
  }, [openAnnouncementPanel]);

  // Load plant easter eggs when profile is ready
  useEffect(() => {
    if (!profile) return;
    api.getPlantEasterEggs()
      .then((res: { eggs: Record<string, any> }) => {
        const eggs: Record<number, { content: string; hider_user_id: number; hider_display_name: string }> = {};
        Object.entries(res.eggs || {}).forEach(([k, v]) => {
          eggs[parseInt(k)] = {
            content: v.content,
            hider_user_id: v.hider_user_id,
            hider_display_name: v.hider_display_name,
          };
        });
        setPlantEggs(eggs);
        window.dispatchEvent(
          new CustomEvent("react:plant_eggs_update", { detail: { eggs } })
        );
      })
      .catch(() => {});
  }, [profile]);

  // When game scene is ready, send presence snapshot and plant eggs
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
      // Sync plant eggs to game (fetch fresh in case game mounted before eggs loaded)
      api.getPlantEasterEggs()
        .then((res: { eggs: Record<string, any> }) => {
          const eggs: Record<number, { content: string; hider_user_id: number; hider_display_name: string }> = {};
          Object.entries(res.eggs || {}).forEach(([k, v]) => {
            eggs[parseInt(k)] = {
              content: v.content,
              hider_user_id: v.hider_user_id,
              hider_display_name: v.hider_display_name,
            };
          });
          setPlantEggs(eggs);
          window.dispatchEvent(
            new CustomEvent("react:plant_eggs_update", { detail: { eggs } })
          );
        })
        .catch(() => {});
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

    const handleEditStatus = () => {
      setShowStatusSetter(true);
    };

    const handlePlantInteract = (e: Event) => {
      const { plant_id, has_egg, can_hide } = (e as CustomEvent).detail;
      if (has_egg) {
        api.discoverEasterEgg(plant_id).catch((err) => {
          console.error("Discover easter egg failed:", err);
        });
      } else if (can_hide) {
        setEasterEggPlantId(plant_id);
        setShowEasterEggSetter(true);
      }
    };

    window.addEventListener("game:player_moved", handlePlayerMoved);
    window.addEventListener("game:edit_status", handleEditStatus);
    window.addEventListener("game:nearby_desks", handleNearbyDesks);
    window.addEventListener("game:nearby_users", handleNearbyUsers);
    window.addEventListener("game:seat", handleSeat);
    window.addEventListener("game:stand_up", handleGameStandUp);
    window.addEventListener("game:sit_at_desk", handleSitAtDesk);
    window.addEventListener("game:plant_interact", handlePlantInteract);

    return () => {
      window.removeEventListener("game:player_moved", handlePlayerMoved);
      window.removeEventListener("game:edit_status", handleEditStatus);
      window.removeEventListener("game:nearby_desks", handleNearbyDesks);
      window.removeEventListener("game:nearby_users", handleNearbyUsers);
      window.removeEventListener("game:seat", handleSeat);
      window.removeEventListener("game:stand_up", handleGameStandUp);
      window.removeEventListener("game:sit_at_desk", handleSitAtDesk);
      window.removeEventListener("game:plant_interact", handlePlantInteract);
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

  const saveStatus = useCallback(
    async (status: string) => {
      if (!profile) return;
      try {
        await api.updateStatus(status);
        const newStatus = status || "";
        setProfile((prev) => (prev ? { ...prev, status: newStatus } : prev));
        wsRef.current?.send({ type: "set_status", status: newStatus });
        window.dispatchEvent(
          new CustomEvent("react:status_changed", {
            detail: { user_id: profile.id, status: newStatus },
          })
        );
      } catch (e) {
        console.error("Failed to update status:", e);
      }
    },
    [profile]
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

  const saveEasterEgg = useCallback(
    async (plantId: number, content: string) => {
      try {
        await api.hideEasterEgg(plantId, content);
        setShowEasterEggSetter(false);
        setEasterEggPlantId(null);
        // easter_egg_hidden ws will update plantEggs and dispatch to game
      } catch (e) {
        console.error("Hide easter egg failed:", e);
      }
    },
    []
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
      {/* Top bar - responsive scaling */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-2 py-1.5 sm:px-4 sm:py-2 bg-[var(--pixel-surface)] border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <span className="text-xs sm:text-sm font-bold truncate max-w-[120px] sm:max-w-none">{profile.display_name}</span>
          <span className="text-[10px] sm:text-xs text-green-400">Online</span>
          <span className="text-[10px] sm:text-xs text-gray-500">
            | {Object.keys(onlineUsers).length + 1} online
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-4 flex-wrap overflow-x-auto min-w-0">
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
            className={`pixel-btn text-[10px] sm:text-xs relative overflow-visible shrink-0 ${showAnnouncement ? "!bg-[var(--pixel-accent)]" : ""}`}
            onClick={() => setShowAnnouncement((v) => !v)}
          >
            <span className="hidden sm:inline">Announcement</span>
            <span className="sm:hidden">公告</span>
            {unreadSystem + unreadPersonal > 0 && (
              <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 min-w-[14px] h-[14px] sm:min-w-[18px] sm:h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[8px] sm:text-[10px] font-bold px-0.5 sm:px-1">
                {unreadSystem + unreadPersonal > 99 ? "99+" : unreadSystem + unreadPersonal}
              </span>
            )}
          </button>
          <button
            className={`pixel-btn text-[10px] sm:text-xs shrink-0 ${showNote ? "!bg-[var(--pixel-accent)]" : ""}`}
            onClick={() => setShowNote((v) => !v)}
          >
            Notes
          </button>
          <button
            className="pixel-btn text-[10px] sm:text-xs shrink-0 hidden md:inline-flex"
            onClick={() => router.push("/customize/personality")}
          >
            Edit Personality
          </button>
          <button
            className="pixel-btn text-[10px] sm:text-xs shrink-0"
            onClick={() => setShowStatusSetter((v) => !v)}
          >
            Set Status
          </button>
          <button
            className="pixel-btn text-[10px] sm:text-xs shrink-0"
            onClick={() => router.push("/customize")}
          >
            Edit Avatar
          </button>
          <button
            className="pixel-btn text-[10px] sm:text-xs shrink-0 !bg-red-900"
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

        {/* Floating action buttons - responsive */}
        <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 flex flex-col gap-1.5 sm:gap-2 z-10">
          {/* Desk actions */}
          {nearbyDesks.length > 0 &&
            !isSitting &&
            nearbyDesks.map((deskId) => (
              <button
                key={`desk-${deskId}`}
                className="pixel-btn text-[10px] sm:text-xs"
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
                className="pixel-btn text-[10px] sm:text-xs"
                onClick={() => openChat(uid)}
              >
                Chat with {name}
                {u?.profile?.is_afk ? " [AFK]" : ""}
              </button>
            );
          })}
        </div>

        {/* Chat panel - responsive positioning */}
        {chatTarget && (
          <div
            className={`absolute top-2 sm:top-4 z-20 right-2 w-[calc(100vw-1rem)] max-w-sm sm:max-w-md ${
              showAnnouncement && showNote
                ? "sm:right-[920px]"
                : showAnnouncement
                ? "sm:right-[500px]"
                : showNote
                ? "sm:right-[420px]"
                : "sm:right-4"
            }`}
          >
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

        {/* Note panel - responsive */}
        {showNote && (
          <div className={`absolute top-2 sm:top-4 right-2 sm:right-4 z-30 w-[calc(100vw-1rem)] max-w-sm sm:max-w-md ${showAnnouncement ? "sm:right-[500px]" : ""}`}>
            <NotePanel onClose={() => setShowNote(false)} />
          </div>
        )}

        {showAnnouncement && (
          <div className="absolute top-2 sm:top-4 right-2 sm:right-4 z-40 w-[calc(100vw-1rem)] max-w-sm sm:max-w-md">
            <AnnouncementPanel
              onClose={() => setShowAnnouncement(false)}
              unreadSystem={unreadSystem}
              unreadPersonal={unreadPersonal}
              onMarkReadSystem={markAnnouncementReadSystem}
              onMarkReadPersonal={markAnnouncementReadPersonal}
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
        <AnnouncementNotification
          notification={announcementNotification}
          onClose={() => setAnnouncementNotification(null)}
          onClick={() => openAnnouncementPanel()}
        />

        {showStatusSetter && (
          <div className="absolute top-12 sm:top-20 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 max-w-sm sm:max-w-md mx-auto">
            <StatusSetter
              currentStatus={profile?.status || ""}
              onSave={saveStatus}
              onClose={() => setShowStatusSetter(false)}
            />
          </div>
        )}

        {showEasterEggSetter && easterEggPlantId !== null && (
          <div className="absolute top-12 sm:top-20 left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 max-w-sm sm:max-w-md mx-auto">
            <EasterEggSetter
              plantId={easterEggPlantId}
              onSave={(content) => saveEasterEgg(easterEggPlantId, content)}
              onClose={() => {
                setShowEasterEggSetter(false);
                setEasterEggPlantId(null);
              }}
            />
          </div>
        )}

        {/* Online users sidebar - responsive */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10 max-w-[40vw] sm:max-w-none">
          <div className="pixel-panel text-[10px] sm:text-xs opacity-80 max-h-32 sm:max-h-48 overflow-y-auto">
            <p className="font-bold mb-0.5 sm:mb-1">Online ({Object.keys(onlineUsers).length + 1})</p>
            <p className="text-green-400 truncate">
              {profile.display_name} (you){isAfk ? " [AFK]" : ""}
            </p>
            {Object.entries(onlineUsers).map(([uid, u]: [string, any]) => (
              <p key={uid} className={`truncate ${u.profile?.is_afk ? "text-yellow-400" : "text-gray-300"}`}>
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

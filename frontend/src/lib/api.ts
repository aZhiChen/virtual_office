const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  register: (username: string, password: string, display_name?: string) =>
    apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password, display_name }),
    }),

  login: (username: string, password: string) =>
    apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  // Profile
  getProfile: () => apiFetch("/api/profile/me"),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateAvatar: (avatar_config: any) =>
    apiFetch("/api/profile/avatar", {
      method: "PUT",
      body: JSON.stringify({ avatar_config }),
    }),

  updatePet: (has_pet: boolean, pet_type: string) =>
    apiFetch("/api/profile/pet", {
      method: "PUT",
      body: JSON.stringify({ has_pet, pet_type }),
    }),

  updatePersonality: (personality: string) =>
    apiFetch("/api/profile/personality", {
      method: "PUT",
      body: JSON.stringify({ personality }),
    }),

  updateAfk: (is_afk: boolean) =>
    apiFetch("/api/profile/afk", {
      method: "PUT",
      body: JSON.stringify({ is_afk }),
    }),

  updateStatus: (status: string) =>
    apiFetch("/api/profile/status", {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  testPersonality: (personality: string, test_message: string) =>
    apiFetch("/api/profile/test-personality", {
      method: "POST",
      body: JSON.stringify({ personality, test_message }),
    }),

  // Chat
  getChatHistory: (withUserId: number) =>
    apiFetch(`/api/chat/history?with_user_id=${withUserId}`),

  // Note
  getNote: () => apiFetch("/api/note"),

  createTaskAndAdd: (content: string) =>
    apiFetch("/api/note/task", {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  addTaskToNote: (task_id: number) =>
    apiFetch("/api/note/add", {
      method: "POST",
      body: JSON.stringify({ task_id }),
    }),

  completeTask: (task_id: number) =>
    apiFetch(`/api/note/complete/${task_id}`, { method: "PUT" }),

  clearNote: () =>
    apiFetch("/api/note/clear", { method: "DELETE" }),

  reorderNote: (note_item_ids: number[]) =>
    apiFetch("/api/note/reorder", {
      method: "PUT",
      body: JSON.stringify({ note_item_ids }),
    }),

  removeNoteItem: (note_item_id: number) =>
    apiFetch(`/api/note/item/${note_item_id}`, { method: "DELETE" }),

  getPendingBox: () => apiFetch("/api/note/box/pending"),

  getCompletedBox: () => apiFetch("/api/note/box/completed"),

  // Announcement
  getAnnouncementFeed: (limit = 20) =>
    apiFetch(`/api/announcement/feed?limit=${limit}`),

  getAnnouncementFeedSummary: () =>
    apiFetch("/api/announcement/feed/summary"),

  getAnnouncementUnreadCount: (lastSystemAt?: string, lastPersonalAt?: string) => {
    const params = new URLSearchParams();
    if (lastSystemAt) params.set("last_system_at", lastSystemAt);
    if (lastPersonalAt) params.set("last_personal_at", lastPersonalAt);
    return apiFetch(`/api/announcement/unread-count?${params.toString()}`);
  },

  createPersonalPost: (content?: string, image_url?: string) =>
    apiFetch("/api/announcement/post", {
      method: "POST",
      body: JSON.stringify({ content, image_url }),
    }),

  deletePersonalPost: (post_id: number) =>
    apiFetch(`/api/announcement/post/${post_id}`, {
      method: "DELETE",
    }),

  likeAnnouncement: (target_type: "system" | "personal", target_id: number) =>
    apiFetch("/api/announcement/like", {
      method: "POST",
      body: JSON.stringify({ target_type, target_id }),
    }),

  unlikeAnnouncement: (target_type: "system" | "personal", target_id: number) =>
    apiFetch("/api/announcement/unlike", {
      method: "POST",
      body: JSON.stringify({ target_type, target_id }),
    }),

  getAnnouncementComments: (target_type: "system" | "personal", target_id: number) =>
    apiFetch(`/api/announcement/comments?target_type=${target_type}&target_id=${target_id}`),

  createAnnouncementComment: (target_type: "system" | "personal", target_id: number, content: string) =>
    apiFetch("/api/announcement/comment", {
      method: "POST",
      body: JSON.stringify({ target_type, target_id, content }),
    }),

  // Easter egg (plant)
  getPlantEasterEggs: () => apiFetch("/api/easter-egg/plants"),
  hideEasterEgg: (plant_id: number, content: string) =>
    apiFetch("/api/easter-egg/hide", {
      method: "POST",
      body: JSON.stringify({ plant_id, content }),
    }),
  discoverEasterEgg: (plant_id: number) =>
    apiFetch(`/api/easter-egg/discover/${plant_id}`, { method: "POST" }),
};

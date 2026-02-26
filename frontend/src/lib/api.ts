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

  testPersonality: (personality: string, test_message: string) =>
    apiFetch("/api/profile/test-personality", {
      method: "POST",
      body: JSON.stringify({ personality, test_message }),
    }),

  // Chat
  getChatHistory: (withUserId: number) =>
    apiFetch(`/api/chat/history?with_user_id=${withUserId}`),
};

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let res;
      if (isRegister) {
        res = await api.register(username, password, displayName || username);
      } else {
        res = await api.login(username, password);
      }
      localStorage.setItem("token", res.access_token);
      localStorage.setItem("userId", res.user_id.toString());
      localStorage.setItem("username", res.username);
      router.push("/customize");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="pixel-panel w-96">
        {/* Title */}
        <h1 className="text-2xl text-center mb-1 tracking-wider">
          Virtual Office
        </h1>
        <p className="text-xs text-center text-gray-400 mb-6">
          Pixel-art multiplayer workspace
        </p>

        {/* Toggle */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            className={`pixel-btn text-xs ${!isRegister ? "!bg-[var(--pixel-accent)]" : ""}`}
            onClick={() => setIsRegister(false)}
          >
            Login
          </button>
          <button
            className={`pixel-btn text-xs ${isRegister ? "!bg-[var(--pixel-accent)]" : ""}`}
            onClick={() => setIsRegister(true)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs mb-1">Username</label>
            <input
              className="pixel-input w-full"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs mb-1">Password</label>
            <input
              className="pixel-input w-full"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs mb-1">Display Name (optional)</label>
              <input
                className="pixel-input w-full"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How others see you"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <button
            className="pixel-btn w-full text-sm"
            type="submit"
            disabled={loading}
          >
            {loading ? "..." : isRegister ? "Create Account" : "Enter Office"}
          </button>
        </form>
      </div>
    </div>
  );
}

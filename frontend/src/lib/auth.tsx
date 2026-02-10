"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface AuthState {
  token: string | null;
  userId: number | null;
  username: string | null;
  isAuthenticated: boolean;
  login: (token: string, userId: number, username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  userId: null,
  username: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("token");
    const uid = localStorage.getItem("userId");
    const un = localStorage.getItem("username");
    if (t) {
      setToken(t);
      setUserId(uid ? parseInt(uid) : null);
      setUsername(un);
    }
    setLoaded(true);
  }, []);

  const login = (t: string, uid: number, un: string) => {
    localStorage.setItem("token", t);
    localStorage.setItem("userId", uid.toString());
    localStorage.setItem("username", un);
    setToken(t);
    setUserId(uid);
    setUsername(un);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("username");
    setToken(null);
    setUserId(null);
    setUsername(null);
  };

  if (!loaded) return null;

  return (
    <AuthContext.Provider
      value={{ token, userId, username, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

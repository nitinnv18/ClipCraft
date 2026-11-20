"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types";
import { api } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
});

function encodeUserForCookie(user: User): string {
  try {
    return encodeURIComponent(JSON.stringify(user));
  } catch {
    return "";
  }
}

export function setAuthCookies(token: string, user: User) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24; // 24 hours (matches backend ACCESS_TOKEN_EXPIRE_MINUTES)
  const encoded = encodeUserForCookie(user);
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `clipcraft_user=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  document.cookie = `clipcraft_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearAuthCookies() {
  if (typeof document === "undefined") return;
  document.cookie = "clipcraft_user=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "clipcraft_token=; path=/; max-age=0; SameSite=Lax";
}

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  initialUser?: User | null;
}> = ({ children, initialUser = null }) => {
  // Use initialUser from SSR cookie as source of truth for 0-blink SSR
  const [user, setUser] = useState<User | null>(initialUser);
  const [isLoading, setIsLoading] = useState<boolean>(!initialUser);

  useEffect(() => {
    // Synchronize client storage with cookie / session
    try {
      const storedUserStr = localStorage.getItem("clipcraft_user");
      const token = localStorage.getItem("clipcraft_token");

      if (token && storedUserStr) {
        try {
          const parsedUser: User = JSON.parse(storedUserStr);
          // Set in state only if SSR didn't have it
          setUser((current) => current || parsedUser);
          // Always ensure cookie is fresh
          setAuthCookies(token, parsedUser);
        } catch (_) {}

        // Silently verify with backend in background without clearing state abruptly
        api
          .getMe()
          .then((freshUser) => {
            setUser((current) => {
              if (
                current &&
                current.id === freshUser.id &&
                current.email === freshUser.email
              ) {
                return current; // Unchanged reference = 0 re-render
              }
              return freshUser;
            });
            localStorage.setItem("clipcraft_user", JSON.stringify(freshUser));
            setAuthCookies(token, freshUser);
          })
          .catch((e: unknown) => {
            const errObj = e as { message?: string } | undefined;
            const msg = String(errObj?.message || "").toLowerCase();
            if (
              msg.includes("invalid or expired") ||
              msg.includes("session expired") ||
              msg.includes("401") ||
              msg.includes("unauthorized")
            ) {
              api.clearToken();
              clearAuthCookies();
              localStorage.removeItem("clipcraft_user");
              localStorage.removeItem("clipcraft_token");
              setUser(null);
            }
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        if (!token && !initialUser) {
          clearAuthCookies();
        }
        setIsLoading(false);
      }
    } catch (_) {
      setIsLoading(false);
    }
  }, [initialUser]);

  const login = (token: string, userData: User) => {
    api.setToken(token);
    localStorage.setItem("clipcraft_user", JSON.stringify(userData));
    localStorage.setItem("clipcraft_token", token);
    setAuthCookies(token, userData);
    setUser(userData);
  };

  const logout = () => {
    api.clearToken();
    clearAuthCookies();
    localStorage.removeItem("clipcraft_user");
    localStorage.removeItem("clipcraft_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

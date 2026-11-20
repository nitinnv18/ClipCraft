"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminUser, AdminRole } from "@/types/admin";
import { adminApi } from "@/lib/adminApi";

interface AdminAuthContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  login: (token: string, adminData: AdminUser) => void;
  logout: () => void;
  hasRole: (roles: AdminRole[]) => boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

function encodeAdminForCookie(admin: AdminUser): string {
  try {
    return encodeURIComponent(JSON.stringify(admin));
  } catch {
    return "";
  }
}

export function setAdminCookies(token: string, admin: AdminUser) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 8; // 8 hours (matches backend ADMIN_TOKEN_EXPIRE_MINUTES)
  const encoded = encodeAdminForCookie(admin);
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `clipcraft_admin_user=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  document.cookie = `clipcraft_admin_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

export function clearAdminCookies() {
  if (typeof document === "undefined") return;
  document.cookie = "clipcraft_admin_user=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "clipcraft_admin_token=; path=/; max-age=0; SameSite=Lax";
}

export const AdminAuthProvider: React.FC<{
  children: React.ReactNode;
  initialAdmin?: AdminUser | null;
}> = ({ children, initialAdmin = null }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(initialAdmin);
  const [isLoading, setIsLoading] = useState<boolean>(!initialAdmin);
  const router = useRouter();

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("clipcraft_admin_token");
      const storedAdminStr = localStorage.getItem("clipcraft_admin_user");

      if (storedToken && storedAdminStr) {
        try {
          const parsedAdmin: AdminUser = JSON.parse(storedAdminStr);
          setAdmin((curr) => curr || parsedAdmin);
          setAdminCookies(storedToken, parsedAdmin);
        } catch (_) {}

        // Verify with backend silently in background
        adminApi
          .getMe()
          .then((me) => {
            setAdmin((curr) => {
              if (
                curr &&
                curr.id === me.id &&
                curr.email === me.email &&
                curr.role === me.role
              ) {
                return curr; // Unchanged reference
              }
              return me;
            });
            localStorage.setItem("clipcraft_admin_user", JSON.stringify(me));
            setAdminCookies(storedToken, me);
          })
          .catch((err: unknown) => {
            const errStr = String(err instanceof Error ? err.message : "").toLowerCase();
            const isAuthFailure = errStr.includes("401") || errStr.includes("unauthorized") || errStr.includes("forbidden");
            if (isAuthFailure) {
              adminApi.clearToken();
              clearAdminCookies();
              localStorage.removeItem("clipcraft_admin_token");
              localStorage.removeItem("clipcraft_admin_user");
              setAdmin(null);
            }
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        if (!storedToken && !initialAdmin) {
          clearAdminCookies();
        }
        setIsLoading(false);
      }
    } catch (_) {
      setIsLoading(false);
    }
  }, [initialAdmin]);

  const login = (token: string, adminData: AdminUser) => {
    adminApi.setToken(token);
    localStorage.setItem("clipcraft_admin_user", JSON.stringify(adminData));
    localStorage.setItem("clipcraft_admin_token", token);
    setAdminCookies(token, adminData);
    setAdmin(adminData);
  };

  const logout = async () => {
    try {
      await adminApi.logout();
    } catch {}
    adminApi.clearToken();
    clearAdminCookies();
    localStorage.removeItem("clipcraft_admin_token");
    localStorage.removeItem("clipcraft_admin_user");
    setAdmin(null);
    router.push("/login");
  };

  const hasRole = (roles: AdminRole[]): boolean => {
    if (!admin) return false;
    if (admin.role === "SUPER_ADMIN") return true;
    return roles.includes(admin.role);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isLoading, login, logout, hasRole }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }
  return context;
};

"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
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
    const json = JSON.stringify(admin);
    if (typeof window !== "undefined" && window.btoa) {
      return window.btoa(unescape(encodeURIComponent(json)));
    }
  } catch (_) {}
  return encodeURIComponent(JSON.stringify(admin));
}

function decodeAdminFromCookie(val: string): AdminUser | null {
  if (!val) return null;
  try {
    if (typeof window !== "undefined" && window.atob) {
      return JSON.parse(decodeURIComponent(escape(window.atob(val))));
    }
  } catch (_) {}
  try {
    return JSON.parse(decodeURIComponent(val));
  } catch (_) {}
  try {
    return JSON.parse(val);
  } catch (_) {}
  return null;
}

export function setAdminCookies(token: string, admin: AdminUser) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  const encoded = encodeAdminForCookie(admin);
  document.cookie = `clipcraft_admin_user=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `clipcraft_admin_token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();
  const pathname = usePathname();

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
          .catch(() => {
            adminApi.clearToken();
            clearAdminCookies();
            localStorage.removeItem("clipcraft_admin_token");
            localStorage.removeItem("clipcraft_admin_user");
            setAdmin(null);
          });
      } else if (!storedToken && !initialAdmin) {
        clearAdminCookies();
      }
    } catch (_) {}
  }, [initialAdmin]);

  const login = (token: string, adminData: AdminUser) => {
    adminApi.setToken(token);
    localStorage.setItem("clipcraft_admin_user", JSON.stringify(adminData));
    localStorage.setItem("clipcraft_admin_token", token);
    setAdminCookies(token, adminData);
    setAdmin(adminData);
    router.push("/dashboard");
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

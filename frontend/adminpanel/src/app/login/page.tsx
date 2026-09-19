"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ShieldCheck, Lock, Scissors } from "lucide-react";

import { AdminLogo } from "@/components/AdminLogo";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await adminApi.login(email, password);
      login(res.access_token, res.admin);
    } catch (err: any) {
      setError(err.message || "Invalid administrator credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-[#2b2e36] bg-[#121316] p-8 shadow-none">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#22252c]">
            <AdminLogo size={36} />
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider text-white">
                ClipCraft <span className="text-red-500">Admin</span>
              </h1>
              <p className="text-[11px] font-mono text-gray-400">
                Operations &amp; Security Console
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-red-950 border border-red-600 text-red-200 text-xs font-mono">
                {error}
              </div>
            )}

            <Input
              label="Admin Email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="admin@domain.com"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="mt-2 font-bold flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Authenticate Session</span>
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

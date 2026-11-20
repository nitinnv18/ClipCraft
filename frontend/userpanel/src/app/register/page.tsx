"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { UserPlus } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    document.title = "ClipCraft - Register";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.register(email, password);
      login(res.access_token, res.user);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create account.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12">
      <div className="w-full max-w-md">
        <Card className="border-[#2b2e36] bg-[#121316] p-8">
          <div className="flex items-center gap-4 mb-6 border-b border-[#22252c] pb-5">
            <div className="w-12 h-12 bg-amber-500 text-black flex items-center justify-center font-bold flex-shrink-0 rounded shadow-[0_0_20px_rgba(245,158,11,0.25)]">
              <UserPlus className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-white">
                Create Account
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">Start generating high-retention clips</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-red-950 border border-red-600 text-red-200 text-xs font-mono flex flex-col gap-2">
                <span>{error}</span>
                {error.toLowerCase().includes("already exists") && (
                  <Link
                    href={`/login?email=${encodeURIComponent(email)}`}
                    className="text-amber-400 font-bold uppercase underline hover:text-amber-300"
                  >
                    &rarr; Click here to Sign In with this email
                  </Link>
                )}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="creator@channel.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="mt-2">
              Create Free Account
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#22252c] text-center text-xs text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-amber-400 hover:underline uppercase font-bold">
              Sign In
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

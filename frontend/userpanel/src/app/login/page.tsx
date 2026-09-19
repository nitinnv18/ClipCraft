"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Lock } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    document.title = "ClipCraft - Login";
  }, []);

  useEffect(() => {
    const qEmail = searchParams.get("email");
    if (qEmail) {
      setEmail(qEmail);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.login(email, password);
      login(res.access_token, res.user);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-12">
      <div className="w-full max-w-md">
        <Card className="border-[#2b2e36] bg-[#121316] p-8">
          <div className="flex items-center gap-2.5 mb-6 border-b border-[#22252c] pb-4">
            <div className="w-8 h-8 bg-amber-500 text-black flex items-center justify-center font-bold flex-shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider text-white">
                Sign In to Clip<span className="text-amber-500">Craft</span>
              </h1>
              <p className="text-xs text-gray-400">Enter your credentials to continue</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-red-950 border border-red-600 text-red-200 text-xs font-mono">
                {error}
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="editor@studio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="mt-2">
              Sign In
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#22252c] text-center text-xs text-gray-400">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-amber-400 hover:underline uppercase font-bold">
              Register Here
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center py-12 text-xs font-mono text-gray-400">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { login } from "@/lib/auth";
import { useAuth } from "@/lib/useAuth";

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.status === "authenticated") router.replace("/dashboard");
  }, [auth.status, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      await auth.refresh();
      router.replace("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message === "Credenciais inválidas" ? "Email ou senha inválidos." : "Nao foi possivel concluir o login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center">
            <h1 className="text-3xl font-bold text-neutral-900">Finch</h1>
            <Image
              src="/finch.png"
              alt="Finch Logo"
              width={32}
              height={32}
              className="ml-2"
            />
          </div>

          <p className="mt-1 text-sm text-neutral-500">
            Controle suas finanças pessoais
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">Entrar</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Acesse sua conta para continuar.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Email</label>
              <input
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                placeholder="seuemail@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-700">Senha</label>
              <input
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

        </div>

        <div className="mt-6 flex items-center justify-center">
          <p className="text-center text-xs text-neutral-500">© {new Date().getFullYear()} Finch</p>
          <Image
            src="/finch.png"
            alt="Finch Logo"
            width={16}
            height={16}
            className="ml-1 inline-block"
          />
          <p className="text-center text-xs text-neutral-500">. Todos os direitos reservados.</p>
        </div>
      </div>
    </div>
  );
}

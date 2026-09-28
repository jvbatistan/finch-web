"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { useRouter } from "next/navigation";

type Indicator = { key: string; label: string; count: number; total_amount: number; action_url: string };

function formatBRL(value: number) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FinancialHygienePage() {
  const router = useRouter();
  const auth = useAuth();
  const [indicators, setIndicators] = useState<Indicator[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api("/api/financial_hygiene", { cache: "no-store" }) as { indicators: Indicator[] };
      setIndicators(data.indicators);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) router.replace("/login");
      else setError("Não foi possível carregar o relatório de higiene financeira.");
    }
  }, [router]);

  useEffect(() => { if (auth.status === "unauthenticated") router.replace("/login"); }, [auth.status, router]);
  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [auth.status, load]);
  if (auth.status !== "authenticated") return <div className="min-h-screen bg-neutral-50" />;

  return <AppLayout><div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Higiene financeira</h1><p className="mt-1 text-neutral-500">Pendências para revisar. Este relatório não altera nenhum dado.</p></div>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</p>}
    {!indicators ? <div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-xl bg-neutral-100" />)}</div> : <div className="grid gap-4 md:grid-cols-3">{indicators.map((item) => <section key={item.key} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-neutral-900">{item.label}</h2><p className="mt-4 text-3xl font-bold">{item.count}</p><p className="mt-1 text-sm text-neutral-500">Impacto: {formatBRL(item.total_amount)}</p><Link className="mt-5 inline-flex font-medium text-blue-700 underline" href={item.action_url}>Ver itens</Link></section>)}</div>}
  </div></AppLayout>;
}

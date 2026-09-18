"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

import { AppLayout } from "@/components/AppLayout";
import { DashboardContent } from "@/components/DashboardContent";
import { useDashboard } from "@/features/dashboard";


export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-50" />}>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const handleUnauthorized = useCallback(() => router.replace("/login"), [router]);
  const now = new Date();
  const month = Math.min(Math.max(Number(searchParams.get("month")) || now.getMonth() + 1, 1), 12);
  const year = Math.max(Number(searchParams.get("year")) || now.getFullYear(), 1);

  useEffect(() => {
    if (auth.status === "unauthenticated") router.replace("/login");
  }, [auth.status, router]);

  const { overview, loading, error } = useDashboard({
    month,
    year,
    enabled: auth.status === "authenticated",
    onUnauthorized: handleUnauthorized,
  });

  const navigateMonth = (offset: number) => {
    const date = new Date(year, month - 1 + offset, 1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(date.getMonth() + 1));
    params.set("year", String(date.getFullYear()));
    router.push(`/dashboard?${params.toString()}`);
  };

  if (auth.status === "loading") {
    return <div className="min-h-screen bg-neutral-50" />;
  }

  if (auth.status === "unauthenticated") {
    return <div className="min-h-screen bg-neutral-50" />;
  }

  return (
    <AppLayout>
      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      )}

      {loading || !overview ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[168px] animate-pulse rounded-lg border border-neutral-200 bg-white shadow-sm" />
          ))}
        </div>
      ) : (
        <DashboardContent
          overview={overview}
          onPreviousMonth={() => navigateMonth(-1)}
          onNextMonth={() => navigateMonth(1)}
        />
      )}
    </AppLayout>
  );
}

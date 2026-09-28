"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Download, Printer, Wallet } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DIRECTION_LABELS,
  DIRECTION_OPTIONS,
  MOVEMENT_TYPE_ICONS,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_OPTIONS,
  exportAccountStatementCsv,
  fetchAccountStatement,
  type AccountKind,
  type AccountStatementResponse,
  type StatementDirection,
  type StatementEntry,
  type StatementMovementType,
} from "@/features/accounts";
import { useAuth } from "@/lib/useAuth";
import { formatCivilDateBR } from "@/lib/civil-date";

const accountKindLabels: Record<AccountKind, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  wallet: "Carteira",
  digital_wallet: "Carteira digital",
  other: "Outra",
};

const sourceLabels: Record<string, string> = {
  cash: "Dinheiro",
  bank: "Banco",
  card: "Cartão",
};

type StatementFilters = {
  startDate: string;
  endDate: string;
  movementType: StatementMovementType | "";
  direction: StatementDirection | "";
  page: number;
};

function formatBRL(value: number | string) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatSignedBRL(value: number | string, direction: StatementDirection) {
  const prefix = direction === "credit" ? "+" : "-";

  return `${prefix} ${formatBRL(value)}`;
}

function formatDateBR(dateISO: string | null | undefined) {
  if (!dateISO) return "Sem data";

  return formatCivilDateBR(dateISO);
}

function kindLabel(kind: AccountKind) {
  return accountKindLabels[kind] ?? kind;
}

function errorMessageFor(err: unknown) {
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (message.includes("404") || message.includes("not found") || message.includes("não encontrado")) {
      return "Conta não encontrada.";
    }

    return err.message;
  }

  return "Não foi possível carregar o extrato.";
}

function readFiltersFromUrl(): StatementFilters {
  const searchParams = new URLSearchParams(window.location.search);
  const movementType = searchParams.get("movement_type");
  const direction = searchParams.get("direction");

  return {
    startDate: searchParams.get("start_date") ?? "",
    endDate: searchParams.get("end_date") ?? "",
    movementType: isMovementType(movementType) ? movementType : "",
    direction: isDirection(direction) ? direction : "",
    page: Math.max(Number(searchParams.get("page") ?? "1"), 1),
  };
}

function isMovementType(value: string | null): value is StatementMovementType {
  return Boolean(value && value in MOVEMENT_TYPE_LABELS);
}

function isDirection(value: string | null): value is StatementDirection {
  return value === "credit" || value === "debit";
}

function resultCountText(totalCount: number) {
  if (totalCount === 0) return "Nenhuma movimentação encontrada";
  if (totalCount === 1) return "1 movimentação encontrada";

  return `${totalCount} movimentações encontradas`;
}

export default function AccountStatementPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();
  const accountId = Number(params.id);
  const [statement, setStatement] = useState<AccountStatementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [movementType, setMovementType] = useState<StatementMovementType | "">("");
  const [direction, setDirection] = useState<StatementDirection | "">("");
  const [appliedFilters, setAppliedFilters] = useState<StatementFilters>({
    startDate: "",
    endDate: "",
    movementType: "",
    direction: "",
    page: 1,
  });

  const handleUnauthorized = useCallback(() => router.replace("/login"), [router]);

  const updateUrl = useCallback((filters: StatementFilters) => {
    const searchParams = new URLSearchParams();
    if (filters.startDate) searchParams.set("start_date", filters.startDate);
    if (filters.endDate) searchParams.set("end_date", filters.endDate);
    if (filters.movementType) searchParams.set("movement_type", filters.movementType);
    if (filters.direction) searchParams.set("direction", filters.direction);
    if (filters.page > 1) searchParams.set("page", String(filters.page));

    const query = searchParams.toString();
    router.push(`/accounts/${accountId}${query ? `?${query}` : ""}`);
  }, [accountId, router]);

  const loadStatement = useCallback(async ({
    filters,
    signal,
  }: {
    filters: StatementFilters;
    signal?: AbortSignal;
  }) => {
    if (!Number.isFinite(accountId) || accountId <= 0) {
      setError("Conta não encontrada.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await fetchAccountStatement(accountId, {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        movementType: filters.movementType || undefined,
        direction: filters.direction || undefined,
        page: filters.page,
        perPage: 25,
        signal,
      });

      if (result.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!result.data) {
        setError("Não foi possível carregar o extrato.");
        return;
      }

      setStatement(result.data);
      setAppliedFilters(filters);
      setStartDate(result.data.period.start_date ?? filters.startDate);
      setEndDate(result.data.period.end_date ?? filters.endDate);
      setMovementType(result.data.filters.movement_type ?? filters.movementType);
      setDirection(result.data.filters.direction ?? filters.direction);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error(err);
        setError(errorMessageFor(err));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accountId, handleUnauthorized]);

  useEffect(() => {
    if (auth.status === "unauthenticated") router.replace("/login");
  }, [auth.status, router]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;

    const initialFilters = readFiltersFromUrl();
    const controller = new AbortController();

    setStartDate(initialFilters.startDate);
    setEndDate(initialFilters.endDate);
    setMovementType(initialFilters.movementType);
    setDirection(initialFilters.direction);
    setAppliedFilters(initialFilters);

    void loadStatement({ filters: initialFilters, signal: controller.signal });

    return () => controller.abort();
  }, [auth.status, loadStatement]);

  function applyFilters(nextFilters: StatementFilters) {
    setPeriodError(null);
    updateUrl(nextFilters);
    void loadStatement({ filters: nextFilters });
  }

  function handleApplyFilters(event: React.FormEvent) {
    event.preventDefault();
    setPeriodError(null);

    if (startDate && endDate && startDate > endDate) {
      setPeriodError("A data inicial deve ser anterior ou igual à data final.");
      return;
    }

    applyFilters({
      startDate,
      endDate,
      movementType,
      direction,
      page: 1,
    });
  }

  function handleMovementTypeChange(value: string) {
    const nextMovementType = isMovementType(value) ? value : "";
    setMovementType(nextMovementType);
    applyFilters({
      startDate,
      endDate,
      movementType: nextMovementType,
      direction,
      page: 1,
    });
  }

  function handleDirectionChange(value: string) {
    const nextDirection = isDirection(value) ? value : "";
    setDirection(nextDirection);
    applyFilters({
      startDate,
      endDate,
      movementType,
      direction: nextDirection,
      page: 1,
    });
  }

  function handleClearFilters() {
    setPeriodError(null);
    setStartDate("");
    setEndDate("");
    setMovementType("");
    setDirection("");
    applyFilters({
      startDate: "",
      endDate: "",
      movementType: "",
      direction: "",
      page: 1,
    });
  }

  function handleRemovePeriodFilter() {
    setStartDate("");
    setEndDate("");
    applyFilters({
      startDate: "",
      endDate: "",
      movementType: appliedFilters.movementType,
      direction: appliedFilters.direction,
      page: 1,
    });
  }

  function handleRemoveMovementTypeFilter() {
    setMovementType("");
    applyFilters({
      ...appliedFilters,
      movementType: "",
      page: 1,
    });
  }

  function handleRemoveDirectionFilter() {
    setDirection("");
    applyFilters({
      ...appliedFilters,
      direction: "",
      page: 1,
    });
  }

  function handlePageChange(nextPage: number) {
    applyFilters({
      ...appliedFilters,
      page: nextPage,
    });
  }

  function handlePrintStatement() {
    const searchParams = new URLSearchParams();
    if (appliedFilters.startDate) searchParams.set("start_date", appliedFilters.startDate);
    if (appliedFilters.endDate) searchParams.set("end_date", appliedFilters.endDate);
    if (appliedFilters.movementType) searchParams.set("movement_type", appliedFilters.movementType);
    if (appliedFilters.direction) searchParams.set("direction", appliedFilters.direction);

    const query = searchParams.toString();
    router.push(`/accounts/${accountId}/statement/print${query ? `?${query}` : ""}`);
  }

  async function handleExportCsv() {
    try {
      setExportingCsv(true);
      setExportError(null);
      const result = await exportAccountStatementCsv(accountId, {
        startDate: appliedFilters.startDate || undefined,
        endDate: appliedFilters.endDate || undefined,
        movementType: appliedFilters.movementType || undefined,
        direction: appliedFilters.direction || undefined,
      });

      if (result.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!result.data) {
        setExportError("Não foi possível exportar o extrato.");
        return;
      }

      const url = URL.createObjectURL(result.data.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.data.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setExportError("Não foi possível exportar o extrato. Tente novamente.");
    } finally {
      setExportingCsv(false);
    }
  }

  if (auth.status !== "authenticated") {
    return <div className="min-h-screen bg-neutral-50" />;
  }

  const account = statement?.account;
  const pagination = statement?.pagination;
  const isArchived = Boolean(account?.archived_at);
  const blockingLoading = loading && !statement;
  const hasTypeOrDirectionFilters = Boolean(appliedFilters.movementType || appliedFilters.direction);

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link href="/accounts" className="inline-flex items-center text-sm font-medium text-neutral-600 hover:text-neutral-950">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para contas
        </Link>

        {error && !statement ? (
          <Card>
            <CardContent className="py-10 text-center">
              <h1 className="text-xl font-bold text-neutral-950">{error}</h1>
              <p className="mt-2 text-sm text-neutral-500">Não conseguimos abrir o extrato desta conta.</p>
              <Button type="button" className="mt-5" onClick={() => router.push("/accounts")}>
                Voltar para contas
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
              {loading && !statement ? (
                <p className="text-sm text-neutral-500">Carregando extrato...</p>
              ) : account ? (
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <Wallet className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-neutral-950 sm:text-3xl">{account.name}</h1>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isArchived ? "bg-neutral-100 text-neutral-600" : "bg-emerald-50 text-emerald-700"}`}>
                          {isArchived ? "Arquivada" : "Ativa"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-neutral-500">{kindLabel(account.kind)}</p>
                      {isArchived && (
                        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                          Esta conta está arquivada. O extrato está disponível apenas para consulta.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 lg:items-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrintStatement}
                      disabled={loading}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Imprimir extrato
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleExportCsv}
                      disabled={exportingCsv || loading}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {exportingCsv ? "Exportando..." : "Exportar CSV"}
                    </Button>
                    <div className="rounded-2xl bg-neutral-50 p-4 text-left lg:min-w-64">
                      <p className="text-sm text-neutral-500">Saldo atual</p>
                      <p className={`mt-1 text-3xl font-bold tabular-nums ${balanceTextClass(Number(account.current_balance))}`}>
                        {formatBRL(account.current_balance)}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500">Calculado pela API de Accounts</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>

            {exportError && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {exportError}
              </p>
            )}

            {statement && (
              <>
                <section className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${loading ? "opacity-75" : ""}`} aria-busy={loading}>
                  <SummaryCard title="Entradas" value={statement.summary.credits_total} tone="credit" />
                  <SummaryCard title="Saídas" value={statement.summary.debits_total} tone="debit" />
                  <SummaryCard title="Variação líquida" value={statement.summary.net_total} tone={Number(statement.summary.net_total) >= 0 ? "credit" : "debit"} />
                </section>

                <section aria-labelledby="period-balances-title" className={`space-y-3 ${loading ? "opacity-75" : ""}`} aria-busy={loading}>
                  <div>
                    <h2 id="period-balances-title" className="text-lg font-semibold text-neutral-950">Saldos do período</h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      Posição patrimonial calculada pela API para o período selecionado.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <SummaryCard title="Saldo de abertura" value={statement.balances.opening_balance} tone={Number(statement.balances.opening_balance) >= 0 ? "credit" : "debit"} />
                    <SummaryCard title="Entradas" value={statement.summary.credits_total} tone="credit" />
                    <SummaryCard title="Saídas" value={statement.summary.debits_total} tone="debit" />
                    <SummaryCard title="Variação líquida" value={statement.summary.net_total} tone={Number(statement.summary.net_total) >= 0 ? "credit" : "debit"} />
                    <SummaryCard title="Saldo de fechamento" value={statement.balances.closing_balance} tone={Number(statement.balances.closing_balance) >= 0 ? "credit" : "debit"} />
                  </div>
                </section>

                <Card>
                  <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <p className="mt-1 text-sm text-neutral-500">Combine período, tipo e direção. Os filtros são processados pela API.</p>
                  </CardHeader>
                  <CardContent>
                    <form aria-label="Filtros do extrato" onSubmit={handleApplyFilters} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto_auto] lg:items-end">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-800" htmlFor="start-date">Data inicial</label>
                        <Input
                          id="start-date"
                          type="date"
                          value={startDate}
                          onChange={(event) => setStartDate(event.target.value)}
                          disabled={blockingLoading}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-800" htmlFor="end-date">Data final</label>
                        <Input
                          id="end-date"
                          type="date"
                          value={endDate}
                          onChange={(event) => setEndDate(event.target.value)}
                          disabled={blockingLoading}
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-800" htmlFor="movement-type">Tipo</label>
                        <select
                          id="movement-type"
                          value={movementType}
                          onChange={(event) => handleMovementTypeChange(event.target.value)}
                          disabled={blockingLoading}
                          className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                        >
                          {MOVEMENT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value || "all"} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-800" htmlFor="direction">Direção</label>
                        <select
                          id="direction"
                          value={direction}
                          onChange={(event) => handleDirectionChange(event.target.value)}
                          disabled={blockingLoading}
                          className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100"
                        >
                          {DIRECTION_OPTIONS.map((option) => (
                            <option key={option.value || "all"} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <Button type="submit" disabled={blockingLoading} className="h-11 rounded-xl bg-neutral-900 text-white">
                        {loading ? "Aplicando..." : "Aplicar"}
                      </Button>
                      <Button type="button" variant="outline" disabled={blockingLoading} onClick={handleClearFilters} className="h-11 rounded-xl">
                        Limpar filtros
                      </Button>
                    </form>

                    <ActiveFilters
                      filters={appliedFilters}
                      onRemovePeriod={handleRemovePeriodFilter}
                      onRemoveMovementType={handleRemoveMovementTypeFilter}
                      onRemoveDirection={handleRemoveDirectionFilter}
                    />

                    {periodError && <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{periodError}</p>}
                    {error && statement && <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Extrato</CardTitle>
                      <p className="mt-1 text-sm text-neutral-500">
                        Movimentação patrimonial da conta. Não é o dashboard por competência.
                      </p>
                      <p className="mt-2 text-sm font-medium text-neutral-700">
                        {resultCountText(statement.pagination.total_count)}
                      </p>
                    </div>
                    {loading && statement && <span className="text-sm text-neutral-500" role="status">Atualizando...</span>}
                  </CardHeader>
                  <CardContent className={loading ? "opacity-75" : ""} aria-busy={loading}>
                    {statement.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center">
                        <CalendarDays className="mx-auto mb-4 h-10 w-10 text-neutral-300" />
                        <h2 className="text-lg font-semibold text-neutral-950">
                          {hasTypeOrDirectionFilters ? "Nenhuma movimentação corresponde aos filtros selecionados." : "Nenhuma movimentação encontrada neste período."}
                        </h2>
                        <p className="mt-2 text-sm text-neutral-500">
                          {hasTypeOrDirectionFilters ? "Tente remover tipo ou direção para ampliar a consulta." : "Tente ajustar o período selecionado."}
                        </p>
                        <Button type="button" variant="outline" className="mt-5 rounded-xl" onClick={handleClearFilters}>
                          Limpar filtros
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {statement.items.map((item) => (
                          <StatementItemCard key={item.id} item={item} />
                        ))}
                      </div>
                    )}

                    {pagination && (
                      <div className="mt-5 flex flex-col gap-3 border-t border-neutral-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-neutral-500">
                          Página {pagination.page} de {Math.max(pagination.total_pages, 1)} · {resultCountText(pagination.total_count)}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            disabled={blockingLoading || pagination.page <= 1}
                            onClick={() => handlePageChange(pagination.page - 1)}
                          >
                            Anterior
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={blockingLoading || pagination.page >= pagination.total_pages}
                            onClick={() => handlePageChange(pagination.page + 1)}
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function ActiveFilters({
  filters,
  onRemovePeriod,
  onRemoveMovementType,
  onRemoveDirection,
}: {
  filters: StatementFilters;
  onRemovePeriod: () => void;
  onRemoveMovementType: () => void;
  onRemoveDirection: () => void;
}) {
  const hasPeriod = Boolean(filters.startDate || filters.endDate);
  const hasAnyFilter = hasPeriod || filters.movementType || filters.direction;

  if (!hasAnyFilter) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Filtros ativos">
      <span className="text-sm font-medium text-neutral-600">Filtros ativos:</span>
      {hasPeriod && (
        <FilterChip onRemove={onRemovePeriod}>
          Período: {filters.startDate ? formatDateBR(filters.startDate) : "início"} a {filters.endDate ? formatDateBR(filters.endDate) : "fim"}
        </FilterChip>
      )}
      {filters.movementType && (
        <FilterChip onRemove={onRemoveMovementType}>
          Tipo: {MOVEMENT_TYPE_LABELS[filters.movementType]}
        </FilterChip>
      )}
      {filters.direction && (
        <FilterChip onRemove={onRemoveDirection}>
          Direção: {DIRECTION_LABELS[filters.direction]}
        </FilterChip>
      )}
    </div>
  );
}

function FilterChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-left text-xs font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-200"
      aria-label={`Remover filtro ${String(children)}`}
    >
      {children}
      <span aria-hidden="true" className="ml-2 text-neutral-400">×</span>
    </button>
  );
}

function SummaryCard({ title, value, tone }: { title: string; value: string; tone: "credit" | "debit" }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-neutral-500">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold tabular-nums sm:text-3xl ${tone === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
          {formatBRL(value)}
        </p>
      </CardContent>
    </Card>
  );
}

function StatementItemCard({ item }: { item: StatementEntry }) {
  const credit = item.direction === "credit";
  const Icon = MOVEMENT_TYPE_ICONS[item.movement_type];

  return (
    <article className="rounded-2xl border border-neutral-200 p-4 transition hover:bg-neutral-50">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${credit ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold text-neutral-950">{item.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
                <span className="font-semibold text-neutral-700">{MOVEMENT_TYPE_LABELS[item.movement_type]}</span>
                <span aria-hidden="true">•</span>
                <span>{formatDateBR(item.occurred_on)}</span>
                <span aria-hidden="true">•</span>
                <span>{credit ? "Crédito" : "Débito"}</span>
              </div>
              {safeText(item.description) && <p className="mt-3 text-sm text-neutral-700">{safeText(item.description)}</p>}
              <MetadataLine item={item} />
            </div>
          </div>
        </div>

        <p className={`text-lg font-bold tabular-nums sm:text-xl ${credit ? "text-emerald-600" : "text-rose-600"}`}>
          {formatSignedBRL(item.amount, item.direction)}
        </p>
      </div>
    </article>
  );
}

function MetadataLine({ item }: { item: StatementEntry }) {
  const parts = metadataPartsFor(item);

  if (parts.length === 0) return null;

  return (
    <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
      {parts.map((part) => (
        <div key={`${part.label}-${part.value}`} className="flex gap-1">
          <dt>{part.label}:</dt>
          <dd className="font-medium text-neutral-600">{part.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function metadataPartsFor(item: StatementEntry) {
  const metadata = item.metadata ?? {};
  const parts: Array<{ label: string; value: string }> = [];
  const categoryName = safeText(metadata.category?.name);
  const source = safeText(metadata.source);
  const cardName = safeText(metadata.card?.name);
  const billingStatement = safeText(metadata.billing_statement);
  const counterpartyAccountName = safeText(metadata.counterparty_account?.name);
  const note = safeText(metadata.note);

  if (item.movement_type === "income" || item.movement_type === "expense") {
    if (categoryName) parts.push({ label: "Categoria", value: categoryName });
    if (source) parts.push({ label: "Origem", value: sourceLabels[source] ?? source });
  }

  if (item.movement_type === "card_statement_payment") {
    if (cardName) parts.push({ label: "Cartão", value: cardName });
    if (billingStatement) parts.push({ label: "Fatura", value: formatDateBR(billingStatement) });
  }

  if (item.movement_type === "transfer_in" || item.movement_type === "transfer_out") {
    if (counterpartyAccountName) parts.push({ label: item.movement_type === "transfer_in" ? "Origem" : "Destino", value: counterpartyAccountName });
    if (note) parts.push({ label: "Obs.", value: note });
  }

  return parts;
}

function safeText(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();

  if (!trimmed || trimmed === "undefined" || trimmed === "null" || trimmed === "[object Object]") return "";

  return trimmed;
}

function balanceTextClass(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";

  return "text-neutral-700";
}

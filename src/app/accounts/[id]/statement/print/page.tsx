"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DIRECTION_LABELS,
  MOVEMENT_TYPE_LABELS,
  fetchAccountStatementForPrint,
  type AccountKind,
  type AccountStatementResponse,
  type StatementDirection,
  type StatementEntry,
  type StatementMovementType,
} from "@/features/accounts";
import { useAuth } from "@/lib/useAuth";
import { formatCivilDateBR } from "@/lib/civil-date";

type PrintFilters = {
  startDate: string;
  endDate: string;
  movementType: StatementMovementType | "";
  direction: StatementDirection | "";
};

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

function isMovementType(value: string | null): value is StatementMovementType {
  return Boolean(value && value in MOVEMENT_TYPE_LABELS);
}

function isDirection(value: string | null): value is StatementDirection {
  return value === "credit" || value === "debit";
}

function readFilters(): PrintFilters {
  const params = new URLSearchParams(window.location.search);
  const movementType = params.get("movement_type");
  const direction = params.get("direction");

  return {
    startDate: params.get("start_date") ?? "",
    endDate: params.get("end_date") ?? "",
    movementType: isMovementType(movementType) ? movementType : "",
    direction: isDirection(direction) ? direction : "",
  };
}

function formatBRL(value: string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(date: string | null | undefined) {
  return date ? formatCivilDateBR(date) : "Não informado";
}

function formatPeriod(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${formatDate(startDate)} a ${formatDate(endDate)}`;
  if (startDate) return `A partir de ${formatDate(startDate)}`;
  if (endDate) return `Até ${formatDate(endDate)}`;
  return "Todo o período";
}

function errorMessageFor(error: unknown) {
  if (error instanceof Error && (error.message.includes("404") || error.message.toLowerCase().includes("not found"))) {
    return "Conta não encontrada.";
  }

  return "Não foi possível carregar o documento para impressão.";
}

function detailFor(item: StatementEntry) {
  const metadata = item.metadata ?? {};

  if (metadata.category?.name) return metadata.category.name;
  if (item.movement_type === "card_statement_payment" && metadata.card?.name) return metadata.card.name;
  if ((item.movement_type === "transfer_in" || item.movement_type === "transfer_out") && metadata.counterparty_account?.name) {
    return item.movement_type === "transfer_in" ? `Origem: ${metadata.counterparty_account.name}` : `Destino: ${metadata.counterparty_account.name}`;
  }
  if (metadata.source) return sourceLabels[metadata.source] ?? metadata.source;
  return item.description || "—";
}

export default function AccountStatementPrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const auth = useAuth();
  const accountId = Number(params.id);
  const [statement, setStatement] = useState<AccountStatementResponse | null>(null);
  const [filters, setFilters] = useState<PrintFilters>({ startDate: "", endDate: "", movementType: "", direction: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!Number.isFinite(accountId) || accountId <= 0) {
      setError("Conta não encontrada.");
      setLoading(false);
      return;
    }

    const nextFilters = readFilters();
    setFilters(nextFilters);

    try {
      setLoading(true);
      setError(null);
      const result = await fetchAccountStatementForPrint(accountId, {
        startDate: nextFilters.startDate || undefined,
        endDate: nextFilters.endDate || undefined,
        movementType: nextFilters.movementType || undefined,
        direction: nextFilters.direction || undefined,
        signal,
      });

      if (result.status === 401) {
        router.replace("/login");
        return;
      }

      setStatement(result.data);
      setGeneratedAt(new Date().toLocaleString("pt-BR"));
    } catch (loadError) {
      if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
        setError(errorMessageFor(loadError));
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [accountId, router]);

  useEffect(() => {
    if (auth.status === "unauthenticated") router.replace("/login");
  }, [auth.status, router]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [auth.status, load]);

  if (auth.status !== "authenticated") return <div className="min-h-screen bg-white" />;

  if (loading && !statement) {
    return <main className="mx-auto max-w-4xl p-8" aria-busy="true">Carregando documento para impressão...</main>;
  }

  if (error || !statement) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="text-2xl font-bold">{error ?? "Não foi possível carregar o documento para impressão."}</h1>
        <div className="print-controls mt-6 flex gap-3">
          <Button type="button" variant="outline" onClick={() => void load()}>Tentar novamente</Button>
          <Button type="button" onClick={() => router.push(`/accounts/${params.id}`)}>Voltar ao extrato</Button>
        </div>
      </main>
    );
  }

  const { account, balances, summary, items, pagination } = statement;
  const isArchived = Boolean(account.archived_at);
  const filterText = filters.movementType || filters.direction
    ? [filters.movementType && `Tipo: ${MOVEMENT_TYPE_LABELS[filters.movementType]}`, filters.direction && `Direção: ${DIRECTION_LABELS[filters.direction]}`].filter(Boolean).join(" · ")
    : "Todos os movimentos";

  return (
    <main className="min-h-screen bg-neutral-100 p-4 sm:p-8 print:bg-white print:p-0">
      <div className="print-controls mx-auto mb-5 flex max-w-[210mm] items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={() => router.push(`/accounts/${params.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao extrato
        </Button>
        <Button type="button" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir
        </Button>
      </div>

      <article className="statement-print-document mx-auto max-w-[210mm] bg-white p-6 shadow-sm sm:p-10 print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b border-neutral-300 pb-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-600">Finch</p>
          <h1 className="mt-2 text-3xl font-bold text-neutral-950">Extrato por Account</h1>
          <p className="mt-2 text-sm text-neutral-600">Gerado em {generatedAt ?? "—"}</p>
        </header>

        <section className="grid gap-4 py-6 sm:grid-cols-2" aria-labelledby="account-title">
          <div>
            <h2 id="account-title" className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Conta</h2>
            <p className="mt-1 text-lg font-semibold text-neutral-950">{account.name}</p>
            <p className="text-sm text-neutral-600">{accountKindLabels[account.kind]}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Status</h2>
            <p className="mt-1 text-lg font-semibold text-neutral-950">{isArchived ? "Arquivada" : "Ativa"}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Período</h2>
            <p className="mt-1 text-neutral-900">{formatPeriod(statement.period.start_date, statement.period.end_date)}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-600">Filtros</h2>
            <p className="mt-1 text-neutral-900">{filterText}</p>
          </div>
        </section>

        <section className="border-y border-neutral-300 py-5" aria-labelledby="summary-title">
          <h2 id="summary-title" className="text-lg font-semibold text-neutral-950">Resumo financeiro</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <PrintMetric label="Saldo de abertura" value={balances.opening_balance} />
            <PrintMetric label="Entradas" value={summary.credits_total} />
            <PrintMetric label="Saídas" value={summary.debits_total} />
            <PrintMetric label="Variação líquida" value={summary.net_total} />
            <PrintMetric label="Saldo de fechamento do período" value={balances.closing_balance} />
          </dl>
        </section>

        <section className="pt-6" aria-labelledby="movements-title">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="movements-title" className="text-lg font-semibold text-neutral-950">Movimentações</h2>
            <p className="text-sm text-neutral-600">{pagination.total_count} movimentações no período</p>
          </div>

          {items.length === 0 ? (
            <p className="mt-6 rounded border border-dashed border-neutral-300 p-5 text-center text-neutral-700">Nenhuma movimentação no período.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table>
                <thead className="border-y border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-600">
                  <tr>
                    <th className="py-3 pr-3">Data</th>
                    <th className="py-3 pr-3">Tipo</th>
                    <th className="py-3 pr-3">Descrição</th>
                    <th className="py-3 pr-3">Categoria ou detalhe</th>
                    <th className="py-3 text-right">Entrada</th>
                    <th className="py-3 text-right">Saída</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-neutral-200 align-top">
                      <td className="py-3 pr-3 whitespace-nowrap">{formatDate(item.occurred_on)}</td>
                      <td className="py-3 pr-3">{MOVEMENT_TYPE_LABELS[item.movement_type]}</td>
                      <td className="py-3 pr-3 font-medium">{item.title}</td>
                      <td className="py-3 pr-3 text-neutral-700">{detailFor(item)}</td>
                      <td className="py-3 text-right tabular-nums">{item.direction === "credit" ? formatBRL(item.amount) : "—"}</td>
                      <td className="py-3 text-right tabular-nums">{item.direction === "debit" ? formatBRL(item.amount) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </article>
    </main>
  );
}

function PrintMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-neutral-950">{formatBRL(value)}</dd>
    </div>
  );
}

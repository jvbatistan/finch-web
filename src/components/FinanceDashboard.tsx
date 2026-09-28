import {
  CheckCircle2,
  CircleDollarSign,
  ReceiptText,
  Wallet,
} from "lucide-react";
import type { DashboardOverview } from "@/features/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCivilDateBR } from "@/lib/civil-date";

type FinanceDashboardProps = {
  overview: DashboardOverview;
};

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: string;
};

function formatBRL(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function installmentLabel(expense: DashboardOverview["recent_expenses"][number]) {
  if (!expense.installment_number || !expense.installments_count) return null;
  return `${expense.installment_number}/${expense.installments_count}`;
}

function StatCard({ title, value, subtitle, icon, tone }: StatCardProps) {
  return (
    <div className="h-fit w-full self-start rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-600">{title}</p>
          <p className="mt-6 text-[2rem] font-bold leading-tight text-neutral-950">{value}</p>
          <p className="mt-2 text-xs text-neutral-500">{subtitle}</p>
        </div>

        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      </div>
    </div>
  );
}

export function FinanceDashboard({ overview }: FinanceDashboardProps) {
  const { summary, by_card, by_category, recent_expenses, statements, period } = overview;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Despesas do mês"
          value={formatBRL(summary.expenses_total)}
          subtitle={`Total consolidado em ${period.label}`}
          icon={<Wallet className="h-5 w-5 text-rose-700" />}
          tone="bg-rose-100"
        />
        <StatCard
          title="Em aberto"
          value={formatBRL(summary.open_total)}
          subtitle="Ainda pendente de pagamento"
          icon={<CircleDollarSign className="h-5 w-5 text-amber-700" />}
          tone="bg-amber-100"
        />
        <StatCard
          title="Pagas"
          value={formatBRL(summary.paid_total)}
          subtitle="Já quitadas no período"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-700" />}
          tone="bg-emerald-100"
        />
        <StatCard
          title="Transações do período"
          value={String(summary.transactions_count)}
          subtitle="Despesas consideradas no dashboard"
          icon={<ReceiptText className="h-5 w-5 text-sky-700" />}
          tone="bg-sky-100"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Totais por cartão</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">Inclui cartões e despesas lançadas sem cartão.</p>
          </CardHeader>
          <CardContent>
            {by_card.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma despesa encontrada para o período.</p>
            ) : (
              <div className="space-y-4">
                {by_card.map((entry) => (
                  <div key={`${entry.id ?? "none"}-${entry.name}`} className="rounded-2xl border border-neutral-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">{entry.name}</p>
                        <p className="mt-1 text-sm text-neutral-500">{entry.transactions_count} despesa(s)</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-neutral-900">{formatBRL(entry.total_amount)}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          Em aberto {formatBRL(entry.open_amount)} · Pagas {formatBRL(entry.paid_amount)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totais por categoria</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">Distribuição real das despesas classificadas no período.</p>
          </CardHeader>
          <CardContent>
            {by_category.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma categoria apareceu no período.</p>
            ) : (
              <div className="space-y-4">
                {by_category.map((entry) => (
                  <div key={`${entry.id ?? "none"}-${entry.name}`} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-900">{entry.name}</p>
                      <p className="mt-1 text-sm text-neutral-500">{entry.transactions_count} lançamento(s)</p>
                    </div>
                    <p className="font-semibold text-neutral-900">{formatBRL(entry.total_amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Últimas despesas cadastradas</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">Os lançamentos mais recentes adicionados ao sistema.</p>
          </CardHeader>
          <CardContent>
            {recent_expenses.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma despesa cadastrada ainda.</p>
            ) : (
              <div className="space-y-3">
                {recent_expenses.map((expense) => {
                  const label = installmentLabel(expense);
                  const isRefund = Boolean(expense.refund);

                  return (
                    <div key={expense.id} className="flex flex-col gap-2 rounded-2xl border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">
                          {expense.friendly_title || expense.description} {label ? `(${label})` : ""}
                        </p>
                        <p className="mt-1 text-sm text-neutral-500">
                          {formatCivilDateBR(expense.date)}
                          {expense.category?.name ? ` · ${expense.category.name}` : " · Sem categoria"}
                          {expense.card?.name ? ` · ${expense.card.name}` : " · Sem cartão"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={[
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                            expense.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                          ].join(" ")}
                        >
                          {expense.paid ? "Paga" : "Em aberto"}
                        </span>
                        <span className={`font-semibold ${isRefund ? "text-emerald-600" : "text-neutral-900"}`}>
                          {isRefund ? "+" : ""}
                          {formatBRL(Math.abs(Number(expense.value)))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Faturas e cartões</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">Visão resumida das faturas geradas para o período atual.</p>
          </CardHeader>
          <CardContent>
            {statements.length === 0 ? (
              <p className="text-sm text-neutral-500">Nenhuma fatura em aberto para o período.</p>
            ) : (
              <div className="space-y-3">
                {statements.map((statement) => (
                  <div key={statement.id} className="rounded-2xl border border-neutral-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-900">{statement.card.name}</p>
                        <p className="mt-1 text-sm text-neutral-500">
                          Fecha dia {statement.closing_day} · Vence dia {statement.due_day}
                        </p>
                      </div>
                      <span
                        className={[
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                          statement.paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                        ].join(" ")}
                      >
                        {statement.paid ? "Quitada" : "Em aberto"}
                      </span>
                    </div>
                    <div className="mt-4 space-y-1 text-sm text-neutral-600">
                      <div className="flex items-center justify-between gap-3">
                        <span>Total</span>
                        <span className="font-medium text-neutral-900">{formatBRL(statement.total_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Restante</span>
                        <span className="font-medium text-neutral-900">{formatBRL(statement.remaining_amount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Transações</span>
                        <span className="font-medium text-neutral-900">{statement.transactions_count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

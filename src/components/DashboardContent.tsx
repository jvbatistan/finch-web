"use client";

import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { DashboardOverview } from "@/features/dashboard";
import { CardBrandMark } from "@/components/CardBrandMark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  overview: DashboardOverview;
};

type DashboardContentProps = Props & {
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

type StatCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  iconClassName: string;
  accentClassName: string;
};

const CATEGORY_COLORS = ["#3b82f6", "#a855f7", "#10b981", "#f59e0b", "#ef4444", "#14b8a6"];

function formatBRL(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCompactBRL(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function formatDateBR(dateISO: string) {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("pt-BR");
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function installmentLabel(expense: DashboardOverview["recent_expenses"][number]) {
  if (!expense.installment_number || !expense.installments_count) return null;
  return `${expense.installment_number}/${expense.installments_count}`;
}

function StatCard({ title, value, subtitle, icon, iconClassName, accentClassName }: StatCardProps) {
  return (
    <Card className="group relative overflow-hidden rounded-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClassName}`} />
      <CardContent className="p-5 sm:p-6">
        <div className="mb-5">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-105 ${iconClassName}`}>
            {icon}
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase text-neutral-500">{title}</p>
          <p className="text-2xl font-bold leading-tight text-neutral-950 tabular-nums sm:text-3xl">{value}</p>
          <p className="text-xs leading-relaxed text-neutral-500">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStats({ overview }: Props) {
  const trendValues = overview.monthly_trend.map((entry) => Number(entry.total_amount));
  const average = trendValues.length ? trendValues.reduce((sum, value) => sum + value, 0) / trendValues.length : 0;
  const current = trendValues.at(-1) ?? 0;
  const previous = trendValues.at(-2) ?? 0;
  const change = previous > 0 ? ((current - previous) / previous) * 100 : null;
  const biggestExpense = overview.recent_expenses.reduce((biggest, expense) => Math.max(biggest, Number(expense.value)), 0);
  const nextDueDay = overview.statements
    .filter((statement) => !statement.paid)
    .map((statement) => statement.due_day)
    .sort((a, b) => a - b)[0];

  const stats = [
    { label: "Média mensal", value: average > 0 ? formatCompactBRL(average) : "Sem histórico", change },
    { label: "Maior despesa", value: biggestExpense > 0 ? formatBRL(biggestExpense) : "Sem despesas", change: null },
    { label: "Próximo vencimento", value: nextDueDay ? `Dia ${nextDueDay}` : "Sem fatura", change: null },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      {stats.map((stat, index) => {
        const isIncrease = stat.change !== null && stat.change > 0;

        return (
          <div key={stat.label} className="flex items-center gap-4">
            {index > 0 && <div className="hidden h-8 w-px bg-neutral-200 sm:block" />}
            <div>
              <p className="text-xs text-neutral-500">{stat.label}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <p className="text-sm font-bold text-neutral-950 tabular-nums">{stat.value}</p>
                {stat.change !== null && (
                  <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${isIncrease ? "text-rose-600" : "text-emerald-600"}`}>
                    {isIncrease ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {Math.abs(stat.change).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyTrend({ overview }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const data = overview.monthly_trend;
  const values = data.map((entry) => Number(entry.total_amount));
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);
  const current = values.at(-1) ?? 0;
  const previous = values.at(-2) ?? 0;
  const variation = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const isIncrease = variation > 0;
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const width = 640;
  const height = 220;
  const paddingX = 34;
  const paddingY = 20;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const points = data.map((entry, index) => {
    const x = paddingX + (chartWidth / Math.max(data.length - 1, 1)) * index;
    const y = paddingY + chartHeight - ((Number(entry.total_amount) - minValue) / range) * chartHeight;
    return { ...entry, x, y };
  });
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = points.length ? `${paddingX},${height - paddingY} ${linePoints} ${width - paddingX},${height - paddingY}` : "";
  const activePoint = activeIndex !== null ? points[activeIndex] : null;
  const tooltipWidth = 156;
  const tooltipHeight = 54;
  const tooltipX = activePoint
    ? Math.min(Math.max(activePoint.x - tooltipWidth / 2, 8), width - tooltipWidth - 8)
    : 0;
  const tooltipY = activePoint ? Math.max(activePoint.y - tooltipHeight - 16, 8) : 0;

  return (
    <Card className="rounded-lg transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Evolução mensal de despesas</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">Acompanhamento real dos últimos 7 meses</p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5">
            {isIncrease ? <ArrowUpRight className="h-4 w-4 text-rose-500" /> : <ArrowDownRight className="h-4 w-4 text-emerald-500" />}
            <span className={`text-sm font-bold tabular-nums ${isIncrease ? "text-rose-600" : "text-emerald-600"}`}>
              {previous > 0 ? `${isIncrease ? "+" : ""}${variation.toFixed(1)}%` : "0,0%"}
            </span>
            <span className="text-xs text-neutral-500">vs. anterior</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-neutral-100 bg-neutral-50 p-4">
          <MiniMetric label="Média" value={formatCompactBRL(average)} />
          <MiniMetric label="Maior" value={formatCompactBRL(maxValue)} className="text-rose-600" />
          <MiniMetric label="Menor" value={formatCompactBRL(minValue)} className="text-emerald-600" />
        </div>
      </CardHeader>
      <CardContent>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[260px] w-full overflow-visible"
          role="img"
          aria-label="Gráfico de evolução mensal de despesas"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="monthlyTrendFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity="0.32" />
              <stop offset="95%" stopColor="#ef4444" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((tick) => {
            const y = paddingY + (chartHeight / 3) * tick;
            return <line key={tick} x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />;
          })}
          {areaPoints && <polygon points={areaPoints} fill="url(#monthlyTrendFill)" />}
          {linePoints && <polyline points={linePoints} fill="none" stroke="#ef4444" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />}
          {activePoint && (
            <g className="pointer-events-none transition-opacity duration-150">
              <line x1={activePoint.x} x2={activePoint.x} y1={paddingY} y2={height - paddingY} stroke="#fca5a5" strokeDasharray="4 4" strokeWidth="1.5" />
              <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="10" fill="#ffffff" stroke="#e5e7eb" filter="drop-shadow(0 8px 16px rgb(15 23 42 / 0.14))" />
              <text x={tooltipX + 12} y={tooltipY + 21} fill="#525252" fontSize="12">
                {activePoint.label}/{activePoint.year}
              </text>
              <text x={tooltipX + 12} y={tooltipY + 41} fill="#111827" fontSize="14" fontWeight="700">
                {formatBRL(Number(activePoint.total_amount))}
              </text>
            </g>
          )}
          {points.map((point, index) => {
            const isActive = activeIndex === index;

            return (
            <g key={`${point.month}-${point.year}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={isActive ? "8" : "4.5"}
                fill="#ef4444"
                stroke="#fff"
                strokeWidth={isActive ? "3" : "2"}
                className="transition-all duration-150"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r="16"
                fill="transparent"
                className="cursor-pointer outline-none"
                tabIndex={0}
                role="button"
                aria-label={`${point.label}/${point.year}: ${formatBRL(Number(point.total_amount))}`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
              />
              <text x={point.x} y={height - 2} fill="#737373" fontSize="12" textAnchor="middle">
                {point.label}
              </text>
            </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value, className = "text-neutral-950" }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-neutral-500">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${className}`}>{value}</p>
    </div>
  );
}

function CategoryCards({ overview }: Props) {
  const total = overview.by_category.reduce((sum, entry) => sum + Number(entry.total_amount), 0);
  let offset = 0;
  const gradient = overview.by_category.length
    ? overview.by_category
        .map((entry, index) => {
          const share = (Number(entry.total_amount) / Math.max(total, 1)) * 100;
          const start = offset;
          offset += share;
          return `${CATEGORY_COLORS[index % CATEGORY_COLORS.length]} ${start}% ${offset}%`;
        })
        .join(", ")
    : "#e5e7eb 0% 100%";

  return (
    <Card className="overflow-hidden rounded-lg transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle>Despesas por categoria</CardTitle>
        <p className="mt-1 text-sm text-neutral-500">Distribuição real das despesas classificadas no período.</p>
      </CardHeader>
      <CardContent>
        {overview.by_category.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma categoria apareceu no período.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
            <div className="flex items-center justify-center md:col-span-2">
              <div className="relative h-48 w-48 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
                <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
                  <p className="text-2xl font-bold text-neutral-950">{overview.by_category.length}</p>
                  <p className="text-xs text-neutral-500">categorias</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 md:col-span-3">
              {overview.by_category.map((entry, index) => {
                const entryPercent = percent(Number(entry.total_amount), total);
                const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                return (
                  <div key={`${entry.id ?? "none"}-${entry.name}`} className="rounded-lg p-3 transition hover:bg-neutral-50">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                        <p className="truncate font-semibold text-neutral-950">{entry.name}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-bold text-neutral-700 tabular-nums">{entryPercent}%</span>
                        <span className="min-w-[104px] text-right font-bold text-neutral-950 tabular-nums">{formatBRL(Number(entry.total_amount))}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full" style={{ width: `${entryPercent}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-xs text-neutral-500">{entry.transactions_count} lançamentos</span>
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 border-t border-neutral-200 px-3 pt-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-neutral-600">Total</p>
                  <p className="text-lg font-bold text-neutral-950 tabular-nums">{formatBRL(total)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CreditCardSummary({ overview }: Props) {
  const entries = overview.statements.length
    ? overview.statements.map((statement) => ({
        id: statement.id,
        name: statement.card.name,
        transactions: statement.transactions_count,
        openAmount: Number(statement.remaining_amount),
        paidAmount: Number(statement.paid_amount),
        totalAmount: Number(statement.total_amount),
        meta: `Fecha dia ${statement.closing_day} · Vence dia ${statement.due_day}`,
      }))
    : overview.by_card.map((card) => ({
        id: card.id ?? card.name,
        name: card.name,
        transactions: card.transactions_count,
        openAmount: Number(card.open_amount),
        paidAmount: Number(card.paid_amount),
        totalAmount: Number(card.total_amount),
        meta: card.id ? "Fatura não gerada para o período" : "Despesas sem cartão",
      }));
  const totalOpen = entries.reduce((sum, entry) => sum + entry.openAmount, 0);

  return (
    <Card className="rounded-lg transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle>Faturas e cartões</CardTitle>
        <p className="mt-1 text-sm text-neutral-500">Visão resumida das faturas geradas para o período atual.</p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhuma fatura em aberto para o período.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const paidPercentage = percent(entry.paidAmount, entry.totalAmount);
              return (
                <div key={entry.id} className="rounded-lg border border-neutral-200 p-4 transition hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-md">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CardBrandMark cardName={entry.name} size="sm" />
                      <div>
                        <p className="font-bold text-neutral-950">{entry.name}</p>
                        <p className="text-xs text-neutral-500">{entry.transactions} transações</p>
                      </div>
                    </div>
                    <div className="hidden items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 sm:flex">
                      <Calendar className="h-3 w-3 text-amber-600" />
                      <span className="text-xs font-medium text-amber-700">{entry.meta}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-xs text-neutral-500">Total da fatura</p>
                        <p className="text-xl font-bold text-neutral-950 tabular-nums">{formatBRL(entry.totalAmount)}</p>
                      </div>
                      <div className="flex gap-4 text-left sm:text-right">
                        <MiniMetric label="Em aberto" value={formatBRL(entry.openAmount)} className="text-amber-600" />
                        <MiniMetric label="Pago" value={formatBRL(entry.paidAmount)} className="text-emerald-600" />
                      </div>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div className="absolute h-full bg-emerald-500" style={{ width: `${paidPercentage}%` }} />
                      <div className="absolute h-full bg-amber-500" style={{ left: `${paidPercentage}%`, width: `${100 - paidPercentage}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="mt-2 border-t border-neutral-200 px-2 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Total em aberto</p>
                  <p className="text-lg font-bold text-neutral-950 tabular-nums">{formatBRL(totalOpen)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-500 tabular-nums">{entries.length} cartões/faturas</p>
                  <p className="text-xs text-neutral-500 tabular-nums">{entries.reduce((sum, entry) => sum + entry.transactions, 0)} transações</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionList({ overview }: Props) {
  return (
    <Card className="rounded-lg transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle>Últimas despesas cadastradas</CardTitle>
        <p className="mt-1 text-sm text-neutral-500">Os lançamentos mais recentes adicionados ao sistema.</p>
      </CardHeader>
      <CardContent className="px-0">
        {overview.recent_expenses.length === 0 ? (
          <p className="px-6 text-sm text-neutral-500">Nenhuma despesa cadastrada ainda.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {overview.recent_expenses.slice(0, 8).map((expense) => {
              const label = installmentLabel(expense);
              const isRefund = Boolean(expense.refund);
              return (
                <div key={expense.id} className="px-5 py-3.5 transition hover:bg-indigo-50/40 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                        <ShoppingBag className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-neutral-950">
                          {expense.description} {label ? `(${label})` : ""}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-neutral-500">{formatDateBR(expense.date)}</span>
                          <span className="text-xs text-neutral-300">•</span>
                          <span className="text-xs text-neutral-500">{expense.category?.name ?? "Sem categoria"}</span>
                          <span className="text-xs text-neutral-300">•</span>
                          <span className="text-xs text-neutral-500">{expense.card?.name ?? "Sem cartão"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${expense.paid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                        {expense.paid ? "Paga" : "Em aberto"}
                      </span>
                      <span className={`min-w-[100px] text-right font-bold tabular-nums ${isRefund ? "text-emerald-600" : "text-neutral-950"}`}>
                        {isRefund ? "+" : ""}
                        {formatBRL(Math.abs(Number(expense.value)))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CashFlowCard({ overview }: Props) {
  const { summary, period } = overview;
  const incomesTotal = Number(summary.incomes_total);
  const expensesTotal = Number(summary.expenses_total);
  const balanceTotal = Number(summary.balance_total);
  const maxTotal = Math.max(incomesTotal, expensesTotal, 1);
  const balanceIsPositive = balanceTotal >= 0;

  return (
    <Card className="h-full rounded-lg transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle>Receitas vs despesas</CardTitle>
        <p className="mt-1 text-sm text-neutral-500">Entradas, saídas e saldo líquido em {period.label}.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-neutral-600">Receitas</span>
                <span className="font-bold text-emerald-600 tabular-nums">{formatBRL(incomesTotal)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${percent(incomesTotal, maxTotal)}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-neutral-600">Despesas</span>
                <span className="font-bold text-rose-600 tabular-nums">{formatBRL(expensesTotal)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${percent(expensesTotal, maxTotal)}%` }} />
              </div>
            </div>
          </div>
          <div className={`rounded-lg border p-4 ${balanceIsPositive ? "border-emerald-100 bg-emerald-50" : "border-rose-100 bg-rose-50"}`}>
            <p className={`text-xs font-semibold uppercase ${balanceIsPositive ? "text-emerald-700" : "text-rose-700"}`}>Saldo do mês</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${balanceIsPositive ? "text-emerald-700" : "text-rose-700"}`}>
              {formatBRL(balanceTotal)}
            </p>
            <p className="mt-1 text-xs text-neutral-600">
              {balanceIsPositive ? "Entrou mais dinheiro do que saiu no período." : "As despesas superaram as receitas do período."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentStatusCard({ overview }: Props) {
  const { summary } = overview;
  const openTotal = Number(summary.open_total);
  const paidTotal = Number(summary.paid_total);
  const total = Math.max(openTotal + paidTotal, 1);

  return (
    <Card className="h-full rounded-lg transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle>Status das despesas</CardTitle>
        <p className="mt-1 text-sm text-neutral-500">Quanto já foi quitado e quanto ainda está em aberto no mês.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Pagas</p>
              <p className="mt-1 text-lg font-bold text-emerald-700 tabular-nums">{formatBRL(paidTotal)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs text-amber-700">Em aberto</p>
              <p className="mt-1 text-lg font-bold text-amber-700 tabular-nums">{formatBRL(openTotal)}</p>
            </div>
          </div>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-neutral-100">
            <div className="absolute h-full bg-emerald-500" style={{ width: `${percent(paidTotal, total)}%` }} />
            <div className="absolute h-full bg-amber-500" style={{ left: `${percent(paidTotal, total)}%`, width: `${percent(openTotal, total)}%` }} />
          </div>
          <p className="text-xs text-neutral-500">
            {summary.transactions_count} lançamento(s) financeiro(s) considerados no período.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardContent({ overview, onPreviousMonth, onNextMonth }: DashboardContentProps) {
  const { summary, period } = overview;
  const balanceTotal = Number(summary.balance_total);
  const balanceIsPositive = balanceTotal >= 0;

  return (
    <div className="space-y-6 lg:space-y-8">
      <header className="pb-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-neutral-950">Dashboard</h1>
            <p className="mt-1.5 text-neutral-500">Panorama real das receitas, despesas, faturas e lançamentos recentes.</p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-1 sm:w-auto">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={onPreviousMonth}
                className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <p className="min-w-32 text-center text-sm font-semibold text-neutral-900">
                {capitalize(overview.period.label)}
              </p>
              <button
                type="button"
                aria-label="Mês seguinte"
                onClick={onNextMonth}
                className="rounded-md p-2 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <QuickStats overview={overview} />
          </div>
        </div>
      </header>

      <section aria-label="Indicadores principais" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Receitas do mês" value={formatBRL(Number(summary.incomes_total))} subtitle={`Entradas recebidas em ${period.label}`} icon={<ArrowDownRight className="h-6 w-6 text-white" />} iconClassName="bg-emerald-600" accentClassName="bg-emerald-500" />
        <StatCard title="Despesas do mês" value={formatBRL(Number(summary.expenses_total))} subtitle={`Total consolidado em ${period.label}`} icon={<Receipt className="h-6 w-6 text-white" />} iconClassName="bg-rose-600" accentClassName="bg-rose-500" />
        <StatCard title="Saldo do mês" value={formatBRL(balanceTotal)} subtitle="Receitas menos despesas" icon={balanceIsPositive ? <ArrowUpRight className="h-6 w-6 text-white" /> : <AlertCircle className="h-6 w-6 text-white" />} iconClassName={balanceIsPositive ? "bg-blue-600" : "bg-rose-600"} accentClassName={balanceIsPositive ? "bg-blue-500" : "bg-rose-500"} />
        <StatCard title="Transações do período" value={String(summary.transactions_count)} subtitle="Receitas e despesas consideradas" icon={<FileText className="h-6 w-6 text-white" />} iconClassName="bg-indigo-600" accentClassName="bg-indigo-500" />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6" aria-label="Análise visual">
        <div className="lg:col-span-2">
          <MonthlyTrend overview={overview} />
        </div>
        <CashFlowCard overview={overview} />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6" aria-label="Distribuição financeira">
        <CategoryCards overview={overview} />
        <CreditCardSummary overview={overview} />
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6" aria-label="Transações recentes">
        <div className="lg:col-span-2">
          <TransactionList overview={overview} />
        </div>
        <PaymentStatusCard overview={overview} />
      </section>
    </div>
  );
}

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

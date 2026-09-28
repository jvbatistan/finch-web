"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  DollarSign,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { CardBrandMark } from "@/components/CardBrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectTriggerHTML } from "@/components/ui/select";
import { useAccounts } from "@/features/accounts";
import { ignoreCardStatement, ignoreLooseExpense, payCardStatement, payLooseExpense, payLooseExpenses, usePayments } from "@/features/payments";
import { getCardBrandPresentation } from "@/lib/cardBrand";
import { useAuth } from "@/lib/useAuth";

const monthOptions = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const currentYear = new Date().getFullYear();
const looseAccountRequiredMessage = "Selecione a conta usada no pagamento da despesa.";
const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 2 + index).map((year) => ({
  value: String(year),
  label: String(year),
}));

function formatBRL(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateBR(dateISO: string) {
  return new Date(`${dateISO}T12:00:00`).toLocaleDateString("pt-BR");
}

function formatDateTimeBR(dateISO: string) {
  return new Date(dateISO).toLocaleDateString("pt-BR");
}

function periodLabel(month: string, year: string) {
  const monthLabel = monthOptions.find((option) => option.value === month)?.label ?? month;
  return `${monthLabel}/${year}`;
}

function localDateISO() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function renderInstallmentLabel(transaction: {
  installment_number?: number | null;
  installments_count?: number | null;
}) {
  if (!transaction.installment_number || !transaction.installments_count) return null;
  return `(${transaction.installment_number}/${transaction.installments_count})`;
}

type StatementReference = { id: number | null; card: { id: number; name: string }; billing_statement: string };
type PaymentConfirmation =
  | { kind: "statement"; statement: StatementReference; amount: number }
  | { kind: "ignore-statement"; statement: StatementReference; amount: number; period: string }
  | { kind: "loose-expense"; transactionId: number; description: string; amount: number; paymentsTotal: number; remainingAmount: number }
  | { kind: "ignore-loose-expense"; transactionId: number; description: string; amount: number; period: string }
  | { kind: "loose-expenses"; count: number; totalAmount: number; period: string };

export default function PaymentsPage() {
  const router = useRouter();
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<"statements" | "loose" | "ignored">("statements");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(currentYear));
  const [message, setMessage] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<PaymentConfirmation | null>(null);
  const [statementAccountId, setStatementAccountId] = useState("none");
  const [statementPaymentAmount, setStatementPaymentAmount] = useState("");
  const [looseAccountId, setLooseAccountId] = useState("none");
  const [looseSettledOn, setLooseSettledOn] = useState(localDateISO);
  const [looseSettledValue, setLooseSettledValue] = useState("");
  const [looseSettle, setLooseSettle] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => router.replace("/login"), [router]);

  useEffect(() => {
    if (auth.status === "unauthenticated") router.replace("/login");
  }, [auth.status, router]);

  const { overview, loading, error, refetch } = usePayments({
    month: Number(month),
    year: Number(year),
    enabled: auth.status === "authenticated",
    onUnauthorized: handleUnauthorized,
  });
  const { accounts, loading: accountsLoading, error: accountsError } = useAccounts({
    enabled: auth.status === "authenticated",
    onUnauthorized: handleUnauthorized,
  });

  const statements = useMemo(
    () => (overview?.statements ?? []).filter((statement) => Number(statement.total_amount) > 0),
    [overview]
  );
  const looseExpenses = overview?.loose_expenses;
  const ignoredPayments = overview?.ignored_payments;

  const outstandingStatements = useMemo(
    () => statements.filter((statement) => !statement.paid),
    [statements]
  );

  const totalOpenStatements = useMemo(
    () => outstandingStatements.reduce((sum, statement) => sum + Number(statement.remaining_amount), 0),
    [outstandingStatements]
  );

  const totalLooseExpenses = Number(looseExpenses?.total_amount ?? 0);
  const totalIgnoredPayments = Number(ignoredPayments?.statements_total_amount ?? 0) + Number(ignoredPayments?.loose_expenses.total_amount ?? 0);
  const ignoredItemsCount = Number(ignoredPayments?.statements_count ?? 0) + Number(ignoredPayments?.loose_expenses.transactions_count ?? 0);
  const isSubmittingLooseExpenses =
    submittingKey === "loose-expenses" ||
    submittingKey?.startsWith("loose-expense-") === true ||
    submittingKey?.startsWith("ignore-loose-expense-") === true;
  const accountOptions = useMemo(
    () => [
      { value: "none", label: "Selecione a conta de onde saiu o dinheiro" },
      ...accounts.map((account) => ({ value: String(account.id), label: account.name })),
    ],
    [accounts]
  );
  const hasAccounts = accounts.length > 0;

  async function submitPayStatement(statement: StatementReference, accountId: number, amount: number) {
    try {
      setSubmittingKey(`statement-${statement.id ?? `${statement.card.id}-${statement.billing_statement}`}`);
      setMessage(null);
      setConfirmationError(null);
      const result = await payCardStatement(statement, { accountId, amount });
      if (result.status === 401) {
        handleUnauthorized();
        return false;
      }
      setMessage(result.data?.paid ? `Fatura do cartão "${result.data?.card.name}" quitada com sucesso.` : `Pagamento da fatura do cartão "${result.data?.card.name}" registrado com sucesso.`);
      await refetch();
      return true;
    } catch (err) {
      setConfirmationError(err instanceof Error ? err.message : "Não foi possível registrar o pagamento da fatura.");
      return false;
    } finally {
      setSubmittingKey(null);
    }
  }

  async function submitIgnoreStatement(statement: StatementReference) {
    try {
      setSubmittingKey(`ignore-statement-${statement.id ?? `${statement.card.id}-${statement.billing_statement}`}`);
      setMessage(null);
      const result = await ignoreCardStatement(statement, Number(month), Number(year));
      if (result.status === 401) {
        handleUnauthorized();
        return;
      }
      setMessage(`Fatura do cartão "${statement.card.name}" removida do fluxo de pagamento de ${periodLabel(month, year)}.`);
      await refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível remover a fatura do fluxo de pagamento.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function submitPayLooseExpense(transactionId: number, description: string, accountId: number, settledOn: string, settledValue: number, settle: boolean) {
    try {
      setSubmittingKey(`loose-expense-${transactionId}`);
      setMessage(null);
      setConfirmationError(null);
      const result = await payLooseExpense(transactionId, Number(month), Number(year), accountId, settledOn, settledValue, settle);
      if (result.status === 401) {
        handleUnauthorized();
        return false;
      }
      setMessage(settle ? `Despesa "${description}" quitada.` : `Pagamento parcial da despesa "${description}" registrado.`);
      await refetch();
      return true;
    } catch (err) {
      setConfirmationError(err instanceof Error ? err.message : "Não foi possível quitar a despesa avulsa.");
      return false;
    } finally {
      setSubmittingKey(null);
    }
  }

  async function submitIgnoreLooseExpense(transactionId: number, description: string) {
    try {
      setSubmittingKey(`ignore-loose-expense-${transactionId}`);
      setMessage(null);
      const result = await ignoreLooseExpense(transactionId, Number(month), Number(year));
      if (result.status === 401) {
        handleUnauthorized();
        return;
      }
      setMessage(`Despesa "${description}" removida do fluxo de pagamento de ${periodLabel(month, year)}.`);
      await refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Não foi possível remover a despesa avulsa do fluxo de pagamento.");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function submitPayLooseExpenses(accountId: number, settledOn: string) {
    try {
      setSubmittingKey("loose-expenses");
      setMessage(null);
      setConfirmationError(null);
      const result = await payLooseExpenses(Number(month), Number(year), accountId, settledOn);
      if (result.status === 401) {
        handleUnauthorized();
        return false;
      }
      setMessage(`${result.data?.paid_transactions_count ?? 0} despesas avulsas marcadas como pagas.`);
      await refetch();
      return true;
    } catch (err) {
      setConfirmationError(err instanceof Error ? err.message : "Não foi possível quitar as despesas avulsas.");
      return false;
    } finally {
      setSubmittingKey(null);
    }
  }

  async function handleConfirmPayment() {
    if (!confirmation) return;

    const current = confirmation;

    if (current.kind === "statement" && statementAccountId === "none") {
      setConfirmationError("Selecione a conta de onde saiu o pagamento da fatura.");
      return;
    }

    if (current.kind === "statement" && (!(Number(statementPaymentAmount) > 0) || Number(statementPaymentAmount) > current.amount)) {
      setConfirmationError(`Informe um valor maior que zero e de até ${formatBRL(current.amount)}.`);
      return;
    }

    if ((current.kind === "loose-expense" || current.kind === "loose-expenses") && looseAccountId === "none") {
      setConfirmationError(looseAccountRequiredMessage);
      return;
    }

    if ((current.kind === "loose-expense" || current.kind === "loose-expenses") && !looseSettledOn) {
      setConfirmationError("Informe a data efetiva do pagamento.");
      return;
    }

    if (current.kind === "loose-expense" && !(Number(looseSettledValue) > 0)) {
      setConfirmationError("Informe o valor efetivamente pago.");
      return;
    }

    if (current.kind === "statement") {
      if (await submitPayStatement(current.statement, Number(statementAccountId), Number(statementPaymentAmount))) {
        setConfirmation(null);
        setStatementAccountId("none");
        setStatementPaymentAmount("");
      }
      return;
    }

    if (current.kind === "ignore-statement") {
      await submitIgnoreStatement(current.statement);
      return;
    }

    if (current.kind === "loose-expense") {
      if (await submitPayLooseExpense(current.transactionId, current.description, Number(looseAccountId), looseSettledOn, Number(looseSettledValue), looseSettle)) {
        setConfirmation(null);
        setLooseAccountId("none");
        setLooseSettledValue("");
      }
      return;
    }

    if (current.kind === "ignore-loose-expense") {
      await submitIgnoreLooseExpense(current.transactionId, current.description);
      return;
    }

    if (await submitPayLooseExpenses(Number(looseAccountId), looseSettledOn)) {
      setConfirmation(null);
      setLooseAccountId("none");
    }
  }

  if (auth.status !== "authenticated") {
    return <div className="min-h-screen bg-neutral-50" />;
  }

  return (
    <>
      <AppLayout>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Pagamentos</h1>
                <p className="mt-1 text-sm text-neutral-500 sm:text-base">
                  Acompanhe suas faturas e quite despesas avulsas sem precisar editar transação por transação.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={month} onValueChange={setMonth}>
                  <SelectTriggerHTML placeholder="Mês" options={monthOptions} className="w-full sm:w-[140px]" />
                </Select>
                <Select value={year} onValueChange={setYear}>
                  <SelectTriggerHTML placeholder="Ano" options={yearOptions} className="w-full sm:w-[110px]" />
                </Select>
              </div>
            </div>

            {message && (
              <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">{message}</p>
            )}

            {error && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>
            )}

            {accountsError && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{accountsError}</p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-4 md:gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-500">Faturas em aberto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-neutral-900 sm:text-3xl">{outstandingStatements.length}</div>
                  <p className="mt-1 text-xs text-neutral-500">No período {periodLabel(month, year)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-500">Total em aberto</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600 sm:text-3xl">{formatBRL(totalOpenStatements)}</div>
                  <p className="mt-1 text-xs text-neutral-500">Somatória total das faturas não pagas</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-500">Despesas avulsas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600 sm:text-3xl">{formatBRL(totalLooseExpenses)}</div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {looseExpenses?.transactions_count ?? 0} despesa(s) sem cartão no período
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-500">Ficaram devendo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600 sm:text-3xl">{formatBRL(totalIgnoredPayments)}</div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {ignoredItemsCount} item(ns) fora do fluxo
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="inline-flex w-full max-w-[520px] rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab("statements")}
                className={[
                  "flex-1 rounded-xl px-4 py-2 text-sm transition",
                  activeTab === "statements"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100",
                ].join(" ")}
              >
                Faturas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("loose")}
                className={[
                  "flex-1 rounded-xl px-4 py-2 text-sm transition",
                  activeTab === "loose"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100",
                ].join(" ")}
              >
                Avulsas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ignored")}
                className={[
                  "flex-1 rounded-xl px-4 py-2 text-sm transition",
                  activeTab === "ignored"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100",
                ].join(" ")}
              >
                Devendo
              </button>
            </div>

            {activeTab === "statements" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Faturas do período</CardTitle>
                  <p className="mt-1 text-sm text-neutral-500">
                    Quite o cartão inteiro de uma vez. O sistema marca as transações da fatura como pagas automaticamente.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? (
                    <p className="text-sm text-neutral-500">Carregando faturas...</p>
                  ) : statements.length === 0 ? (
                    <div className="py-12 text-center">
                      <CreditCard className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
                      <h3 className="mb-2 text-lg font-medium text-neutral-900">Nenhuma fatura encontrada</h3>
                      <p className="text-neutral-500">Não há faturas para o período selecionado.</p>
                    </div>
                  ) : (
                    statements.map((statement) => {
                      const isSubmitting = submittingKey === `statement-${statement.id}`;
                      const isIgnoring = submittingKey === `ignore-statement-${statement.id}`;
                      const isPaid = statement.paid;
                      const isPartiallyPaid = statement.payment_status === "partially_paid" || (!isPaid && Number(statement.paid_amount) > 0);
                      const brand = getCardBrandPresentation(statement.card.name);
                      const balanceBackground = {
                        backgroundColor: brand.solidColor,
                        backgroundImage: `linear-gradient(135deg, ${brand.solidColor} 0%, rgba(15, 23, 42, 0.16) 100%)`,
                      };

                      return (
                        <div
                          key={statement.id}
                          className="rounded-2xl border border-neutral-200 p-4 transition-colors hover:bg-neutral-50 md:p-6"
                        >
                          <div className="mb-4 flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <CardBrandMark cardName={statement.card.name} size="md" emphasize />
                              <div>
                                <div className="text-lg font-bold text-neutral-900">{statement.card.name}</div>
                                <div className="text-sm text-neutral-500">
                                  Fecha dia {statement.closing_day} • Vence dia {statement.due_day}
                                </div>
                              </div>
                            </div>

                            <div
                              className={[
                                "flex items-center gap-2 rounded-full px-3 py-1 text-sm",
                                isPaid ? "bg-emerald-50 text-emerald-700" : isPartiallyPaid ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700",
                              ].join(" ")}
                            >
                              {isPaid ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                              <span>{isPaid ? "Paga" : isPartiallyPaid ? "Parcialmente paga" : "Em aberto"}</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>Fecha dia {statement.closing_day}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                <span>Vence dia {statement.due_day}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                <span>{statement.transactions_count} transações</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                              <div
                                className="min-w-[220px] rounded-2xl p-4 text-white shadow-lg shadow-neutral-200/70"
                                style={balanceBackground}
                              >
                                <div className="mb-1 text-xs opacity-90">Saldo da fatura</div>
                                <div className="text-2xl font-bold">{formatBRL(statement.remaining_amount)}</div>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs opacity-90">
                                  <span>Total: {formatBRL(statement.total_amount)}</span>
                                  <span>•</span>
                                  <span>Pago: {formatBRL(statement.paid_amount)}</span>
                                </div>
                              </div>

                              {isPaid ? (
                                <Button variant="outline" className="w-full sm:w-auto" disabled>
                                  Fatura quitada
                                </Button>
                              ) : (
                                <div className="flex w-full flex-col gap-2 sm:w-auto">
                                  <Button
                                    onClick={() => {
                                      setStatementAccountId("none");
                                      setStatementPaymentAmount(String(statement.remaining_amount));
                                      setMessage(null);
                                      setConfirmationError(null);
                                      setConfirmation({
                                        kind: "statement",
                                        statement,
                                        amount: Number(statement.remaining_amount),
                                      });
                                    }}
                                    disabled={isSubmitting || isIgnoring}
                                    className="w-full bg-neutral-900 text-white hover:bg-neutral-800 sm:w-auto"
                                  >
                                    {isSubmitting ? "Registrando pagamento..." : "Registrar pagamento"}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setConfirmation({
                                      kind: "ignore-statement",
                                      statement,
                                      amount: Number(statement.remaining_amount),
                                      period: periodLabel(month, year),
                                    })}
                                    disabled={isSubmitting || isIgnoring}
                                    className="w-full border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 sm:w-auto"
                                  >
                                    {isIgnoring ? "Atualizando..." : "Não pagar"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {statement.payments && statement.payments.length > 0 && (
                            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                              <div className="mb-2 text-sm font-semibold text-emerald-900">Pagamentos registrados</div>
                              <div className="space-y-2">
                                {statement.payments.map((payment) => (
                                  <div key={payment.id} className="flex flex-col gap-1 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
                                    <span className="truncate">
                                      {formatDateTimeBR(payment.paid_at)} · {payment.description || "Pagamento da fatura"}
                                      {payment.account ? ` · ${payment.account.name}` : ""}
                                    </span>
                                    <span className="font-bold tabular-nums">{formatBRL(Number(payment.amount))}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            ) : activeTab === "loose" ? (
              <Card>
                <CardHeader>
                  <CardTitle>Despesas avulsas</CardTitle>
                  <p className="mt-1 text-sm text-neutral-500">
                    Pague uma despesa por vez quando precisar ou quite tudo de uma vez quando já tiver o valor completo.
                  </p>
                </CardHeader>
                <CardContent>
                  {!loading && looseExpenses && looseExpenses.transactions_count > 0 && (
                    <div className="mb-6 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 p-6 text-white">
                      <div className="mb-2 text-sm opacity-90">Somatória das despesas avulsas</div>
                      <div className="mb-3 text-3xl font-bold">{formatBRL(totalLooseExpenses)}</div>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="flex items-center gap-2 text-sm opacity-90">
                          <DollarSign className="h-4 w-4" />
                          <span>{looseExpenses.transactions_count} despesa(s) no período</span>
                        </div>
                        <div className="flex flex-col gap-3 sm:items-end">
                          <p className="text-sm opacity-90">Você pode marcar cada despesa individualmente ou quitar tudo de uma vez.</p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setLooseAccountId("none");
                              setLooseSettledOn(localDateISO());
                              setLooseSettledValue("");
                              setConfirmationError(null);
                              setConfirmation({
                                kind: "loose-expenses",
                                count: looseExpenses.transactions_count,
                                totalAmount: totalLooseExpenses,
                                period: periodLabel(month, year),
                              });
                            }}
                            disabled={isSubmittingLooseExpenses}
                            className="border-white/70 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          >
                            {submittingKey === "loose-expenses" ? "Marcando tudo..." : "Pagar todas as despesas"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {loading ? (
                    <p className="text-sm text-neutral-500">Carregando despesas avulsas...</p>
                  ) : !looseExpenses || looseExpenses.transactions_count === 0 ? (
                    <div className="py-12 text-center">
                      <CircleDollarSign className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
                      <h3 className="mb-2 text-lg font-medium text-neutral-900">Nenhuma despesa avulsa</h3>
                      <p className="text-neutral-500">Não há despesas avulsas para o período selecionado.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="mb-2 text-sm font-medium text-neutral-500">Descrição / Valor</div>
                      {looseExpenses.transactions.map((transaction) => {
                        const isSubmitting = submittingKey === `loose-expense-${transaction.id}`;
                        const isIgnoring = submittingKey === `ignore-loose-expense-${transaction.id}`;
                        const installmentLabel = renderInstallmentLabel(transaction);

                        return (
                          <div
                            key={transaction.id}
                            className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-neutral-900">
                                {transaction.description} {installmentLabel}
                              </div>
                              {transaction.note && (
                                <div className="mt-1 text-xs text-neutral-500">{transaction.note}</div>
                              )}
                              {transaction.payment_status === "partially_paid" && (
                                <div className="mt-1 text-xs font-medium text-amber-700">Parcialmente paga · Pago {formatBRL(Number(transaction.payments_total ?? 0))} · Saldo {formatBRL(Number(transaction.remaining_amount ?? transaction.value))}</div>
                              )}
                              {(transaction.payments?.length ?? 0) > 0 && (
                                <div className="mt-1 space-y-1 text-xs text-neutral-500">{transaction.payments?.map((payment) => <div key={payment.id}>{formatDateBR(payment.settled_on)} · {payment.account.name} · {formatBRL(payment.amount)}</div>)}</div>
                              )}
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                              <div className="text-right">
                                <div className="text-lg font-bold text-neutral-900">{formatBRL(transaction.value)}</div>
                                <div className="mt-1 text-sm text-neutral-500">{formatDateBR(transaction.date)}</div>
                              </div>
                              <div className="flex flex-col gap-2 sm:w-[132px]">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setLooseAccountId(transaction.account?.id ? String(transaction.account.id) : "none");
                                    setLooseSettledOn(localDateISO());
                                    setLooseSettledValue(String(transaction.remaining_amount ?? transaction.value));
                                    setLooseSettle(false);
                                    setConfirmationError(null);
                                    setConfirmation({
                                      kind: "loose-expense",
                                      transactionId: transaction.id,
                                      description: transaction.description,
                                      amount: Number(transaction.value),
                                      paymentsTotal: Number(transaction.payments_total ?? 0),
                                      remainingAmount: Number(transaction.remaining_amount ?? transaction.value),
                                    });
                                  }}
                                  disabled={isSubmittingLooseExpenses}
                                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                  {isSubmitting ? "Registrando..." : "Pagar despesa"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmation({
                                    kind: "ignore-loose-expense",
                                    transactionId: transaction.id,
                                    description: transaction.description,
                                    amount: Number(transaction.value),
                                    period: periodLabel(month, year),
                                  })}
                                  disabled={isSubmittingLooseExpenses}
                                  className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                                >
                                  {isIgnoring ? "Atualizando..." : "Não pagar"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Dívidas que ficaram para depois</CardTitle>
                  <p className="mt-1 text-sm text-neutral-500">
                    Itens removidos do fluxo de pagamento em {periodLabel(month, year)}, sem marcação de pagamento.
                  </p>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <p className="text-sm text-neutral-500">Carregando dívidas pendentes...</p>
                  ) : !ignoredPayments || ignoredItemsCount === 0 ? (
                    <div className="py-12 text-center">
                      <AlertCircle className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
                      <h3 className="mb-2 text-lg font-medium text-neutral-900">Nada ficou devendo</h3>
                      <p className="text-neutral-500">Não há faturas ou despesas avulsas fora do fluxo neste período.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                        <div className="text-sm font-medium text-amber-800">Total fora do fluxo</div>
                        <div className="mt-1 text-3xl font-bold text-amber-900">{formatBRL(totalIgnoredPayments)}</div>
                        <p className="mt-2 text-sm text-amber-800">
                          {ignoredItemsCount} item(ns) mantidos como dívida em aberto.
                        </p>
                      </div>

                      <section className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-neutral-900">Faturas</h3>
                          <p className="text-sm text-neutral-500">
                            {ignoredPayments.statements_count} fatura(s) fora do somatório do mês.
                          </p>
                        </div>

                        {ignoredPayments.statements.length === 0 ? (
                          <div className="rounded-xl border border-neutral-200 px-4 py-5 text-sm text-neutral-500">
                            Nenhuma fatura ficou devendo neste período.
                          </div>
                        ) : (
                          ignoredPayments.statements.map((statement) => {
                            const brand = getCardBrandPresentation(statement.card.name);

                            return (
                              <div
                                key={statement.id}
                                className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex items-center gap-3">
                                  <CardBrandMark cardName={statement.card.name} size="md" emphasize />
                                  <div>
                                    <div className="font-medium text-neutral-900">{statement.card.name}</div>
                                    <div className="text-sm text-neutral-500">
                                      Fecha dia {statement.closing_day} • Vence dia {statement.due_day}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold" style={{ color: brand.solidColor }}>
                                    {formatBRL(statement.remaining_amount)}
                                  </div>
                                  <div className="mt-1 text-sm text-neutral-500">{statement.transactions_count} transações</div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </section>

                      <section className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-neutral-900">Avulsas</h3>
                          <p className="text-sm text-neutral-500">
                            {ignoredPayments.loose_expenses.transactions_count} despesa(s) avulsa(s) fora do somatório do mês.
                          </p>
                        </div>

                        {ignoredPayments.loose_expenses.transactions.length === 0 ? (
                          <div className="rounded-xl border border-neutral-200 px-4 py-5 text-sm text-neutral-500">
                            Nenhuma despesa avulsa ficou devendo neste período.
                          </div>
                        ) : (
                          ignoredPayments.loose_expenses.transactions.map((transaction) => {
                            const installmentLabel = renderInstallmentLabel(transaction);

                            return (
                              <div
                                key={transaction.id}
                                className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <div className="font-medium text-neutral-900">
                                    {transaction.description} {installmentLabel}
                                  </div>
                                  {transaction.note && (
                                    <div className="mt-1 text-xs text-neutral-500">{transaction.note}</div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold text-neutral-900">{formatBRL(transaction.value)}</div>
                                  <div className="mt-1 text-sm text-neutral-500">{formatDateBR(transaction.date)}</div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </section>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
      </AppLayout>

      {confirmation && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/40 px-4 py-6">
          <div className="mx-auto flex min-h-full w-full max-w-lg items-center justify-center">
            <div className="w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="border-b border-neutral-200 px-5 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">
                      {confirmation.kind === "statement"
                        ? "Registrar pagamento da fatura"
                        : confirmation.kind === "ignore-statement"
                          ? "Confirmar não pagamento da fatura"
                          : confirmation.kind === "loose-expense"
                            ? "Confirmar pagamento da despesa"
                            : confirmation.kind === "ignore-loose-expense"
                              ? "Confirmar não pagamento da despesa"
                              : "Confirmar pagamento em lote"}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-500">
                      {confirmation.kind === "statement"
                        ? `Informe o valor para registrar o pagamento da fatura do cartão ${confirmation.statement.card.name}.`
                        : confirmation.kind === "ignore-statement"
                          ? `Você está prestes a retirar a fatura do cartão ${confirmation.statement.card.name} do fluxo de pagamento de ${confirmation.period}. Ela deixará de compor os totais desse período sem ser marcada como paga.`
                          : confirmation.kind === "loose-expense"
                            ? `Você está prestes a marcar a despesa ${confirmation.description} como paga no valor de ${formatBRL(confirmation.amount)}.`
                            : confirmation.kind === "ignore-loose-expense"
                              ? `Você está prestes a retirar a despesa ${confirmation.description} do fluxo de pagamento de ${confirmation.period}. Ela deixará de compor os totais desse período sem ser marcada como paga.`
                              : `Você está prestes a quitar ${confirmation.count} despesa(s) avulsa(s) pendentes de ${confirmation.period}, totalizando ${formatBRL(confirmation.totalAmount)}.`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConfirmation(null);
                      setConfirmationError(null);
                      setStatementAccountId("none");
                      setLooseAccountId("none");
                    }}
                    disabled={submittingKey !== null}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="px-5 py-5 sm:px-6">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Essa ação altera o status de pagamento e deve ser confirmada com atenção.
                </div>

                {confirmationError && confirmationError !== looseAccountRequiredMessage && (
                  <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {confirmationError}
                  </p>
                )}

                {confirmation.kind === "statement" && (
                  <div className="mt-4 space-y-2">
                    <div className="space-y-1">
                      <label htmlFor="statement-payment-amount" className="text-sm font-medium text-neutral-700">Valor do pagamento</label>
                      <input id="statement-payment-amount" type="number" min="0.01" max={confirmation.amount} step="0.01" value={statementPaymentAmount} onChange={(event) => setStatementPaymentAmount(event.target.value)} className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3" />
                      <p className="text-xs text-neutral-500">Saldo restante: {formatBRL(confirmation.amount)}.</p>
                    </div>
                    <label className="text-sm font-medium text-neutral-700">Conta</label>
                    {hasAccounts ? (
                      <Select value={statementAccountId} onValueChange={setStatementAccountId}>
                        <SelectTriggerHTML
                          placeholder="Selecione a conta de onde saiu o dinheiro"
                          options={accountOptions}
                          className="h-11 rounded-xl bg-white"
                        />
                      </Select>
                    ) : accountsLoading ? (
                      <p className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Carregando contas...</p>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <p>Nenhuma conta cadastrada. Crie uma conta antes de pagar faturas.</p>
                        <Link href="/accounts" className="mt-2 inline-flex font-medium text-amber-900 underline underline-offset-4">
                          Criar conta
                        </Link>
                      </div>
                    )}
                    <p className="text-xs text-neutral-500">
                      Essa conta indica de onde saiu o dinheiro para pagar a fatura. A compra no cartão continua registrada apenas na fatura.
                    </p>
                  </div>
                )}

                {(confirmation.kind === "loose-expense" || confirmation.kind === "loose-expenses") && (
                  <div className="mt-4 space-y-2">
                    {hasAccounts ? (
                      <label className="block space-y-2 text-sm font-medium text-neutral-700">
                        <span>Conta do pagamento</span>
                        <Select value={looseAccountId} onValueChange={(value) => {
                          setLooseAccountId(value);
                          if (confirmationError === looseAccountRequiredMessage) setConfirmationError(null);
                        }}>
                          <SelectTriggerHTML
                            placeholder="Selecione a conta de onde saiu o dinheiro"
                            options={accountOptions}
                            className="h-11 rounded-xl bg-white"
                          />
                        </Select>
                      </label>
                    ) : accountsLoading ? (
                      <div>
                        <span className="text-sm font-medium text-neutral-700">Conta do pagamento</span>
                        <p className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">Carregando contas...</p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <span className="font-medium">Conta do pagamento</span>
                        <p>Nenhuma conta cadastrada. Crie uma conta antes de pagar despesas.</p>
                        <Link href="/accounts" className="mt-2 inline-flex font-medium text-amber-900 underline underline-offset-4">
                          Criar conta
                        </Link>
                      </div>
                    )}
                    {confirmationError === looseAccountRequiredMessage && (
                      <p role="alert" className="text-sm text-rose-700">{confirmationError}</p>
                    )}
                    <p className="text-xs text-neutral-500">A despesa só reduzirá o saldo e entrará no extrato depois deste pagamento.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label htmlFor="loose-settled-on" className="text-sm font-medium text-neutral-700">Data efetiva</label>
                        <input id="loose-settled-on" type="date" value={looseSettledOn} onChange={(event) => setLooseSettledOn(event.target.value)} className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3" />
                      </div>
                      {confirmation.kind === "loose-expense" && (
                        <div className="space-y-1">
                          <label htmlFor="loose-settled-value" className="text-sm font-medium text-neutral-700">Valor efetivamente pago</label>
                          <input id="loose-settled-value" type="number" min="0.01" step="0.01" value={looseSettledValue} onChange={(event) => setLooseSettledValue(event.target.value)} className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3" />
                        </div>
                      )}
                    </div>
                    {confirmation.kind === "loose-expense" && (
                      <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input type="checkbox" checked={looseSettle} onChange={(event) => setLooseSettle(event.target.checked)} />
                        Confirmo que este pagamento quita a despesa
                      </label>
                    )}
                    {confirmation.kind === "loose-expense" && looseSettle && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <p>Valor nominal: {formatBRL(confirmation.amount)} · Já realizado: {formatBRL(confirmation.paymentsTotal)}</p>
                        <p>Este pagamento: {formatBRL(Number(looseSettledValue) || 0)} · Total realizado: {formatBRL(confirmation.paymentsTotal + (Number(looseSettledValue) || 0))}</p>
                        {confirmation.paymentsTotal + (Number(looseSettledValue) || 0) !== confirmation.amount && (
                          <p className="mt-1 font-medium">A diferença nominal será {formatBRL(Math.abs(confirmation.amount - confirmation.paymentsTotal - (Number(looseSettledValue) || 0)))}. Confirme somente se ela for intencional.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setConfirmation(null);
                      setConfirmationError(null);
                      setStatementAccountId("none");
                      setLooseAccountId("none");
                    }}
                    disabled={submittingKey !== null}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleConfirmPayment()}
                    disabled={
                      submittingKey !== null ||
                      ((confirmation.kind === "statement" || confirmation.kind === "loose-expense" || confirmation.kind === "loose-expenses") &&
                        (!hasAccounts || accountsLoading))
                    }
                    className="bg-neutral-900 text-white hover:bg-neutral-800"
                  >
                    {confirmation.kind === "statement"
                      ? "Registrar pagamento da fatura"
                      : confirmation.kind === "ignore-statement"
                        ? "Confirmar não pagamento"
                        : confirmation.kind === "loose-expense"
                          ? "Confirmar pagamento da despesa"
                          : confirmation.kind === "ignore-loose-expense"
                            ? "Confirmar não pagamento"
                            : "Confirmar pagamento em lote"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTriggerHTML } from "@/components/ui/select";
import type { Transaction, TransactionPayload } from "@/features/transactions/types/transaction.types";

type CardOption = {
  id: number;
  name: string;
};

type AccountOption = {
  id: number;
  name: string;
};

type TransactionCreateFormProps = {
  cards: CardOption[];
  accounts?: AccountOption[];
  accountsLoading?: boolean;
  mode?: "create" | "edit";
  initialTransaction?: Transaction | null;
  loading?: boolean;
  onSubmit: (payload: TransactionPayload) => Promise<void> | void;
  onCancel?: () => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-neutral-800">{children}</label>;
}

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const amount = Number(digits || "0") / 100;

  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

function toCurrencyInput(value?: number | null) {
  if (value == null || Number.isNaN(Number(value))) return "";

  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function localDateISO() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function buildFormState(initialTransaction?: Transaction | null) {
  return {
    kind: initialTransaction?.kind ?? ("expense" as const),
    description: initialTransaction?.description ?? "",
    value: toCurrencyInput(initialTransaction?.value),
    refund: initialTransaction?.refund ?? false,
    date: initialTransaction?.date ?? localDateISO(),
    source: initialTransaction?.source ?? ("cash" as const),
    cardId: initialTransaction?.card?.id ? String(initialTransaction.card.id) : "none",
    accountId: initialTransaction?.account?.id ? String(initialTransaction.account.id) : "none",
    paid: initialTransaction?.paid ?? false,
    settledOn: initialTransaction?.settled_on ?? initialTransaction?.date ?? localDateISO(),
    settledValue: toCurrencyInput(initialTransaction?.settled_value ?? initialTransaction?.value),
    note: initialTransaction?.note ?? "",
    hasInstallments: Boolean(initialTransaction?.installment_group_id),
    installmentNumber: String(initialTransaction?.installment_number ?? 1),
    installmentsCount: String(initialTransaction?.installments_count ?? 2),
  };
}

export function TransactionCreateForm(props: TransactionCreateFormProps) {
  const formKey = `${props.mode ?? "create"}-${props.initialTransaction?.id ?? "new"}`;

  return <TransactionCreateFormFields key={formKey} {...props} />;
}

function TransactionCreateFormFields({
  cards,
  accounts = [],
  accountsLoading = false,
  mode = "create",
  initialTransaction = null,
  loading = false,
  onSubmit,
  onCancel,
}: TransactionCreateFormProps) {
  const initialState = useMemo(() => buildFormState(initialTransaction), [initialTransaction]);
  const [kind, setKind] = useState<"expense" | "income">(initialState.kind);
  const [description, setDescription] = useState(initialState.description);
  const [value, setValue] = useState(initialState.value);
  const [refund, setRefund] = useState(initialState.refund);
  const [date, setDate] = useState(initialState.date);
  const [source, setSource] = useState<"cash" | "card" | "bank">(initialState.source);
  const [cardId, setCardId] = useState(initialState.cardId);
  const [accountId, setAccountId] = useState(initialState.accountId);
  const [paid, setPaid] = useState(initialState.paid);
  const [settledOn, setSettledOn] = useState(initialState.settledOn);
  const [settledValue, setSettledValue] = useState(initialState.settledValue);
  const [hasInstallments, setHasInstallments] = useState(initialState.hasInstallments);
  const [installmentNumber, setInstallmentNumber] = useState(initialState.installmentNumber);
  const [installmentsCount, setInstallmentsCount] = useState(initialState.installmentsCount);
  const [note, setNote] = useState(initialState.note);
  const [error, setError] = useState<string | null>(null);
  const isEditing = mode === "edit";
  const isInstallmentTransaction = Boolean(initialTransaction?.installment_group_id);
  const isIncome = kind === "income";
  const showsAccountField = isIncome || source !== "card";
  const hasAccounts = accounts.length > 0;

  const sourceOptions = useMemo(
    () => {
      const options = [
        { value: "cash", label: "Dinheiro" },
        { value: "bank", label: "Banco" },
      ];

      return isIncome ? options : [...options, { value: "card", label: "Cartão" }];
    },
    [isIncome]
  );

  const cardOptions = useMemo(
    () => [{ value: "none", label: "Selecione um cartão" }, ...cards.map((card) => ({ value: String(card.id), label: card.name }))],
    [cards]
  );
  const accountOptions = useMemo(
    () => [
      { value: "none", label: isIncome ? "Selecione a conta onde o dinheiro entrou" : "Selecione a conta para o pagamento" },
      ...accounts.map((account) => ({ value: String(account.id), label: account.name })),
    ],
    [accounts, isIncome]
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalizedDescription = description.trim();
    const normalizedValue = parseCurrencyInput(value);
    const normalizedSettledValue = parseCurrencyInput(settledValue);
    const normalizedInstallmentNumber = Number(installmentNumber);
    const normalizedInstallmentsCount = Number(installmentsCount);
    const effectiveSource = isIncome && source === "card" ? "bank" : source;
    const requiresCard = !isIncome && effectiveSource === "card";
    const requiresAccount = isIncome || (!isIncome && effectiveSource !== "card" && paid);

    if (!normalizedDescription || !date || !(normalizedValue > 0)) {
      setError("Preencha descrição, valor e data corretamente.");
      return;
    }

    if (requiresCard && cardId === "none") {
      setError("Selecione um cartão para transações no cartão.");
      return;
    }

    if (requiresAccount && accountId === "none") {
      setError(isIncome ? "Selecione a conta onde o dinheiro entrou." : "Selecione a conta usada no pagamento.");
      return;
    }

    if (!isIncome && effectiveSource !== "card" && paid && (!settledOn || !(normalizedSettledValue > 0))) {
      setError("Preencha a data e o valor efetivamente pagos.");
      return;
    }

    if (
      !isIncome &&
      hasInstallments &&
      (!Number.isInteger(normalizedInstallmentNumber) ||
        !Number.isInteger(normalizedInstallmentsCount) ||
        normalizedInstallmentNumber < 1 ||
        normalizedInstallmentsCount < 2 ||
        normalizedInstallmentNumber > normalizedInstallmentsCount)
    ) {
      setError("Preencha os campos de parcelamento corretamente.");
      return;
    }

    setError(null);

    await onSubmit({
      description: normalizedDescription,
      value: normalizedValue,
      refund: !isIncome && effectiveSource === "card" ? refund : false,
      date,
      kind,
      source: isIncome ? effectiveSource === "cash" ? "cash" : "bank" : effectiveSource,
      paid: isIncome ? true : paid,
      settled_on: !isIncome && effectiveSource !== "card" && paid ? settledOn : null,
      settled_value: !isIncome && effectiveSource !== "card" && paid ? normalizedSettledValue : null,
      note: note.trim() || undefined,
      card_id: !isIncome && effectiveSource === "card" && cardId !== "none" ? Number(cardId) : null,
      account_id: showsAccountField && accountId !== "none" ? Number(accountId) : null,
      installment_number: !isIncome && !isEditing && hasInstallments && !refund ? normalizedInstallmentNumber : null,
      installments_count: !isIncome && !isEditing && hasInstallments && !refund ? normalizedInstallmentsCount : null,
    });

    if (!isEditing) {
      const nextState = buildFormState(null);
      setKind(nextState.kind);
      setDescription(nextState.description);
      setValue(nextState.value);
      setRefund(nextState.refund);
      setDate(nextState.date);
      setSource(nextState.source);
      setCardId(nextState.cardId);
      setAccountId(nextState.accountId);
      setPaid(nextState.paid);
      setSettledOn(nextState.settledOn);
      setSettledValue(nextState.settledValue);
      setHasInstallments(nextState.hasInstallments);
      setInstallmentNumber(nextState.installmentNumber);
      setInstallmentsCount(nextState.installmentsCount);
      setNote(nextState.note);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-neutral-900">{isIncome ? "Dados da receita" : "Dados principais"}</h3>
          <p className="text-sm text-neutral-500">
            {isIncome
              ? "Cadastre uma entrada financeira simples, sem cartão, fatura ou parcelamento."
              : "Cadastre a transação e deixe a classificação automática fazer o resto."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <FieldLabel>Tipo de transação</FieldLabel>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-neutral-200">
              <button
                type="button"
                onClick={() => setKind("expense")}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-medium transition",
                  kind === "expense" ? "bg-rose-600 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100",
                ].join(" ")}
              >
                Despesa
              </button>
              <button
                type="button"
                onClick={() => {
                  setKind("income");
                  if (source === "card") setSource("bank");
                  setCardId("none");
                  setAccountId("none");
                  setRefund(false);
                  setPaid(true);
                  setHasInstallments(false);
                }}
                className={[
                  "rounded-lg px-4 py-2 text-sm font-medium transition",
                  kind === "income" ? "bg-emerald-600 text-white shadow-sm" : "text-neutral-600 hover:bg-neutral-100",
                ].join(" ")}
              >
                Receita
              </button>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel>Descrição</FieldLabel>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isIncome ? "Ex: Salário mensal" : "Ex: Compra no supermercado"}
              disabled={loading}
              className="h-11 rounded-xl bg-white"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>{!isIncome && hasInstallments && !refund ? "Valor da parcela (R$)" : "Valor (R$)"}</FieldLabel>
            <Input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(formatCurrencyInput(e.target.value))}
              placeholder="0,00"
              disabled={loading}
              className="h-11 rounded-xl bg-white"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel>Data</FieldLabel>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={loading}
              className="h-11 rounded-xl bg-white"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-neutral-900">{isIncome ? "Recebimento" : "Pagamento"}</h3>
          <p className="text-sm text-neutral-500">
            {isIncome
              ? "Receitas simples entram como recebidas na data informada."
              : "Escolha a origem da transação e informe o cartão apenas quando fizer sentido."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel>Origem</FieldLabel>
            <Select
              value={source}
              onValueChange={(value) => {
                const nextSource = value as "cash" | "card" | "bank";
                setSource(nextSource);
                if (nextSource !== "card") {
                  setCardId("none");
                  setRefund(false);
                }
                if (nextSource === "card") setAccountId("none");
              }}
            >
              <SelectTriggerHTML placeholder="Selecione a origem" options={sourceOptions} className="h-11 rounded-xl bg-white" />
            </Select>
          </div>

          {!isIncome && source === "card" && (
            <div className="space-y-2">
              <FieldLabel>Cartão</FieldLabel>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTriggerHTML
                  placeholder="Selecione um cartão"
                  options={cardOptions}
                  className="h-11 rounded-xl bg-white"
                />
              </Select>
            </div>
          )}

          {showsAccountField && (
            <div className="space-y-2">
              <FieldLabel>{isIncome ? "Conta" : "Conta para pagamento"}</FieldLabel>
              {hasAccounts ? (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTriggerHTML
                    placeholder={isIncome ? "Selecione a conta onde o dinheiro entrou" : "Selecione a conta para o pagamento"}
                    options={accountOptions}
                    className="h-11 rounded-xl bg-white"
                  />
                </Select>
              ) : accountsLoading ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                  Carregando contas...
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p>
                    {isIncome
                      ? "Nenhuma conta cadastrada. Crie uma conta antes de lançar receitas."
                      : paid
                        ? "Nenhuma conta cadastrada. Crie uma conta antes de marcar a despesa como paga."
                        : "Nenhuma conta cadastrada. Você pode salvar a despesa em aberto sem uma conta."}
                  </p>
                  <Link href="/accounts" className="mt-2 inline-flex font-medium text-amber-900 underline underline-offset-4">
                    Criar conta
                  </Link>
                </div>
              )}
              {!isIncome && !paid && (
                <p className="text-xs text-neutral-500">Opcional enquanto a despesa estiver em aberto; indica a conta planejada para o pagamento.</p>
              )}
            </div>
          )}

          {!isIncome && source === "card" && (
            <label className="inline-flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 md:col-span-2">
              <input
                type="checkbox"
                checked={refund}
                onChange={(e) => {
                  setRefund(e.target.checked);
                  if (e.target.checked) setHasInstallments(false);
                }}
                disabled={loading || isInstallmentTransaction}
                className="h-4 w-4 rounded border-emerald-300"
              />
              Estorno / crédito no cartão
            </label>
          )}

          {!isIncome && (
            <label className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={paid}
                onChange={(e) => {
                  const nextPaid = e.target.checked;
                  setPaid(nextPaid);
                  if (nextPaid) {
                    setSettledOn((current) => current || date);
                    setSettledValue((current) => current || value);
                  }
                }}
                disabled={loading}
                className="h-4 w-4 rounded border-neutral-300"
              />
              Marcar como paga
            </label>
          )}

          {!isIncome && source !== "card" && paid && (
            <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Data efetiva do pagamento</FieldLabel>
                <Input type="date" value={settledOn} onChange={(e) => setSettledOn(e.target.value)} disabled={loading} className="h-11 rounded-xl bg-white" />
              </div>
              <div className="space-y-2">
                <FieldLabel>Valor efetivamente pago (R$)</FieldLabel>
                <Input type="text" inputMode="decimal" value={settledValue} onChange={(e) => setSettledValue(formatCurrencyInput(e.target.value))} disabled={loading} className="h-11 rounded-xl bg-white" />
              </div>
            </div>
          )}
        </div>
      </section>

      {!isIncome && !isEditing ? (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-neutral-900">Parcelamento</h3>
              <p className="text-sm text-neutral-500">Ative apenas quando a compra precisar gerar múltiplas parcelas.</p>
            </div>

            <label className="inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={hasInstallments && !refund}
                onChange={(e) => setHasInstallments(e.target.checked)}
                disabled={loading || refund}
                className="h-4 w-4 rounded border-neutral-300"
              />
              Compra parcelada
            </label>
          </div>

          {hasInstallments && !refund && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel>Parcela atual</FieldLabel>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={installmentNumber}
                  onChange={(e) => setInstallmentNumber(e.target.value)}
                  placeholder="1"
                  disabled={loading}
                  className="h-11 rounded-xl bg-white"
                />
              </div>

              <div className="space-y-2">
                <FieldLabel>Total de parcelas</FieldLabel>
                <Input
                  type="number"
                  min="2"
                  step="1"
                  value={installmentsCount}
                  onChange={(e) => setInstallmentsCount(e.target.value)}
                  placeholder="10"
                  disabled={loading}
                  className="h-11 rounded-xl bg-white"
                />
              </div>
            </div>
          )}
        </section>
      ) : isInstallmentTransaction ? (
        <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-amber-900">Parcela vinculada a um grupo</h3>
          <p className="text-sm text-amber-800">
            Esta edição afeta apenas a parcela selecionada. O restante do grupo parcelado permanece como está.
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <FieldLabel>Observações</FieldLabel>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Adicione observações sobre esta transação..."
          rows={4}
          disabled={loading}
          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </section>

      <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-h-5 text-sm text-rose-700">{error ?? ""}</span>

        <div className="flex flex-col gap-2 sm:flex-row">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={loading} className="bg-blue-600 text-white hover:bg-blue-700">
            {loading ? "Salvando..." : isEditing ? "Salvar alterações" : kind === "expense" ? "Salvar despesa" : "Salvar receita"}
          </Button>
        </div>
      </div>
    </form>
  );
}

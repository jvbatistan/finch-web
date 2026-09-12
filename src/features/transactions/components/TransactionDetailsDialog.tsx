"use client";

import { Button } from "@/components/ui/button";
import type { Transaction } from "@/features/transactions/types/transaction.types";

type TransactionDetailsDialogProps = {
  transaction: Transaction | null;
  onClose: () => void;
};

function formatDateBR(dateISO: string) {
  const [year, month, day] = dateISO.split("-");

  return `${day}/${month}/${year}`;
}

function formatBRL(value: number) {
  return Math.abs(Number(value)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatSignedBRL(value: number) {
  return `${Number(value) < 0 ? "-" : ""}${formatBRL(value)}`;
}

function sourceLabel(source: Transaction["source"]) {
  return { bank: "Conta bancária", cash: "Dinheiro", card: "Cartão" }[source];
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-neutral-100 py-3 last:border-b-0 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-neutral-500">{label}</dt>
      <dd className="font-medium text-neutral-900">{value}</dd>
    </div>
  );
}

function paymentDifference(settledValue: number, dueValue: number) {
  const difference = Number(settledValue) - Number(dueValue);

  if (difference === 0) return "Sem diferença";

  const direction = difference < 0 ? "Menor que o valor devido" : "Maior que o valor devido";
  return `${difference < 0 ? "-" : "+"}${formatBRL(difference)} — ${direction}`;
}

function paymentStatusLabel(status: Transaction["payment_status"], paid: boolean) {
  if (status === "partially_paid") return "Parcialmente paga";
  if (status === "paid" || paid) return "Paga";
  return "Em aberto";
}

export function TransactionDetailsDialog({ transaction, onClose }: TransactionDetailsDialogProps) {
  if (!transaction) return null;

  const hasSettledValue = transaction.settled_value !== null && transaction.settled_value !== undefined;
  const hasSettledOn = Boolean(transaction.settled_on);
  const hasPaymentDifference = hasSettledValue && transaction.kind === "expense" && (transaction.source === "cash" || transaction.source === "bank");
  const hasPayments = (transaction.payments?.length ?? 0) > 0;
  const isLooseExpense = transaction.kind === "expense" && (transaction.source === "cash" || transaction.source === "bank");

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/40 px-4 py-4" role="dialog" aria-modal="true" aria-labelledby="transaction-details-title">
      <div className="mx-auto flex min-h-full w-full max-w-2xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-6">
            <div>
              <h2 id="transaction-details-title" className="text-xl font-semibold text-neutral-900">Detalhes da Transação</h2>
              <p className="mt-1 text-sm text-neutral-500">Dados registrados para este lançamento.</p>
            </div>
            <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          </div>

          <dl className="max-h-[calc(100vh-12rem)] overflow-y-auto px-5 py-3 sm:px-6">
            <DetailRow label="Descrição" value={transaction.description} />
            <DetailRow label="Categoria" value={transaction.category?.name ?? "Sem categoria"} />
            <DetailRow label="Origem" value={sourceLabel(transaction.source)} />
            {transaction.account && <DetailRow label="Account" value={transaction.account.name} />}
            {transaction.card && <DetailRow label="Cartão" value={transaction.card.name} />}
            {transaction.purchase_date && <DetailRow label="Data original da compra" value={formatDateBR(transaction.purchase_date)} />}
            <DetailRow label="Data da obrigação" value={formatDateBR(transaction.date)} />
            {hasSettledOn && <DetailRow label="Data efetiva do pagamento" value={formatDateBR(transaction.settled_on!)} />}
            {transaction.original_value !== null && transaction.original_value !== undefined && (
              <DetailRow label="Valor original" value={formatBRL(transaction.original_value)} />
            )}
            <DetailRow label="Valor devido" value={formatBRL(transaction.value)} />
            {isLooseExpense && (
              <>
                <DetailRow label="Status do pagamento" value={paymentStatusLabel(transaction.payment_status, transaction.paid)} />
                <DetailRow label="Total realizado" value={formatBRL(transaction.payments_total ?? (transaction.settled_value ?? 0))} />
                <DetailRow label="Saldo nominal restante" value={formatSignedBRL(transaction.remaining_amount ?? (transaction.value - (transaction.settled_value ?? 0)))} />
              </>
            )}
            {hasSettledValue && <DetailRow label="Valor efetivamente pago" value={formatBRL(transaction.settled_value!)} />}
            {hasPaymentDifference && (
              <DetailRow label="Diferença no pagamento" value={paymentDifference(transaction.settled_value!, transaction.value)} />
            )}
            {hasPayments && (
              <div className="border-b border-neutral-100 py-3 last:border-b-0">
                <dt className="text-sm text-neutral-500">Pagamentos registrados</dt>
                <dd className="mt-2 space-y-2">
                  {transaction.payments!.map((payment) => (
                    <div key={payment.id} className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-800">
                      {formatDateBR(payment.settled_on)} · {payment.account.name} · {formatBRL(payment.amount)}
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

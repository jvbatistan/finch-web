import type { LooseExpenseTransaction, PaymentsOverview, PaymentStatement } from "@/features/payments/types/payment.types";
import { api } from "@/lib/api";

function toQuery(month: number, year: number) {
  const qs = new URLSearchParams({ month: String(month), year: String(year) });
  return qs.toString();
}

export async function fetchPayments(month: number, year: number, signal?: AbortSignal) {
  try {
    const data = (await api(`/api/payments?${toQuery(month, year)}`, {
      cache: "no-store",
      signal,
    })) as PaymentsOverview;

    return { status: 200 as const, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as PaymentsOverview | null };
    }
    throw err;
  }
}

type PayCardStatementPayload = {
  amount?: number;
  accountId: number;
};

type StatementReference = Pick<PaymentStatement, "id" | "card" | "billing_statement">;

function statementActionUrl(statement: StatementReference, action: "pay" | "ignore") {
  return statement.id
    ? `/api/payments/card_statements/${statement.id}/${action}`
    : `/api/payments/card_statements/${action}`;
}

function statementReferencePayload(statement: StatementReference) {
  return statement.id ? {} : { card_id: statement.card.id, billing_statement: statement.billing_statement };
}

export async function payCardStatement(statement: StatementReference, payload: PayCardStatementPayload) {
  try {
    const data = (await api(statementActionUrl(statement, "pay"), {
      method: "POST",
      body: JSON.stringify({
        ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
        account_id: payload.accountId,
        ...statementReferencePayload(statement),
      }),
      cache: "no-store",
    })) as PaymentStatement;

    return { status: 200 as const, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as PaymentStatement | null };
    }
    throw err;
  }
}

export async function payLooseExpenses(month: number, year: number, accountId: number, settledOn: string) {
  try {
    const data = (await api("/api/payments/loose_expenses/pay", {
      method: "POST",
      body: JSON.stringify({ month, year, account_id: accountId, settled_on: settledOn }),
      cache: "no-store",
    })) as { paid_transactions_count: number; total_amount: number };

    return { status: 200 as const, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as { paid_transactions_count: number; total_amount: number } | null };
    }
    throw err;
  }
}

export async function payLooseExpense(transactionId: number, month: number, year: number, accountId: number, settledOn: string, amount: number, settle: boolean) {
  try {
    const data = (await api(`/api/payments/loose_expenses/${transactionId}/pay`, {
      method: "POST",
      body: JSON.stringify({ month, year, account_id: accountId, settled_on: settledOn, amount, settle }),
      cache: "no-store",
    })) as LooseExpenseTransaction;

    return { status: 200 as const, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as LooseExpenseTransaction | null };
    }
    throw err;
  }
}

export async function ignoreLooseExpense(transactionId: number, month: number, year: number) {
  try {
    const data = (await api(`/api/payments/loose_expenses/${transactionId}/ignore`, {
      method: "POST",
      body: JSON.stringify({ month, year }),
      cache: "no-store",
    })) as LooseExpenseTransaction;

    return { status: 200 as const, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as LooseExpenseTransaction | null };
    }
    throw err;
  }
}

export async function ignoreCardStatement(statement: StatementReference, month: number, year: number) {
  try {
    const data = (await api(statementActionUrl(statement, "ignore"), {
      method: "POST",
      body: JSON.stringify({ month, year, ...statementReferencePayload(statement) }),
      cache: "no-store",
    })) as PaymentStatement;

    return { status: 200 as const, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as PaymentStatement | null };
    }
    throw err;
  }
}

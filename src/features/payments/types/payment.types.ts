export type PaymentStatement = {
  id: number | null;
  card: {
    id: number;
    name: string;
  };
  billing_statement: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  paid: boolean;
  payment_status?: "open" | "partially_paid" | "paid";
  paid_at?: string | null;
  ignored_at?: string | null;
  payments?: CardStatementPayment[];
  due_day: number;
  closing_day: number;
  transactions_count: number;
};

export type CardStatementPayment = {
  id: number;
  amount: number;
  paid_at: string;
  description?: string | null;
  source?: string | null;
  original_transaction_id?: number | null;
  account?: {
    id: number;
    name: string;
  } | null;
};

export type LooseExpenseTransaction = {
  id: number;
  description: string;
  value: number;
  signed_value?: number;
  refund?: boolean;
  date: string;
  settled_on?: string | null;
  settled_value?: number | null;
  note?: string | null;
  installment_number?: number | null;
  installments_count?: number | null;
  source: "card" | "cash" | "bank";
  category_id?: number | null;
  account?: {
    id: number;
    name: string;
  } | null;
  paid: boolean;
  payments_total?: number;
  remaining_amount?: number;
  payment_status?: "open" | "partially_paid" | "paid";
  payments?: Array<{ id: number; amount: number; settled_on: string; account: { id: number; name: string } }>;
  payment_ignored_at?: string | null;
};

export type PaymentsOverview = {
  period: {
    month: number;
    year: number;
  };
  statements: PaymentStatement[];
  loose_expenses: {
    period_label: string;
    transactions_count: number;
    total_amount: number;
    paid: boolean;
    transactions: LooseExpenseTransaction[];
  };
  ignored_payments: {
    period_label: string;
    statements_count: number;
    statements_total_amount: number;
    statements: PaymentStatement[];
    loose_expenses: {
      transactions_count: number;
      total_amount: number;
      transactions: LooseExpenseTransaction[];
    };
  };
};

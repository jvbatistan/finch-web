export type TransactionCategory = {
  id: number;
  name: string;
};

export type TransactionSuggestion = {
  id: number;
  confidence: number;
  source: "alias" | "rule";
  suggested_category?: TransactionCategory | null;
};

export type TransactionClassificationStatus = "classified" | "suggestion_pending" | "unclassified";

export type TransactionClassification = {
  status: TransactionClassificationStatus;
  category?: TransactionCategory | null;
  suggestion?: TransactionSuggestion | null;
};

export type Transaction = {
  id: number;
  description: string;
  value: number;
  original_value?: number | null;
  signed_value?: number;
  refund?: boolean;
  date: string;
  purchase_date?: string | null;
  settled_on?: string | null;
  settled_value?: number | null;
  payments_total?: number;
  remaining_amount?: number;
  payment_status?: "open" | "partially_paid" | "paid";
  payments?: Array<{
    id: number;
    amount: number;
    settled_on: string;
    account: { id: number; name: string };
  }>;
  kind: "income" | "expense";
  source: "card" | "cash" | "bank";
  paid: boolean;
  note?: string | null;
  category?: TransactionCategory | null;
  card?: { id: number; name: string } | null;
  account?: { id: number; name: string; kind?: string } | null;
  installment_group_id?: string | null;
  installment_number?: number | null;
  installments_count?: number | null;
  classification?: TransactionClassification | null;
  archived_at?: string | null;
};

export type TransactionFilters = {
  cardId: "all" | "none" | string;
  month: "all" | string;
  year: "all" | string;
  page: number;
  perPage: "25" | "50" | "100";
};

export type TransactionsPage = {
  transactions: Transaction[];
  pagination: { page: number; per_page: number; total_count: number; total_pages: number };
};

export type TransactionPayload = {
  description: string;
  value: number;
  original_value?: number | null;
  refund?: boolean;
  date: string;
  purchase_date?: string | null;
  settled_on?: string | null;
  settled_value?: number | null;
  kind: "income" | "expense";
  source: "card" | "cash" | "bank";
  paid: boolean;
  note?: string;
  responsible?: string;
  category_id?: number | null;
  card_id?: number | null;
  account_id?: number | null;
  billing_statement?: string | null;
  installment_number?: number | null;
  installments_count?: number | null;
};

export type CreateTransactionResponse =
  | { kind: "single"; transaction: Transaction }
  | { kind: "installment_group"; installment_group_id: string; transactions: Transaction[] };

export const defaultTransactionFilters: TransactionFilters = {
  cardId: "all",
  month: "all",
  year: "all",
  page: 1,
  perPage: "25",
};

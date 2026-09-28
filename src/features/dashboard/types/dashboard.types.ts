export type DashboardSummary = {
  incomes_total: number;
  expenses_total: number;
  balance_total: number;
  open_total: number;
  paid_total: number;
  transactions_count: number;
};

export type DashboardCardTotal = {
  id: number | null;
  name: string;
  total_amount: number;
  open_amount: number;
  paid_amount: number;
  transactions_count: number;
};

export type DashboardCategoryTotal = {
  id: number | null;
  name: string;
  total_amount: number;
  transactions_count: number;
};

export type DashboardRecentExpense = {
  id: number;
  description: string;
  friendly_title?: string | null;
  value: number;
  signed_value?: number;
  refund?: boolean;
  date: string;
  paid: boolean;
  card?: { id: number; name: string } | null;
  category?: { id: number; name: string } | null;
  installment_number?: number | null;
  installments_count?: number | null;
};

export type DashboardMonthlyTrend = {
  month: number;
  year: number;
  label: string;
  total_amount: number;
  transactions_count: number;
};

export type DashboardStatement = {
  id: number;
  card: {
    id: number;
    name: string;
  };
  billing_statement: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  paid: boolean;
  due_day: number;
  closing_day: number;
  transactions_count: number;
};

export type DashboardOverview = {
  period: {
    month: number;
    year: number;
    label: string;
  };
  summary: DashboardSummary;
  monthly_trend: DashboardMonthlyTrend[];
  by_card: DashboardCardTotal[];
  by_category: DashboardCategoryTotal[];
  recent_expenses: DashboardRecentExpense[];
  statements: DashboardStatement[];
};

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PaymentsPage from "@/app/payments/page";

const push = vi.fn();
const replace = vi.fn();
const refetch = vi.fn();
const payCardStatement = vi.fn();
const ignoreCardStatement = vi.fn();
const ignoreLooseExpense = vi.fn();
const payLooseExpense = vi.fn();
const payLooseExpenses = vi.fn();
const usePayments = vi.fn();
const useAccounts = vi.fn();
const useAuth = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

vi.mock("@/lib/useAuth", () => ({
  useAuth: () => useAuth(),
}));

vi.mock("@/components/Header", () => ({
  Header: () => <div>Header</div>,
}));

vi.mock("@/components/Navigation", () => ({
  Navigation: () => <div>Navigation</div>,
}));

vi.mock("@/features/payments", () => ({
  usePayments: (...args: unknown[]) => usePayments(...args),
  payCardStatement: (...args: unknown[]) => payCardStatement(...args),
  ignoreCardStatement: (...args: unknown[]) => ignoreCardStatement(...args),
  ignoreLooseExpense: (...args: unknown[]) => ignoreLooseExpense(...args),
  payLooseExpense: (...args: unknown[]) => payLooseExpense(...args),
  payLooseExpenses: (...args: unknown[]) => payLooseExpenses(...args),
}));

vi.mock("@/features/accounts", () => ({
  useAccounts: (...args: unknown[]) => useAccounts(...args),
}));

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  refetch.mockReset().mockResolvedValue(undefined);
  payCardStatement.mockReset().mockResolvedValue({ status: 200, data: { card: { name: "NUBANK" } } });
  ignoreCardStatement.mockReset().mockResolvedValue({ status: 200, data: { id: 1, ignored_at: "2026-03-12T10:00:00Z" } });
  ignoreLooseExpense.mockReset().mockResolvedValue({
    status: 200,
    data: { id: 1, description: "MERCADO", value: 80, date: "2026-03-10", source: "cash", paid: false, payment_ignored_at: "2026-03-12T10:00:00Z" },
  });
  payLooseExpense.mockReset().mockResolvedValue({
    status: 200,
    data: { id: 1, description: "MERCADO", value: 80, date: "2026-03-10", source: "cash", paid: true },
  });
  payLooseExpenses.mockReset().mockResolvedValue({ status: 200, data: { paid_transactions_count: 2, total_amount: 120 } });
  useAuth.mockReturnValue({
    status: "authenticated",
    user: { id: 1, name: "Joao", email: "joao@example.com", active: true },
  });
  useAccounts.mockReturnValue({
    accounts: [{ id: 3, name: "Conta Corrente" }],
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  usePayments.mockReturnValue({
    loading: false,
    error: null,
    refetch,
    overview: {
      period: { month: 3, year: 2026 },
      statements: [
        {
          id: 1,
          card: { id: 1, name: "NUBANK" },
          billing_statement: "2026-03-01",
          total_amount: 300,
          paid_amount: 30,
          remaining_amount: 270,
          paid: false,
          payments: [
            {
              id: 10,
              amount: 30,
              paid_at: "2026-03-10T12:00:00Z",
              description: "Pagamento recebido",
              source: "converted_transaction",
              original_transaction_id: 99,
              account: null,
            },
          ],
          due_day: 15,
          closing_day: 8,
          transactions_count: 4,
        },
      ],
      loose_expenses: {
        period_label: "03/2026",
        transactions_count: 2,
        total_amount: 120,
        paid: false,
        transactions: [
          { id: 1, description: "MERCADO", friendly_title: "Compras da semana", value: 80, date: "2026-03-10", source: "cash", paid: false },
          { id: 2, description: "UBER", value: 40, date: "2026-03-11", source: "bank", paid: false },
        ],
      },
      ignored_payments: {
        period_label: "03/2026",
        statements_count: 1,
        statements_total_amount: 300,
        statements: [
          {
            id: 2,
            card: { id: 1, name: "NUBANK" },
            billing_statement: "2026-03-01",
            total_amount: 300,
            paid_amount: 0,
            remaining_amount: 300,
            paid: false,
            payments: [],
            ignored_at: "2026-03-12T10:00:00Z",
            due_day: 15,
            closing_day: 8,
            transactions_count: 4,
          },
        ],
        loose_expenses: {
          transactions_count: 1,
          total_amount: 65,
          transactions: [
            { id: 3, description: "FARMACIA", value: 65, date: "2026-03-12", source: "cash", paid: false, payment_ignored_at: "2026-03-12T10:00:00Z" },
          ],
        },
      },
    },
  });
});

describe("PaymentsPage", () => {
  it("registers a partial statement payment and refreshes the overview", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Registrar pagamento/i }));
    expect(screen.getByLabelText("Data e hora do pagamento")).toHaveAttribute("type", "datetime-local");
    await user.clear(screen.getByLabelText("Valor do pagamento"));
    await user.type(screen.getByLabelText("Valor do pagamento"), "100");
    await user.selectOptions(screen.getByDisplayValue("Selecione a conta de onde saiu o dinheiro"), "3");
    await user.click(screen.getByRole("button", { name: /Registrar pagamento da fatura/i }));

    await waitFor(() => {
      expect(payCardStatement).toHaveBeenCalledWith(expect.objectContaining({ id: 1, card: { id: 1, name: "NUBANK" } }), {
        accountId: 3,
        amount: 100,
        paidAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      });
      expect(refetch).toHaveBeenCalled();
      expect(screen.getByText('Pagamento da fatura do cartão "NUBANK" registrado com sucesso.')).toBeInTheDocument();
    });
  });

  it("requires an account before paying a card statement", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Registrar pagamento/i }));
    await user.click(screen.getByRole("button", { name: /Registrar pagamento da fatura/i }));

    expect(screen.getByText("Selecione a conta de onde saiu o pagamento da fatura.")).toBeInTheDocument();
    expect(payCardStatement).not.toHaveBeenCalled();
  });

  it.each([
    { action: /Pagar despesa/i, confirm: /Confirmar pagamento da despesa/i, payment: payLooseExpense },
    { action: /Pagar todas as despesas/i, confirm: /Confirmar pagamento em lote/i, payment: payLooseExpenses },
  ])("shows the account error inside the modal before $confirm", async ({ action, confirm, payment }) => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Avulsas/i }));
    await user.click(screen.getAllByRole("button", { name: action })[0]);
    await user.click(screen.getByRole("button", { name: confirm }));

    expect(screen.getByRole("alert")).toHaveTextContent("Selecione a conta usada no pagamento da despesa.");
    expect(screen.getByLabelText("Conta do pagamento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: confirm })).toBeEnabled();
    expect(payment).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
    expect(screen.queryByText(/Pagamento parcial da despesa .* registrado/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Conta do pagamento"), "3");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a friendly API error when statement payment fails", async () => {
    const user = userEvent.setup();
    payCardStatement.mockRejectedValue(new Error("Conta não encontrada."));

    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Registrar pagamento/i }));
    await user.selectOptions(screen.getByDisplayValue("Selecione a conta de onde saiu o dinheiro"), "3");
    await user.click(screen.getByRole("button", { name: /Registrar pagamento da fatura/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Conta não encontrada.");
    expect(screen.getByRole("button", { name: /Registrar pagamento da fatura/i })).toBeEnabled();
  });

  it("keeps the loose-expense payment modal open after insufficient funds and allows a retry with another account", async () => {
    const user = userEvent.setup();
    useAccounts.mockReturnValue({
      accounts: [{ id: 3, name: "Conta sem saldo" }, { id: 4, name: "Conta com saldo" }],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    payLooseExpense
      .mockRejectedValueOnce(new Error("Saldo insuficiente na conta Conta sem saldo."))
      .mockResolvedValueOnce({ status: 200, data: { id: 1, description: "MERCADO", value: 80, date: "2026-03-10", source: "cash", paid: false } });

    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Avulsas/i }));
    await user.click(screen.getAllByRole("button", { name: /Pagar despesa/i })[0]);
    await user.selectOptions(screen.getByDisplayValue("Selecione a conta de onde saiu o dinheiro"), "3");
    await user.click(screen.getByRole("button", { name: /Confirmar pagamento da despesa/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Saldo insuficiente na conta Conta sem saldo.");
    expect(screen.getByRole("button", { name: /Confirmar pagamento da despesa/i })).toBeEnabled();
    expect(screen.queryByText(/Pagamento parcial da despesa "MERCADO" registrado/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue("Conta sem saldo"), "4");
    await user.click(screen.getByRole("button", { name: /Confirmar pagamento da despesa/i }));

    await waitFor(() => expect(payLooseExpense).toHaveBeenLastCalledWith(1, expect.any(Number), expect.any(Number), 4, expect.any(String), 80, false));
    expect(screen.queryByRole("button", { name: /Confirmar pagamento da despesa/i })).not.toBeInTheDocument();
  });

  it("guides the user to create an account when paying a statement without active accounts", async () => {
    const user = userEvent.setup();
    useAccounts.mockReturnValue({
      accounts: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Registrar pagamento/i }));

    expect(screen.getByText("Nenhuma conta cadastrada. Crie uma conta antes de pagar faturas.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/accounts");
    expect(screen.getByRole("button", { name: /Registrar pagamento da fatura/i })).toBeDisabled();
  });

  it("shows the account in statement payment history when available", () => {
    usePayments.mockReturnValue({
      loading: false,
      error: null,
      refetch,
      overview: {
        period: { month: 3, year: 2026 },
        statements: [
          {
            id: 1,
            card: { id: 1, name: "NUBANK" },
            billing_statement: "2026-03-01",
            total_amount: 300,
            paid_amount: 30,
            remaining_amount: 270,
            paid: false,
            payments: [
              {
                id: 10,
                amount: 30,
                paid_at: "2026-03-10T12:00:00Z",
                description: "Pagamento recebido",
                source: "manual",
                original_transaction_id: null,
                account: { id: 3, name: "Conta Corrente" },
              },
            ],
            due_day: 15,
            closing_day: 8,
            transactions_count: 4,
          },
        ],
        loose_expenses: {
          period_label: "03/2026",
          transactions_count: 0,
          total_amount: 0,
          paid: true,
          transactions: [],
        },
        ignored_payments: {
          period_label: "03/2026",
          statements_count: 0,
          statements_total_amount: 0,
          statements: [],
          loose_expenses: {
            transactions_count: 0,
            total_amount: 0,
            transactions: [],
          },
        },
      },
    });

    render(<PaymentsPage />);

    expect(screen.getByText(/Conta Corrente/i)).toBeInTheDocument();
  });

  it("shows statement payment history", () => {
    render(<PaymentsPage />);

    expect(screen.getByText("Parcialmente paga")).toBeInTheDocument();
    expect(screen.getByText("Pagamentos registrados")).toBeInTheDocument();
    expect(screen.getByText(/Pagamento recebido/i)).toBeInTheDocument();
    expect(screen.getByText("R$ 30,00")).toBeInTheDocument();
  });

  it("allows ignoring a statement for the selected period", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Não pagar/i }));
    await user.click(screen.getByRole("button", { name: /Confirmar não pagamento/i }));

    await waitFor(() => {
    expect(ignoreCardStatement).toHaveBeenCalledWith(expect.objectContaining({ id: 1, card: { id: 1, name: "NUBANK" } }), expect.any(Number), expect.any(Number));
      expect(refetch).toHaveBeenCalled();
      expect(screen.getByText(/removida do fluxo de pagamento/i)).toBeInTheDocument();
    });
  });

  it("opens a confirmation modal before paying a loose expense", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Avulsas/i }));
    await user.click(screen.getAllByRole("button", { name: /Pagar despesa/i })[0]);

    expect(screen.getByText(/Essa ação altera o status de pagamento/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirmar pagamento da despesa/i })).toBeInTheDocument();
    expect(payLooseExpense).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(screen.queryByRole("button", { name: /Confirmar pagamento da despesa/i })).not.toBeInTheDocument();
    expect(payLooseExpense).not.toHaveBeenCalled();
  });

  it("switches to loose expenses and pays one expense at a time", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Avulsas/i }));
    await user.click(screen.getAllByRole("button", { name: /Pagar despesa/i })[0]);
    await user.selectOptions(screen.getByDisplayValue("Selecione a conta de onde saiu o dinheiro"), "3");
    await user.click(screen.getByRole("button", { name: /Confirmar pagamento da despesa/i }));

    await waitFor(() => {
      expect(payLooseExpense).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number), 3, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 80, false);
      expect(refetch).toHaveBeenCalled();
      expect(screen.getByText('Pagamento parcial da despesa "Compras da semana" registrado.')).toBeInTheDocument();
    });
  });

  it("switches to loose expenses and removes one expense from the payment flow", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Avulsas/i }));
    await user.click(screen.getAllByRole("button", { name: /Não pagar/i })[0]);
    await user.click(screen.getByRole("button", { name: /Confirmar não pagamento/i }));

    await waitFor(() => {
      expect(ignoreLooseExpense).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number));
      expect(refetch).toHaveBeenCalled();
      expect(screen.getByText(/Despesa "Compras da semana" removida do fluxo de pagamento/i)).toBeInTheDocument();
    });
  });

  it("switches to loose expenses and pays all expenses in batch", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Avulsas/i }));
    await user.click(screen.getByRole("button", { name: /Pagar todas as despesas/i }));
    await user.selectOptions(screen.getByDisplayValue("Selecione a conta de onde saiu o dinheiro"), "3");
    await user.click(screen.getByRole("button", { name: /Confirmar pagamento em lote/i }));

    await waitFor(() => {
      expect(payLooseExpenses).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 3, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
      expect(refetch).toHaveBeenCalled();
      expect(screen.getByText("2 despesas avulsas marcadas como pagas.")).toBeInTheDocument();
    });
  });

  it("shows debts removed from the payment flow", async () => {
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Devendo/i }));

    expect(screen.getByText("Dívidas que ficaram para depois")).toBeInTheDocument();
    expect(screen.getByText("Total fora do fluxo")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 365,00")).toHaveLength(2);
    expect(screen.getByText("1 fatura(s) fora do somatório do mês.")).toBeInTheDocument();
    expect(screen.getByText("1 despesa(s) avulsa(s) fora do somatório do mês.")).toBeInTheDocument();
    expect(screen.getByText("FARMACIA")).toBeInTheDocument();
  });

  it("blocks loose-expense actions while a loose-expense request is in flight", async () => {
    payLooseExpense.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    render(<PaymentsPage />);

    await user.click(screen.getByRole("button", { name: /Avulsas/i }));
    const batchButton = screen.getByRole("button", { name: /Pagar todas as despesas/i });
    const itemButtons = screen.getAllByRole("button", { name: /Pagar despesa/i });
    const ignoreButtons = screen.getAllByRole("button", { name: /Não pagar/i });

    expect(batchButton).toBeEnabled();
    expect(itemButtons[0]).toBeEnabled();
    expect(itemButtons[1]).toBeEnabled();
    expect(ignoreButtons[0]).toBeEnabled();
    expect(ignoreButtons[1]).toBeEnabled();

    await user.click(itemButtons[0]);
    await user.selectOptions(screen.getByDisplayValue("Selecione a conta de onde saiu o dinheiro"), "3");
    await user.click(screen.getByRole("button", { name: /Confirmar pagamento da despesa/i }));

    await waitFor(() => {
      expect(payLooseExpense).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number), 3, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), 80, false);
      expect(batchButton).toBeDisabled();
      expect(itemButtons[0]).toBeDisabled();
      expect(itemButtons[1]).toBeDisabled();
      expect(ignoreButtons[0]).toBeDisabled();
      expect(ignoreButtons[1]).toBeDisabled();
    });
  });

  it("requires an explicit confirmation to settle with a different realized total", async () => {
    const user = userEvent.setup();
    usePayments.mockReturnValue({
      ...usePayments(),
      overview: {
        ...usePayments().overview,
        loose_expenses: {
          ...usePayments().overview.loose_expenses,
          transactions: [{
            id: 1, description: "MERCADO", value: 1000, date: "2026-03-10", source: "cash", paid: false,
            payments_total: 300, remaining_amount: 700, payment_status: "partially_paid",
            payments: [{ id: 11, amount: 300, settled_on: "2026-03-05", account: { id: 3, name: "Conta Corrente" } }],
          }],
        },
      },
    });

    render(<PaymentsPage />);
    await user.click(screen.getByRole("button", { name: /Avulsas/i }));
    await user.click(screen.getByRole("button", { name: /Pagar despesa/i }));
    await user.selectOptions(screen.getByDisplayValue("Selecione a conta de onde saiu o dinheiro"), "3");
    await user.clear(screen.getByLabelText("Valor efetivamente pago"));
    await user.type(screen.getByLabelText("Valor efetivamente pago"), "650");
    await user.click(screen.getByRole("button", { name: /Confirmar pagamento da despesa/i }));

    expect(payLooseExpense).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Number), 3, expect.any(String), 650, false);

    await user.click(screen.getByRole("button", { name: /Pagar despesa/i }));
    await user.selectOptions(screen.getByDisplayValue("Selecione a conta de onde saiu o dinheiro"), "3");
    await user.clear(screen.getByLabelText("Valor efetivamente pago"));
    await user.type(screen.getByLabelText("Valor efetivamente pago"), "650");
    await user.click(screen.getByLabelText(/Confirmo que este pagamento quita/i));
    expect(screen.getByText(/Valor nominal: R\$ 1.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/diferença nominal será R\$ 50,00/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Confirmar pagamento da despesa/i }));

    await waitFor(() => expect(payLooseExpense).toHaveBeenLastCalledWith(1, expect.any(Number), expect.any(Number), 3, expect.any(String), 650, true));
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionCreateForm } from "@/features/transactions/components/TransactionCreateForm";
import type { Transaction } from "@/features/transactions/types/transaction.types";

describe("TransactionCreateForm", () => {
  it("shows installment fields only when the checkbox is enabled", async () => {
    const user = userEvent.setup();

    render(<TransactionCreateForm cards={[]} onSubmit={vi.fn()} />);

    expect(screen.queryByPlaceholderText("Parcela atual")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("10")).not.toBeInTheDocument();
    expect(screen.getByText("Valor (R$)")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Compra parcelada"));

    expect(screen.getByPlaceholderText("1")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("10")).toBeInTheDocument();
    expect(screen.getByText("Valor da parcela (R$)")).toBeInTheDocument();
  });

  it("formats the currency input and submits the normalized payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionCreateForm
        cards={[{ id: 7, name: "Nubank" }]}
        accounts={[{ id: 3, name: "Conta Corrente" }]}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Uber Trip");

    const amountInput = screen.getByPlaceholderText("0,00");
    await user.type(amountInput, "1234");
    expect(amountInput).toHaveValue("12,34");

    fireEvent.change(screen.getByDisplayValue("Dinheiro"), { target: { value: "card" } });
    fireEvent.change(screen.getByDisplayValue("Selecione um cartão"), { target: { value: "7" } });
    expect(screen.queryByDisplayValue("Selecione a conta para o pagamento")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Compra parcelada"));
    await user.clear(screen.getByPlaceholderText("1"));
    await user.type(screen.getByPlaceholderText("1"), "2");
    await user.clear(screen.getByPlaceholderText("10"));
    await user.type(screen.getByPlaceholderText("10"), "6");

    await user.click(screen.getByRole("button", { name: "Salvar despesa" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Uber Trip",
          value: 12.34,
          source: "card",
          card_id: 7,
          account_id: null,
          installment_number: 2,
          installments_count: 6,
        })
      );
    });
  });

  it("shows account for cash and bank expenses and submits account_id", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionCreateForm
        cards={[{ id: 7, name: "Nubank" }]}
        accounts={[{ id: 3, name: "Conta Corrente" }]}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("Conta para pagamento")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Selecione a conta para o pagamento")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Pix mercado");
    await user.type(screen.getByPlaceholderText("0,00"), "15000");
    fireEvent.change(screen.getByDisplayValue("Dinheiro"), { target: { value: "bank" } });
    fireEvent.change(screen.getByDisplayValue("Selecione a conta para o pagamento"), { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: "Salvar despesa" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Pix mercado",
          value: 150,
          kind: "expense",
          source: "bank",
          card_id: null,
          account_id: 3,
        })
      );
    });
  });

  it("shows card selection only for card source and clears it when leaving card", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<TransactionCreateForm cards={[{ id: 7, name: "Nubank" }]} onSubmit={onSubmit} />);

    expect(screen.queryByDisplayValue("Selecione um cartão")).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Dinheiro"), { target: { value: "card" } });
    fireEvent.change(screen.getByDisplayValue("Selecione um cartão"), { target: { value: "7" } });
    fireEvent.change(screen.getByDisplayValue("Cartão"), { target: { value: "bank" } });

    expect(screen.queryByDisplayValue("Nubank")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Selecione um cartão")).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Banco"), { target: { value: "card" } });
    expect(screen.getByDisplayValue("Selecione um cartão")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("Cartão"), { target: { value: "bank" } });

    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Pix mercado");
    await user.type(screen.getByPlaceholderText("0,00"), "1000");
    await user.click(screen.getByRole("button", { name: "Salvar despesa" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ source: "bank", card_id: null })));
  });

  it("allows an unpaid cash or bank expense without an account", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionCreateForm
        cards={[]}
        accounts={[{ id: 3, name: "Conta Corrente" }]}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Mercado");
    await user.type(screen.getByPlaceholderText("0,00"), "1000");
    await user.click(screen.getByRole("button", { name: "Salvar despesa" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ paid: false, account_id: null })));
  });

  it("blocks a paid cash or bank expense without an account", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<TransactionCreateForm cards={[]} accounts={[{ id: 3, name: "Conta Corrente" }]} onSubmit={onSubmit} />);

    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Mercado pago");
    await user.type(screen.getByPlaceholderText("0,00"), "1000");
    await user.click(screen.getByLabelText("Marcar como paga"));
    await user.click(screen.getByRole("button", { name: "Salvar despesa" }));

    expect(screen.getByText("Selecione a conta usada no pagamento.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("guides the user to create an account for expenses without card when there are no active accounts", () => {
    render(<TransactionCreateForm cards={[]} accounts={[]} onSubmit={vi.fn()} />);

    expect(screen.getByText("Nenhuma conta cadastrada. Você pode salvar a despesa em aberto sem uma conta.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/accounts");
  });

  it("hides and clears account when switching an expense to card", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionCreateForm
        cards={[{ id: 7, name: "Nubank" }]}
        accounts={[{ id: 3, name: "Conta Corrente" }]}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Compra cartão");
    await user.type(screen.getByPlaceholderText("0,00"), "1000");
    fireEvent.change(screen.getByDisplayValue("Selecione a conta para o pagamento"), { target: { value: "3" } });
    fireEvent.change(screen.getByDisplayValue("Dinheiro"), { target: { value: "card" } });
    fireEvent.change(screen.getByDisplayValue("Selecione um cartão"), { target: { value: "7" } });

    expect(screen.queryByDisplayValue("Conta Corrente")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar despesa" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "card",
          card_id: 7,
          account_id: null,
        })
      );
    });
  });

  it("enables income mode, hides expense-only fields and submits a clean income payload", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionCreateForm
        cards={[{ id: 7, name: "Nubank" }]}
        accounts={[{ id: 3, name: "Conta Corrente" }]}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: "Receita" }));

    expect(screen.getByText("Dados da receita")).toBeInTheDocument();
    expect(screen.getByText("Recebimento")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cartão")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Estorno / crédito no cartão")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Marcar como paga")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Compra parcelada")).not.toBeInTheDocument();
    expect(screen.queryByText("Cartão")).not.toBeInTheDocument();
    expect(screen.getByText("Conta")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Ex: Salário mensal"), "Salario mensal");
    await user.type(screen.getByPlaceholderText("0,00"), "350000");
    fireEvent.change(screen.getByDisplayValue("Dinheiro"), { target: { value: "bank" } });
    fireEvent.change(screen.getByDisplayValue("Selecione a conta onde o dinheiro entrou"), { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Salario mensal",
          value: 3500,
          kind: "income",
          source: "bank",
          paid: true,
          refund: false,
          card_id: null,
          account_id: 3,
          installment_number: null,
          installments_count: null,
        })
      );
    });
  });

  it("clears card, refund and installment state when switching from expense to income", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionCreateForm
        cards={[{ id: 7, name: "Nubank" }]}
        accounts={[{ id: 3, name: "Conta Corrente" }]}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Renda extra");
    await user.type(screen.getByPlaceholderText("0,00"), "10000");
    fireEvent.change(screen.getByDisplayValue("Dinheiro"), { target: { value: "card" } });
    fireEvent.change(screen.getByDisplayValue("Selecione um cartão"), { target: { value: "7" } });
    await user.click(screen.getByLabelText("Estorno / crédito no cartão"));

    await user.click(screen.getByRole("button", { name: "Receita" }));
    fireEvent.change(screen.getByDisplayValue("Selecione a conta onde o dinheiro entrou"), { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "income",
          source: "bank",
          paid: true,
          refund: false,
          card_id: null,
          account_id: 3,
          installment_number: null,
          installments_count: null,
        })
      );
    });
  });

  it("submits card refunds and disables installment fields for them", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionCreateForm
        cards={[{ id: 7, name: "Nubank" }]}
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Uber estorno");
    await user.type(screen.getByPlaceholderText("0,00"), "692");
    fireEvent.change(screen.getByDisplayValue("Dinheiro"), { target: { value: "card" } });
    fireEvent.change(screen.getByDisplayValue("Selecione um cartão"), { target: { value: "7" } });

    await user.click(screen.getByLabelText("Estorno / crédito no cartão"));

    expect(screen.getByLabelText("Compra parcelada")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Salvar despesa" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Uber estorno",
          value: 6.92,
          refund: true,
          source: "card",
          card_id: 7,
          installment_number: null,
          installments_count: null,
        })
      );
    });
  });

  it("blocks income submit without an account", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionCreateForm
        cards={[]}
        accounts={[{ id: 3, name: "Conta Corrente" }]}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole("button", { name: "Receita" }));
    await user.type(screen.getByPlaceholderText("Ex: Salário mensal"), "Salario mensal");
    await user.type(screen.getByPlaceholderText("0,00"), "350000");
    await user.click(screen.getByRole("button", { name: "Salvar receita" }));

    expect(screen.getByText("Selecione a conta onde o dinheiro entrou.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("guides the user to create an account when income mode has no active accounts", async () => {
    const user = userEvent.setup();

    render(<TransactionCreateForm cards={[]} accounts={[]} onSubmit={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Receita" }));

    expect(screen.getByText("Nenhuma conta cadastrada. Crie uma conta antes de lançar receitas.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/accounts");
  });

  it("loads initial values in edit mode and submits an update payload without installment fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const transaction: Transaction = {
      id: 15,
      description: "MERCADO",
      value: 89.9,
      date: "2026-03-18",
      kind: "expense",
      source: "card",
      paid: true,
      note: "Compra do mes",
      card: { id: 7, name: "Nubank" },
      installment_group_id: "grp-1",
      installment_number: 2,
      installments_count: 6,
      category: null,
      classification: null,
    };

    render(
      <TransactionCreateForm
        mode="edit"
        initialTransaction={transaction}
        cards={[{ id: 7, name: "Nubank" }]}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByDisplayValue("MERCADO")).toBeInTheDocument();
    expect(screen.getByDisplayValue("89,90")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2026-03-18")).toBeInTheDocument();
    expect(screen.getByText(/Esta edição afeta apenas a parcela selecionada/i)).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Ex: Compra no supermercado"));
    await user.type(screen.getByPlaceholderText("Ex: Compra no supermercado"), "Mercado novo");
    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Mercado novo",
          value: 89.9,
          date: "2026-03-18",
          source: "card",
          card_id: 7,
          paid: true,
          note: "Compra do mes",
          installment_number: null,
          installments_count: null,
        })
      );
    });
  });

  it("clears the existing card when an edited expense changes to cash", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const transaction: Transaction = {
      id: 16,
      description: "COMPRA",
      value: 20,
      date: "2026-03-18",
      kind: "expense",
      source: "card",
      paid: false,
      card: { id: 7, name: "Nubank" },
      category: null,
      classification: null,
    };

    render(<TransactionCreateForm mode="edit" initialTransaction={transaction} cards={[{ id: 7, name: "Nubank" }]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByDisplayValue("Cartão"), { target: { value: "cash" } });
    expect(screen.queryByDisplayValue("Nubank")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ source: "cash", card_id: null })));
  });
});

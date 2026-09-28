import { render, screen } from "@testing-library/react";
import { TransactionDetailsDialog } from "@/features/transactions/components/TransactionDetailsDialog";
import type { Transaction } from "@/features/transactions/types/transaction.types";

const transaction: Transaction = {
  id: 1,
  description: "INTERNET",
  value: 150,
  original_value: 160,
  date: "2026-08-18",
  purchase_date: "2026-08-10",
  settled_on: "2026-08-22",
  settled_value: 149.26,
  kind: "expense",
  source: "bank",
  paid: true,
  category: { id: 2, name: "Casa" },
  account: { id: 3, name: "Conta Corrente" },
  card: null,
};

describe("TransactionDetailsDialog", () => {
  it("shows origin, obligation, settlement and the negative payment difference without rewriting values", () => {
    render(<TransactionDetailsDialog transaction={transaction} onClose={vi.fn()} />);

    expect(screen.getByText("Título amigável").parentElement).toHaveTextContent("INTERNET");
    expect(screen.getByText("Origem").parentElement).toHaveTextContent("Conta bancária");
    expect(screen.getByText("Account").parentElement).toHaveTextContent("Conta Corrente");
    expect(screen.getByText("Data original da compra").parentElement).toHaveTextContent("10/08/2026");
    expect(screen.getByText("Data da obrigação").parentElement).toHaveTextContent("18/08/2026");
    expect(screen.getByText("Data efetiva do pagamento").parentElement).toHaveTextContent("22/08/2026");
    expect(screen.getByText("Valor original").parentElement).toHaveTextContent(/R\$\s*160,00/);
    expect(screen.getByText("Valor devido").parentElement).toHaveTextContent(/R\$\s*150,00/);
    expect(screen.getByText("Valor efetivamente pago").parentElement).toHaveTextContent(/R\$\s*149,26/);
    expect(screen.getByText("Diferença no pagamento").parentElement).toHaveTextContent(/-R\$\s*0,74 — Menor que o valor devido/);
  });

  it("shows both titles when a friendly title is available", () => {
    render(
      <TransactionDetailsDialog
        transaction={{ ...transaction, friendly_title: "Internet de casa" }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Título amigável").parentElement).toHaveTextContent("Internet de casa");
    expect(screen.getByText("Descrição original").parentElement).toHaveTextContent("INTERNET");
  });

  it.each([
    [158.43, /\+R\$\s*8,43 — Maior que o valor devido/],
    [150, "Sem diferença"],
  ])("describes a neutral payment difference", (settledValue, expected) => {
    render(<TransactionDetailsDialog transaction={{ ...transaction, settled_value: settledValue }} onClose={vi.fn()} />);

    expect(screen.getByText("Diferença no pagamento").parentElement).toHaveTextContent(expected);
  });

  it("keeps card details free of settlement-specific fields", () => {
    render(
      <TransactionDetailsDialog
        transaction={{ ...transaction, source: "card", account: null, card: { id: 7, name: "NUBANK" } }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Cartão", { selector: "dt" }).parentElement).toHaveTextContent("NUBANK");
    expect(screen.queryByText("Diferença no pagamento")).not.toBeInTheDocument();
  });

  it("shows canonical payment history and preserves a negative nominal remaining amount", () => {
    render(
      <TransactionDetailsDialog
        transaction={{
          ...transaction,
          settled_on: null,
          settled_value: null,
          value: 1000,
          paid: true,
          payments_total: 1050,
          remaining_amount: -50,
          payment_status: "paid",
          payments: [
            { id: 1, amount: 300, settled_on: "2026-09-05", account: { id: 3, name: "Conta A" } },
            { id: 2, amount: 750, settled_on: "2026-09-10", account: { id: 4, name: "Conta B" } },
          ],
        }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Status do pagamento").parentElement).toHaveTextContent("Paga");
    expect(screen.getByText("Total realizado").parentElement).toHaveTextContent(/R\$\s*1\.050,00/);
    expect(screen.getByText("Saldo nominal restante").parentElement).toHaveTextContent(/-R\$\s*50,00/);
    expect(screen.getByText("Pagamentos registrados").parentElement).toHaveTextContent("05/09/2026 · Conta A");
    expect(screen.getByText("Pagamentos registrados").parentElement).toHaveTextContent("10/09/2026 · Conta B");
  });
});

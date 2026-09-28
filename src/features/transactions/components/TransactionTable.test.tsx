import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransactionTable } from "@/features/transactions/components/TransactionTable";
import type { Transaction } from "@/features/transactions/types/transaction.types";

const baseTransaction: Transaction = {
  id: 1,
  description: "UBER TRIP 1234",
  value: 32.9,
  date: "2026-03-23",
  kind: "expense",
  source: "cash",
  paid: false,
  category: null,
  card: null,
  classification: {
    status: "suggestion_pending",
    category: null,
    suggestion: {
      id: 99,
      confidence: 0.6,
      source: "rule",
      suggested_category: null,
    },
  },
};

describe("TransactionTable", () => {
  it.each([
    ["2026-08-22", "22/08/2026"],
    ["2026-08-01", "01/08/2026"],
    ["2026-01-01", "01/01/2026"],
    ["2026-12-31", "31/12/2026"],
    ["2024-02-29", "29/02/2024"],
  ])("renders the civil date %s without a timezone shift", (date, expected) => {
    render(<TransactionTable items={[{ ...baseTransaction, date }]} loading={false} />);

    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });

  it("renders the classification badge for a pending suggestion", () => {
    render(<TransactionTable items={[baseTransaction]} loading={false} />);

    expect(screen.getAllByText("Sugestão pendente").length).toBeGreaterThan(0);
  });

  it("prefers the friendly title when one is available", () => {
    render(
      <TransactionTable
        items={[{ ...baseTransaction, friendly_title: "Corrida para o aeroporto" }]}
        loading={false}
      />
    );

    expect(screen.getAllByText("Corrida para o aeroporto").length).toBeGreaterThan(0);
  });

  it("shows the review action and calls the callback for pending transactions", async () => {
    const user = userEvent.setup();
    const onReviewClassification = vi.fn();

    render(
      <TransactionTable
        items={[baseTransaction]}
        loading={false}
        onReviewClassification={onReviewClassification}
      />
    );

    const triggers = screen.getAllByRole("button");
    await user.click(triggers[0]);
    await user.click(screen.getByRole("menuitem", { name: /Revisar classificação/i }));

    expect(onReviewClassification).toHaveBeenCalledWith(baseTransaction);
  });

  it("shows the archive action when deletion is available", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(<TransactionTable items={[baseTransaction]} loading={false} onDelete={onDelete} />);

    await user.click(screen.getAllByRole("button")[0]);

    expect(screen.getByRole("menuitem", { name: /Arquivar/i })).toBeInTheDocument();
  });

  it("renders refunds as green credits without a duplicated negative sign", () => {
    const refundTransaction: Transaction = {
      ...baseTransaction,
      id: 2,
      value: 6.92,
      signed_value: -6.92,
      refund: true,
      source: "card",
      card: { id: 7, name: "NUBANK" },
    };

    const { container } = render(<TransactionTable items={[refundTransaction]} loading={false} />);

    expect(container).not.toHaveTextContent("- -R$ 6,92");
    expect(screen.getAllByText(/\+\s*R\$\s*6,92/).length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Estorno / crédito").length).toBeGreaterThan(0);
  });

  it.each([
    ["open expense", { paid: false, settled_value: null }, /R\$\s*32,90/],
    ["paid expense with a lower settled value", { paid: true, settled_value: 149.26, value: 150 }, /R\$\s*149,26/],
    ["paid expense with a higher settled value", { paid: true, settled_value: 158.43, value: 150 }, /R\$\s*158,43/],
    ["paid historical expense without settlement", { paid: true, settled_value: null, value: 150 }, /R\$\s*150,00/],
  ])("shows the correct main amount for a %s", (_scenario, changes, expected) => {
    render(<TransactionTable items={[{ ...baseTransaction, ...changes }]} loading={false} />);

    expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
  });

  it("keeps the due value as the main amount for card purchases", () => {
    render(
      <TransactionTable
        items={[{ ...baseTransaction, source: "card", card: { id: 7, name: "NUBANK" }, paid: true, value: 150, settled_value: 149.26 }]}
        loading={false}
      />
    );

    expect(screen.getAllByText(/R\$\s*150,00/).length).toBeGreaterThan(0);
  });
});

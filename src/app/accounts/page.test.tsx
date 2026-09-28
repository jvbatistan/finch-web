import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountsPage from "@/app/accounts/page";
import { todayLocalCivilDate } from "@/lib/civil-date";

const push = vi.fn();
const replace = vi.fn();
const routerMock = { push, replace };
const refetchActive = vi.fn();
const refetchArchived = vi.fn();
const createAccount = vi.fn();
const fetchAccountTransfers = vi.fn();
const createAccountTransfer = vi.fn();
const reverseAccountTransfer = vi.fn();
const updateAccount = vi.fn();
const archiveAccount = vi.fn();
const restoreAccount = vi.fn();
const useAccounts = vi.fn();
const useAuth = vi.fn();

const activeAccounts = [
  {
    id: 1,
    name: "Nubank",
    kind: "checking" as const,
    initial_balance: "2000.0",
    initial_balance_date: "2026-07-01",
    current_balance: "2250.0",
    archived_at: null,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
  },
  {
    id: 2,
    name: "Carteira",
    kind: "wallet" as const,
    initial_balance: "100.0",
    initial_balance_date: "2026-07-01",
    current_balance: "-20.0",
    archived_at: null,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
  },
  {
    id: 4,
    name: "Inter",
    kind: "savings" as const,
    initial_balance: "0.0",
    initial_balance_date: "2026-07-10",
    current_balance: "0.0",
    archived_at: null,
    created_at: "2026-07-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
  },
];

const archivedAccounts = [
  {
    id: 3,
    name: "PicPay",
    kind: "digital_wallet" as const,
    initial_balance: "50.0",
    initial_balance_date: "2026-06-01",
    current_balance: "65.0",
    archived_at: "2026-07-01T10:00:00Z",
    created_at: "2026-06-01T10:00:00Z",
    updated_at: "2026-07-01T10:00:00Z",
  },
];

const accountTransfers = [
  {
    id: 10,
    from_account: { id: 1, name: "Nubank" },
    to_account: { id: 2, name: "Carteira" },
    amount: "200.0",
    transferred_on: "2026-07-18",
    description: "Reserva do mês",
    note: "Movido para carteira",
    status: "completed" as const,
    created_at: "2026-07-18T10:00:00Z",
    updated_at: "2026-07-18T10:00:00Z",
  },
  {
    id: 11,
    from_account: { id: 2, name: "Carteira" },
    to_account: { id: 4, name: "Inter" },
    amount: "50.0",
    transferred_on: "2026-07-17",
    description: null,
    note: null,
    status: "reversed" as const,
    created_at: "2026-07-17T10:00:00Z",
    updated_at: "2026-07-17T10:00:00Z",
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
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

vi.mock("@/features/accounts", () => ({
  useAccounts: (...args: unknown[]) => useAccounts(...args),
  createAccount: (...args: unknown[]) => createAccount(...args),
  fetchAccountTransfers: (...args: unknown[]) => fetchAccountTransfers(...args),
  createAccountTransfer: (...args: unknown[]) => createAccountTransfer(...args),
  reverseAccountTransfer: (...args: unknown[]) => reverseAccountTransfer(...args),
  updateAccount: (...args: unknown[]) => updateAccount(...args),
  archiveAccount: (...args: unknown[]) => archiveAccount(...args),
  restoreAccount: (...args: unknown[]) => restoreAccount(...args),
}));

beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  refetchActive.mockReset().mockResolvedValue(undefined);
  refetchArchived.mockReset().mockResolvedValue(undefined);
  createAccount.mockReset().mockResolvedValue({ status: 201, data: { id: 4, name: "Inter" } });
  fetchAccountTransfers.mockReset().mockResolvedValue({ status: 200, data: accountTransfers });
  createAccountTransfer.mockReset().mockResolvedValue({ status: 201, data: accountTransfers[0] });
  reverseAccountTransfer.mockReset().mockResolvedValue({ status: 200, data: { ...accountTransfers[0], status: "reversed" } });
  updateAccount.mockReset().mockResolvedValue({ status: 200, data: { id: 1, name: "Inter" } });
  archiveAccount.mockReset().mockResolvedValue({ status: 200, data: { id: 1, name: "Nubank" } });
  restoreAccount.mockReset().mockResolvedValue({ status: 200, data: { id: 3, name: "PicPay" } });
  useAuth.mockReturnValue({
    status: "authenticated",
    user: { id: 1, name: "Joao", email: "joao@example.com", active: true },
  });
  useAccounts.mockImplementation((params: { archived?: boolean }) => {
    if (params.archived) {
      return { accounts: archivedAccounts, loading: false, error: null, refetch: refetchArchived };
    }

    return { accounts: activeAccounts, loading: false, error: null, refetch: refetchActive };
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AccountsPage", () => {
  it("defaults account and transfer dates to the local day at the UTC boundary", () => {
    const originalTimeZone = process.env.TZ;

    try {
      process.env.TZ = "America/Sao_Paulo";
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-01T02:30:00Z"));
      fetchAccountTransfers.mockReturnValueOnce(new Promise(() => {}));

      render(<AccountsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Nova conta/i }));
      expect(screen.getByDisplayValue("2026-02-28")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
      fireEvent.click(screen.getAllByRole("button", { name: /Transferir/i })[0]);
      expect(screen.getByDisplayValue("2026-02-28")).toHaveAttribute("max", "2026-02-28");
    } finally {
      vi.useRealTimers();
      process.env.TZ = originalTimeZone;
    }
  });

  it("renders active and archived accounts with available types", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    expect(screen.getByText("Contas")).toBeInTheDocument();
    expect(screen.getByText("Gerencie onde seu dinheiro está.")).toBeInTheDocument();
    expect(screen.getAllByText("Nubank").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carteira").length).toBeGreaterThan(0);
    expect(screen.getByText("Inter")).toBeInTheDocument();
    expect(screen.getByText("PicPay")).toBeInTheDocument();
    expect(screen.getByText("Patrimônio disponível")).toBeInTheDocument();
    expect(screen.getByText("Soma dos saldos atuais das contas ativas")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.230,00")).toBeInTheDocument();
    expect(screen.getByText("-R$ 20,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 0,00").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 65,00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Nova conta/i }));

    expect(screen.getByDisplayValue("Conta corrente")).toBeInTheDocument();
    expect(screen.getAllByText("Carteira digital").length).toBeGreaterThan(0);
  });

  it("navigates to the account statement for active and archived accounts", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    const statementActions = screen.getAllByRole("button", { name: /Ver extrato/i });
    expect(statementActions).toHaveLength(4);

    await user.click(statementActions[0]);
    expect(push).toHaveBeenCalledWith("/accounts/1");

    await user.click(statementActions[3]);
    expect(push).toHaveBeenCalledWith("/accounts/3");
  });

  it("creates an account and refreshes active and archived lists", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getByRole("button", { name: /Nova conta/i }));
    await user.type(screen.getByPlaceholderText("Ex: Nubank"), "Inter");
    fireEvent.change(screen.getByDisplayValue("Conta corrente"), { target: { value: "savings" } });
    fireEvent.change(screen.getByDisplayValue("0"), { target: { value: "1500,50" } });

    await user.click(screen.getByRole("button", { name: /Criar conta/i }));

    await waitFor(() => {
      expect(createAccount).toHaveBeenCalledWith({
        name: "Inter",
        kind: "savings",
        initial_balance: 1500.5,
        initial_balance_date: expect.any(String),
      });
      expect(refetchActive).toHaveBeenCalled();
      expect(refetchArchived).toHaveBeenCalled();
      expect(screen.getByText("Conta criada com sucesso.")).toBeInTheDocument();
    });
  });

  it("edits an account", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Editar/i })[0]);
    fireEvent.change(screen.getByDisplayValue("Nubank"), { target: { value: "Nubank Principal" } });

    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith(1, {
        name: "Nubank Principal",
        kind: "checking",
        initial_balance: 2000,
        initial_balance_date: "2026-07-01",
      });
      expect(screen.getByText("Conta atualizada com sucesso.")).toBeInTheDocument();
    });
  });

  it("archives an account after confirmation", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Arquivar/i })[0]);

    await waitFor(() => {
      expect(archiveAccount).toHaveBeenCalledWith(1);
      expect(refetchActive).toHaveBeenCalled();
      expect(refetchArchived).toHaveBeenCalled();
      expect(screen.getByText("Conta arquivada com sucesso.")).toBeInTheDocument();
    });
  });

  it("restores an archived account", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getByRole("button", { name: /Restaurar/i }));

    await waitFor(() => {
      expect(restoreAccount).toHaveBeenCalledWith(3);
      expect(refetchActive).toHaveBeenCalled();
      expect(refetchArchived).toHaveBeenCalled();
      expect(screen.getByText("Conta restaurada com sucesso.")).toBeInTheDocument();
    });
  });

  it("shows a friendly error when saving fails", async () => {
    const user = userEvent.setup();
    createAccount.mockRejectedValueOnce(new Error("Nome já está em uso"));

    render(<AccountsPage />);

    await user.click(screen.getByRole("button", { name: /Nova conta/i }));
    await user.type(screen.getByPlaceholderText("Ex: Nubank"), "Nubank");
    await user.click(screen.getByRole("button", { name: /Criar conta/i }));

    expect(await screen.findByText("Nome já está em uso")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    useAccounts.mockImplementation((params: { archived?: boolean }) => ({
      accounts: [],
      loading: true,
      error: null,
      refetch: params.archived ? refetchArchived : refetchActive,
    }));

    render(<AccountsPage />);

    expect(screen.getByText("Carregando contas...")).toBeInTheDocument();
    expect(screen.getByText("Carregando contas arquivadas...")).toBeInTheDocument();
  });

  it("renders transfer action, history and statuses", async () => {
    render(<AccountsPage />);

    expect(screen.getAllByRole("button", { name: /Transferir/i }).length).toBeGreaterThan(0);
    expect(await screen.findByText("Últimas transferências")).toBeInTheDocument();
    expect(screen.getAllByText("Nubank").length).toBeGreaterThan(0);
    expect(screen.getByText("Reserva do mês")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByText("Revertida")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reverter/i })).toBeInTheDocument();
  });

  it("disables transfer action with fewer than two active accounts", () => {
    useAccounts.mockImplementation((params: { archived?: boolean }) => {
      if (params.archived) {
        return { accounts: archivedAccounts, loading: false, error: null, refetch: refetchArchived };
      }

      return { accounts: [activeAccounts[0]], loading: false, error: null, refetch: refetchActive };
    });

    render(<AccountsPage />);

    expect(screen.getAllByRole("button", { name: /Transferir/i })[0]).toBeDisabled();
    expect(screen.getByText("Cadastre pelo menos duas contas ativas para transferir dinheiro entre elas.")).toBeInTheDocument();
  });

  it("opens transfer modal with active accounts only and required fields", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Transferir/i })[0]);

    expect(screen.getByText("Transferir entre contas")).toBeInTheDocument();
    expect(screen.getByText("Conta de origem *")).toBeInTheDocument();
    expect(screen.getByText("Conta de destino *")).toBeInTheDocument();
    expect(screen.getByText("Valor *")).toBeInTheDocument();
    expect(screen.getByText("Data *")).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: /Nubank/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("option", { name: /PicPay/ })).not.toBeInTheDocument();
  });

  it("creates a transfer with the expected payload and refreshes accounts and history", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Transferir/i })[0]);
    fireEvent.change(screen.getByDisplayValue("Selecione a origem"), { target: { value: "1" } });
    fireEvent.change(screen.getByDisplayValue("Selecione o destino"), { target: { value: "2" } });
    await user.type(screen.getByPlaceholderText("0,00"), "200,50");
    fireEvent.change(screen.getByDisplayValue(todayLocalCivilDate()), { target: { value: "2026-07-18" } });
    await user.type(screen.getByPlaceholderText("Ex: Reserva do mês"), "Reserva do mês");
    await user.type(screen.getByPlaceholderText("Opcional"), "Movido para carteira");

    await user.click(screen.getByRole("button", { name: /Criar transferência/i }));

    await waitFor(() => {
      expect(createAccountTransfer).toHaveBeenCalledWith({
        from_account_id: 1,
        to_account_id: 2,
        amount: "200.50",
        transferred_on: "2026-07-18",
        description: "Reserva do mês",
        note: "Movido para carteira",
      });
      expect(refetchActive).toHaveBeenCalled();
      expect(refetchArchived).toHaveBeenCalled();
      expect(fetchAccountTransfers).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Transferência criada com sucesso.")).toBeInTheDocument();
    });
  });

  it("rejects invalid transfer form values before sending", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Transferir/i })[0]);
    await user.click(screen.getByRole("button", { name: /Criar transferência/i }));

    expect(await screen.findByText("Selecione a conta de origem.")).toBeInTheDocument();
    expect(createAccountTransfer).not.toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue("Selecione a origem"), { target: { value: "1" } });
    fireEvent.change(screen.getByDisplayValue("Selecione o destino"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "0" } });
    await user.click(screen.getByRole("button", { name: /Criar transferência/i }));

    expect(await screen.findByText("Informe um valor maior que zero.")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "-10" } });
    await user.click(screen.getByRole("button", { name: /Criar transferência/i }));

    expect(await screen.findByText("Informe um valor maior que zero.")).toBeInTheDocument();

    expect(createAccountTransfer).not.toHaveBeenCalled();
  });

  it("prevents future transfer dates", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Transferir/i })[0]);
    const dateInput = screen.getByDisplayValue(todayLocalCivilDate());

    expect(dateInput).toHaveAttribute("max", todayLocalCivilDate());

    fireEvent.change(screen.getByDisplayValue("Selecione a origem"), { target: { value: "1" } });
    fireEvent.change(screen.getByDisplayValue("Selecione o destino"), { target: { value: "2" } });
    fireEvent.change(screen.getByPlaceholderText("0,00"), { target: { value: "10" } });
    fireEvent.change(dateInput, { target: { value: "2999-01-01" } });
    await user.click(screen.getByRole("button", { name: /Criar transferência/i }));

    expect(createAccountTransfer).not.toHaveBeenCalled();
  });

  it("shows API error when transfer creation fails", async () => {
    const user = userEvent.setup();
    createAccountTransfer.mockRejectedValueOnce(new Error("Conta não encontrada."));

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Transferir/i })[0]);
    fireEvent.change(screen.getByDisplayValue("Selecione a origem"), { target: { value: "1" } });
    fireEvent.change(screen.getByDisplayValue("Selecione o destino"), { target: { value: "2" } });
    await user.type(screen.getByPlaceholderText("0,00"), "200");
    await user.click(screen.getByRole("button", { name: /Criar transferência/i }));

    expect(await screen.findByText("Conta não encontrada.")).toBeInTheDocument();
  });

  it("shows loading while creating a transfer", async () => {
    const user = userEvent.setup();
    createAccountTransfer.mockReturnValueOnce(new Promise(() => undefined));

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Transferir/i })[0]);
    fireEvent.change(screen.getByDisplayValue("Selecione a origem"), { target: { value: "1" } });
    fireEvent.change(screen.getByDisplayValue("Selecione o destino"), { target: { value: "2" } });
    await user.type(screen.getByPlaceholderText("0,00"), "200");
    await user.click(screen.getByRole("button", { name: /Criar transferência/i }));

    expect(screen.getByRole("button", { name: /Transferindo/i })).toBeDisabled();
  });


  it("warns but does not block when transfer makes origin balance negative", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(screen.getAllByRole("button", { name: /Transferir/i })[0]);
    fireEvent.change(screen.getByDisplayValue("Selecione a origem"), { target: { value: "2" } });
    await user.type(screen.getByPlaceholderText("0,00"), "200");

    expect(screen.getByText("Esta transferência deixará a conta de origem com saldo negativo.")).toBeInTheDocument();
  });

  it("reverses a completed transfer after confirmation and refreshes accounts and history", async () => {
    const user = userEvent.setup();

    render(<AccountsPage />);

    await user.click(await screen.findByRole("button", { name: /Reverter/i }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        "Deseja reverter esta transferência?\n\nOs valores voltarão aos saldos anteriores das contas, mas o registro continuará no histórico."
      );
      expect(reverseAccountTransfer).toHaveBeenCalledWith(10);
      expect(refetchActive).toHaveBeenCalled();
      expect(refetchArchived).toHaveBeenCalled();
      expect(fetchAccountTransfers).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Transferência revertida com sucesso.")).toBeInTheDocument();
    });
  });

  it("shows loading while reversing a transfer", async () => {
    const user = userEvent.setup();
    reverseAccountTransfer.mockReturnValueOnce(new Promise(() => undefined));

    render(<AccountsPage />);

    await user.click(await screen.findByRole("button", { name: /Reverter/i }));

    expect(screen.getByRole("button", { name: /Revertendo/i })).toBeDisabled();
  });

  it("does not show reverse action for already reversed transfers", async () => {
    fetchAccountTransfers.mockResolvedValueOnce({ status: 200, data: [accountTransfers[1]] });

    render(<AccountsPage />);

    expect(await screen.findByText("Revertida")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reverter/i })).not.toBeInTheDocument();
  });

  it("shows empty transfer history and load errors", async () => {
    fetchAccountTransfers.mockResolvedValueOnce({ status: 200, data: [] });

    const { unmount } = render(<AccountsPage />);

    expect(await screen.findByText("Nenhuma transferência registrada.")).toBeInTheDocument();

    unmount();
    fetchAccountTransfers.mockRejectedValueOnce(new Error("Falha"));
    render(<AccountsPage />);

    expect(await screen.findByText("Não foi possível carregar as transferências.")).toBeInTheDocument();
  });

  it("shows API error when reversing fails", async () => {
    const user = userEvent.setup();
    reverseAccountTransfer.mockRejectedValueOnce(new Error("Não foi possível reverter."));

    render(<AccountsPage />);

    await user.click(await screen.findByRole("button", { name: /Reverter/i }));

    expect(await screen.findByText("Não foi possível reverter.")).toBeInTheDocument();
  });
});

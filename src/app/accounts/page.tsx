"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowRight, ArrowRightLeft, Eye, Pencil, Plus, RotateCcw, Wallet, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTriggerHTML } from "@/components/ui/select";
import {
  archiveAccount,
  createAccountTransfer,
  createAccount,
  fetchAccountTransfers,
  reverseAccountTransfer,
  restoreAccount,
  updateAccount,
  useAccounts,
  type Account,
  type AccountTransfer,
  type AccountKind,
} from "@/features/accounts";
import { useAuth } from "@/lib/useAuth";
import { formatCivilDateBR, todayLocalCivilDate } from "@/lib/civil-date";

const accountKindOptions: Array<{ value: AccountKind; label: string }> = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Poupança" },
  { value: "wallet", label: "Carteira" },
  { value: "digital_wallet", label: "Carteira digital" },
  { value: "other", label: "Outra" },
];

function initialForm() {
  return {
    name: "",
    kind: "checking" as AccountKind,
    initial_balance: "0",
    initial_balance_date: todayLocalCivilDate(),
  };
}

function initialTransferForm() {
  return {
    from_account_id: "",
    to_account_id: "",
    amount: "",
    transferred_on: todayLocalCivilDate(),
    description: "",
    note: "",
  };
}

function formatBRL(value: number | string) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function kindLabel(kind: AccountKind) {
  return accountKindOptions.find((option) => option.value === kind)?.label ?? kind;
}

function parseMoney(value: string) {
  const input = value.trim();
  const normalized = input.includes(",") ? input.replace(/\./g, "").replace(",", ".") : input;
  return Number(normalized || "0");
}

export default function AccountsPage() {
  const router = useRouter();
  const auth = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState(initialForm);
  const [transferForm, setTransferForm] = useState(initialTransferForm);
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(true);
  const [transfersError, setTransfersError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [reversingTransferId, setReversingTransferId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleUnauthorized = useCallback(() => router.replace("/login"), [router]);

  useEffect(() => {
    if (auth.status === "unauthenticated") router.replace("/login");
  }, [auth.status, router]);

  const activeAccounts = useAccounts({
    enabled: auth.status === "authenticated",
    onUnauthorized: handleUnauthorized,
  });
  const archivedAccounts = useAccounts({
    enabled: auth.status === "authenticated",
    onUnauthorized: handleUnauthorized,
    archived: true,
  });

  const loadTransfers = useCallback(async (signal?: AbortSignal) => {
    try {
      setTransfersLoading(true);
      setTransfersError(null);
      const result = await fetchAccountTransfers({ signal });

      if (result.status === 401) {
        handleUnauthorized();
        return;
      }

      setTransfers(Array.isArray(result.data) ? result.data : result.data.transfers);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error(err);
        setTransfers([]);
        setTransfersError("Não foi possível carregar as transferências.");
      }
    } finally {
      if (!signal?.aborted) setTransfersLoading(false);
    }
  }, [handleUnauthorized]);

  useEffect(() => {
    if (auth.status !== "authenticated") return;

    const controller = new AbortController();
    void loadTransfers(controller.signal);

    return () => controller.abort();
  }, [auth.status, loadTransfers]);

  const availablePatrimony = useMemo(
    () => activeAccounts.accounts.reduce((sum, account) => sum + Number(account.current_balance), 0),
    [activeAccounts.accounts]
  );
  const walletAccountsCount = useMemo(
    () => activeAccounts.accounts.filter((account) => account.kind === "wallet" || account.kind === "digital_wallet").length,
    [activeAccounts.accounts]
  );
  const canTransfer = activeAccounts.accounts.length >= 2;
  const latestTransfers = transfers;
  const selectedFromAccount = useMemo(
    () => activeAccounts.accounts.find((account) => String(account.id) === transferForm.from_account_id),
    [activeAccounts.accounts, transferForm.from_account_id]
  );
  const transferAmount = parseMoney(transferForm.amount);
  const transferWouldMakeOriginNegative = Boolean(
    selectedFromAccount && transferAmount > Number(selectedFromAccount.current_balance)
  );

  function resetForm() {
    setForm(initialForm());
    setEditingAccount(null);
    setIsDialogOpen(false);
  }

  function resetTransferForm() {
    setTransferForm(initialTransferForm());
    setIsTransferDialogOpen(false);
  }

  function openCreateDialog() {
    setEditingAccount(null);
    setForm(initialForm());
    setActionError(null);
    setMessage(null);
    setIsDialogOpen(true);
  }

  function openTransferDialog() {
    if (!canTransfer) return;

    setTransferForm(initialTransferForm());
    setActionError(null);
    setMessage(null);
    setIsTransferDialogOpen(true);
  }

  function startEdit(account: Account) {
    setEditingAccount(account);
    setForm({
      name: account.name,
      kind: account.kind,
      initial_balance: String(account.initial_balance),
      initial_balance_date: account.initial_balance_date,
    });
    setActionError(null);
    setMessage(null);
    setIsDialogOpen(true);
  }

  function viewStatement(account: Account) {
    router.push(`/accounts/${account.id}`);
  }

  async function refetchAll() {
    await Promise.all([activeAccounts.refetch(), archivedAccounts.refetch()]);
  }

  async function refetchAccountsAndTransfers() {
    await Promise.all([refetchAll(), loadTransfers()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setActionError(null);
    setMessage(null);

    try {
      const payload = {
        name: form.name.trim(),
        kind: form.kind,
        initial_balance: parseMoney(form.initial_balance),
        initial_balance_date: form.initial_balance_date,
      };

      if (editingAccount) {
        const result = await updateAccount(editingAccount.id, payload);
        if (result.status === 401) {
          handleUnauthorized();
          return;
        }
        setMessage("Conta atualizada com sucesso.");
      } else {
        const result = await createAccount(payload);
        if (result.status === 401) {
          handleUnauthorized();
          return;
        }
        setMessage("Conta criada com sucesso.");
      }

      resetForm();
      await refetchAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível salvar a conta.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(account: Account) {
    const confirmed = window.confirm(`Arquivar a conta "${account.name}"?`);
    if (!confirmed) return;

    setActionError(null);
    setMessage(null);

    try {
      const result = await archiveAccount(account.id);
      if (result.status === 401) {
        handleUnauthorized();
        return;
      }
      setMessage("Conta arquivada com sucesso.");
      await refetchAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível arquivar a conta.");
    }
  }

  async function handleRestore(account: Account) {
    setActionError(null);
    setMessage(null);

    try {
      const result = await restoreAccount(account.id);
      if (result.status === 401) {
        handleUnauthorized();
        return;
      }
      setMessage("Conta restaurada com sucesso.");
      await refetchAll();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível restaurar a conta.");
    }
  }

  async function handleCreateTransfer(e: React.FormEvent) {
    e.preventDefault();
    setTransferSubmitting(true);
    setActionError(null);
    setMessage(null);

    try {
      const validationError = validateTransferForm(transferForm);
      if (validationError) throw new Error(validationError);

      const payload = {
        from_account_id: Number(transferForm.from_account_id),
        to_account_id: Number(transferForm.to_account_id),
        amount: parseMoney(transferForm.amount).toFixed(2),
        transferred_on: transferForm.transferred_on,
        description: transferForm.description.trim() || undefined,
        note: transferForm.note.trim() || undefined,
      };

      const result = await createAccountTransfer(payload);
      if (result.status === 401) {
        handleUnauthorized();
        return;
      }

      resetTransferForm();
      setMessage("Transferência criada com sucesso.");
      await refetchAccountsAndTransfers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível criar a transferência.");
    } finally {
      setTransferSubmitting(false);
    }
  }

  async function handleReverseTransfer(transfer: AccountTransfer) {
    const confirmed = window.confirm(
      "Deseja reverter esta transferência?\n\nOs valores voltarão aos saldos anteriores das contas, mas o registro continuará no histórico."
    );
    if (!confirmed) return;

    setReversingTransferId(transfer.id);
    setActionError(null);
    setMessage(null);

    try {
      const result = await reverseAccountTransfer(transfer.id);
      if (result.status === 401) {
        handleUnauthorized();
        return;
      }

      setMessage("Transferência revertida com sucesso.");
      await refetchAccountsAndTransfers();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível reverter a transferência.");
    } finally {
      setReversingTransferId(null);
    }
  }

  if (auth.status !== "authenticated") {
    return <div className="min-h-screen bg-neutral-50" />;
  }

  return (
    <AppLayout>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Contas</h1>
          <p className="mt-1 text-sm text-neutral-500 sm:text-base">Gerencie onde seu dinheiro está.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            onClick={openTransferDialog}
            disabled={!canTransfer || activeAccounts.loading}
            className="w-full rounded-xl bg-blue-600 text-white hover:bg-blue-700 sm:w-auto"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transferir
          </Button>
          <Button type="button" onClick={openCreateDialog} className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Nova conta
          </Button>
        </div>
      </div>

      {!canTransfer && !activeAccounts.loading && (
        <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Cadastre pelo menos duas contas ativas para transferir dinheiro entre elas.
        </p>
      )}

      {message && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>
      )}

      {actionError && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
      )}

      {(activeAccounts.error || archivedAccounts.error) && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {activeAccounts.error ?? archivedAccounts.error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Contas ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900 sm:text-3xl">{activeAccounts.accounts.length}</div>
            <p className="mt-1 text-xs text-neutral-500">Locais financeiros cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Patrimônio disponível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold sm:text-3xl ${balanceTextClass(availablePatrimony)}`}>{formatBRL(availablePatrimony)}</div>
            <p className="mt-1 text-xs text-neutral-500">Soma dos saldos atuais das contas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Carteiras</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 sm:text-3xl">{walletAccountsCount}</div>
            <p className="mt-1 text-xs text-neutral-500">Carteiras físicas ou digitais</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contas ativas</CardTitle>
          <p className="mt-1 text-sm text-neutral-500">Saldo patrimonial calculado por receitas, despesas sem cartão e pagamentos de fatura vinculados.</p>
        </CardHeader>
        <CardContent>
          {activeAccounts.loading ? (
            <p className="text-sm text-neutral-500">Carregando contas...</p>
          ) : activeAccounts.accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-500">
              <Wallet className="mx-auto mb-4 h-12 w-12 text-neutral-300" />
              <h3 className="mb-2 text-lg font-medium text-neutral-900">Nenhuma conta cadastrada</h3>
              <p className="mb-4 text-neutral-500">Comece criando o local onde seu dinheiro está.</p>
              <Button type="button" onClick={openCreateDialog} className="bg-emerald-600 text-white hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" />
                Nova conta
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {activeAccounts.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onViewStatement={viewStatement}
                  onEdit={startEdit}
                  onArchive={(selected) => void handleArchive(selected)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Últimas transferências</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">Movimentos entre contas. Não aparecem como receita ou despesa.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={openTransferDialog}
            disabled={!canTransfer || activeAccounts.loading}
            className="w-full sm:w-auto"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transferir
          </Button>
        </CardHeader>
        <CardContent>
          {transfersLoading ? (
            <p className="text-sm text-neutral-500">Carregando transferências...</p>
          ) : transfersError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{transfersError}</p>
          ) : latestTransfers.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma transferência registrada.</p>
          ) : (
            <div className="space-y-3">
              {latestTransfers.map((transfer) => (
                <TransferCard
                  key={transfer.id}
                  transfer={transfer}
                  reversing={reversingTransferId === transfer.id}
                  onReverse={(selected) => void handleReverseTransfer(selected)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contas arquivadas</CardTitle>
          <p className="mt-1 text-sm text-neutral-500">Restaure uma conta se ela voltar a ser usada.</p>
        </CardHeader>
        <CardContent>
          {archivedAccounts.loading ? (
            <p className="text-sm text-neutral-500">Carregando contas arquivadas...</p>
          ) : archivedAccounts.accounts.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma conta arquivada.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {archivedAccounts.accounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  archived
                  onViewStatement={viewStatement}
                  onRestore={(selected) => void handleRestore(selected)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">{editingAccount ? "Editar conta" : "Nova conta"}</h2>
                <p className="mt-1 text-sm text-neutral-500">Informe o local financeiro e o saldo inicial conhecido.</p>
              </div>
              <button type="button" onClick={resetForm} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Nome</label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex: Nubank"
                  disabled={submitting}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Tipo</label>
                  <Select value={form.kind} onValueChange={(value) => setForm((current) => ({ ...current, kind: value as AccountKind }))}>
                    <SelectTriggerHTML
                      placeholder="Selecione o tipo"
                      options={accountKindOptions}
                      className="h-11 rounded-xl"
                    />
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Data do saldo inicial</label>
                  <Input
                    type="date"
                    value={form.initial_balance_date}
                    onChange={(event) => setForm((current) => ({ ...current, initial_balance_date: event.target.value }))}
                    disabled={submitting}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Saldo inicial</label>
                <Input
                  value={form.initial_balance}
                  onChange={(event) => setForm((current) => ({ ...current, initial_balance: event.target.value }))}
                  placeholder="0,00"
                  inputMode="decimal"
                  disabled={submitting}
                  className="h-11 rounded-xl"
                />
                <p className="text-xs text-neutral-500">Saldo inicial não é receita e não entra no dashboard como income.</p>
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={resetForm} disabled={submitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  {submitting ? "Salvando..." : editingAccount ? "Salvar alterações" : "Criar conta"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTransferDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-neutral-900">Transferir entre contas</h2>
                <p className="mt-1 text-sm text-neutral-500">Movimente dinheiro entre contas sem alterar receitas, despesas ou dashboard mensal.</p>
              </div>
              <button type="button" onClick={resetTransferForm} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Conta de origem *</label>
                  <Select
                    value={transferForm.from_account_id}
                    onValueChange={(value) => setTransferForm((current) => ({
                      ...current,
                      from_account_id: value,
                      to_account_id: current.to_account_id === value ? "" : current.to_account_id,
                    }))}
                  >
                    <SelectTriggerHTML
                      placeholder="Selecione a origem"
                      options={accountTransferOptions(activeAccounts.accounts)}
                      className="h-11 rounded-xl"
                    />
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Conta de destino *</label>
                  <Select
                    value={transferForm.to_account_id}
                    onValueChange={(value) => setTransferForm((current) => ({ ...current, to_account_id: value }))}
                  >
                    <SelectTriggerHTML
                      placeholder="Selecione o destino"
                      options={accountTransferOptions(activeAccounts.accounts, transferForm.from_account_id)}
                      className="h-11 rounded-xl"
                    />
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Valor *</label>
                  <Input
                    value={transferForm.amount}
                    onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="0,00"
                    inputMode="decimal"
                    disabled={transferSubmitting}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-800">Data *</label>
                  <Input
                    type="date"
                    value={transferForm.transferred_on}
                    max={todayLocalCivilDate()}
                    onChange={(event) => setTransferForm((current) => ({ ...current, transferred_on: event.target.value }))}
                    disabled={transferSubmitting}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>

              {transferWouldMakeOriginNegative && (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Esta transferência deixará a conta de origem com saldo negativo.
                </p>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Descrição</label>
                <Input
                  value={transferForm.description}
                  onChange={(event) => setTransferForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Ex: Reserva do mês"
                  disabled={transferSubmitting}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-800">Observação</label>
                <Input
                  value={transferForm.note}
                  onChange={(event) => setTransferForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder="Opcional"
                  disabled={transferSubmitting}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={resetTransferForm} disabled={transferSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={transferSubmitting} className="bg-blue-600 text-white hover:bg-blue-700">
                  {transferSubmitting ? "Transferindo..." : "Criar transferência"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function AccountCard({
  account,
  archived = false,
  onEdit,
  onArchive,
  onRestore,
  onViewStatement,
}: {
  account: Account;
  archived?: boolean;
  onEdit?: (account: Account) => void;
  onArchive?: (account: Account) => void;
  onRestore?: (account: Account) => void;
  onViewStatement?: (account: Account) => void;
}) {
  const currentBalance = Number(account.current_balance);

  return (
    <div className="rounded-2xl border border-neutral-200 p-4 transition hover:bg-neutral-50">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-neutral-950">{account.name}</p>
            <p className="text-sm text-neutral-500">{kindLabel(account.kind)}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${archived ? "bg-neutral-100 text-neutral-600" : "bg-emerald-50 text-emerald-700"}`}>
          {archived ? "Arquivada" : "Ativa"}
        </span>
      </div>

      <div className="mb-3 rounded-xl bg-neutral-50 p-3">
        <p className="text-xs text-neutral-500">Saldo atual</p>
        <p className={`mt-1 text-2xl font-bold tabular-nums ${balanceTextClass(currentBalance)}`}>{formatBRL(account.current_balance)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-100 p-3">
        <div>
          <p className="text-xs text-neutral-500">Saldo inicial</p>
          <p className="mt-1 font-bold text-neutral-950 tabular-nums">{formatBRL(account.initial_balance)}</p>
        </div>
        <div>
          <p className="text-xs text-neutral-500">Data inicial</p>
          <p className="mt-1 font-bold text-neutral-950">{formatCivilDateBR(account.initial_balance_date)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {onViewStatement && (
          <Button type="button" variant="outline" size="sm" onClick={() => onViewStatement(account)}>
            <Eye className="mr-2 h-4 w-4" />
            Ver extrato
          </Button>
        )}
        {!archived && onEdit && (
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(account)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
        )}
        {!archived && onArchive && (
          <Button type="button" variant="outline" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => onArchive(account)}>
            <Archive className="mr-2 h-4 w-4" />
            Arquivar
          </Button>
        )}
        {archived && onRestore && (
          <Button type="button" variant="outline" size="sm" className="text-emerald-700 hover:bg-emerald-50" onClick={() => onRestore(account)}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar
          </Button>
        )}
      </div>
    </div>
  );
}

function TransferCard({
  transfer,
  reversing,
  onReverse,
}: {
  transfer: AccountTransfer;
  reversing: boolean;
  onReverse: (transfer: AccountTransfer) => void;
}) {
  const completed = transfer.status === "completed";

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 font-semibold text-neutral-950">
            <span className="truncate">{transfer.from_account.name}</span>
            <ArrowRight className="h-4 w-4 text-neutral-400" />
            <span className="truncate">{transfer.to_account.name}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
            <span className="font-semibold tabular-nums text-neutral-900">{formatBRL(transfer.amount)}</span>
            <span>{formatCivilDateBR(transfer.transferred_on)}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${completed ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>
              {completed ? "Concluída" : "Revertida"}
            </span>
          </div>
          {transfer.description && <p className="mt-2 text-sm text-neutral-700">{transfer.description}</p>}
        </div>

        {completed && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={reversing}
            className="w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700 sm:w-auto"
            onClick={() => onReverse(transfer)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {reversing ? "Revertendo..." : "Reverter"}
          </Button>
        )}
      </div>
    </div>
  );
}

function accountTransferOptions(accounts: Account[], disabledAccountId?: string) {
  return accounts.map((account) => ({
    value: String(account.id),
    label: `${account.name} — ${kindLabel(account.kind)} — Saldo ${formatBRL(account.current_balance)}`,
    disabled: disabledAccountId === String(account.id),
  }));
}

function validateTransferForm(form: ReturnType<typeof initialTransferForm>) {
  if (!form.from_account_id) return "Selecione a conta de origem.";
  if (!form.to_account_id) return "Selecione a conta de destino.";
  if (form.from_account_id === form.to_account_id) return "A conta de destino deve ser diferente da origem.";

  const amount = parseMoney(form.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Informe um valor maior que zero.";

  if (!form.transferred_on) return "Informe a data da transferência.";
  if (form.transferred_on > todayLocalCivilDate()) return "A data da transferência não pode ser futura.";

  return null;
}

function balanceTextClass(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";

  return "text-neutral-700";
}

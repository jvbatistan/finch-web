import { exportAccountStatementCsv, fetchAccountStatement, fetchAccountStatementForPrint } from "@/features/accounts/services/account-statements.service";
import { api } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}));

const apiMock = vi.mocked(api);

const statement = {
  account: {
    id: 1,
    name: "Nubank",
    kind: "checking",
    archived_at: null,
    current_balance: "1500.0",
  },
  period: {
    start_date: null,
    end_date: null,
  },
  filters: {
    movement_type: null,
    direction: null,
  },
  summary: {
    credits_total: "3000.0",
    debits_total: "1200.0",
    net_total: "1800.0",
  },
  balances: {
    opening_balance: "1000.0",
    closing_balance: "2800.0",
  },
  pagination: {
    page: 1,
    per_page: 25,
    total_count: 1,
    total_pages: 1,
  },
  items: [],
};

beforeEach(() => {
  apiMock.mockReset();
});

describe("account statement service", () => {
  it("fetches an account statement without params", async () => {
    apiMock.mockResolvedValueOnce(statement);

    const result = await fetchAccountStatement(1);

    expect(apiMock).toHaveBeenCalledWith("/api/accounts/1/statement", {
      cache: "no-store",
      signal: undefined,
    });
    expect(result).toEqual({ status: 200, data: statement });
    expect(result.data?.balances).toEqual({
      opening_balance: "1000.0",
      closing_balance: "2800.0",
    });
  });

  it("maps period, movement type, direction and pagination params to the backend contract", async () => {
    apiMock.mockResolvedValueOnce(statement);
    const controller = new AbortController();

    await fetchAccountStatement(7, {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      movementType: "transfer_out",
      direction: "debit",
      page: 2,
      perPage: 10,
      signal: controller.signal,
    });

    expect(apiMock).toHaveBeenCalledWith("/api/accounts/7/statement?start_date=2026-07-01&end_date=2026-07-31&movement_type=transfer_out&direction=debit&page=2&per_page=10", {
      cache: "no-store",
      signal: controller.signal,
    });
  });

  it("does not send empty optional params", async () => {
    apiMock.mockResolvedValueOnce(statement);

    await fetchAccountStatement(1, {
      startDate: "",
      endDate: "",
      movementType: undefined,
      direction: undefined,
      page: undefined,
      perPage: undefined,
    });

    expect(apiMock).toHaveBeenCalledWith("/api/accounts/1/statement", {
      cache: "no-store",
      signal: undefined,
    });
  });

  it("fetches the complete statement for print without pagination params", async () => {
    apiMock.mockResolvedValueOnce(statement);

    await fetchAccountStatementForPrint(7, {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      movementType: "income",
      direction: "credit",
      page: 3,
      perPage: 1,
    });

    expect(apiMock).toHaveBeenCalledWith(
      "/api/accounts/7/statement/print?start_date=2026-07-01&end_date=2026-07-31&movement_type=income&direction=credit",
      { cache: "no-store", signal: undefined }
    );
  });

  it("propagates API errors", async () => {
    apiMock.mockRejectedValueOnce(new Error("Conta não encontrada."));

    await expect(fetchAccountStatement(999)).rejects.toThrow("Conta não encontrada.");
  });

  it("returns unauthorized status when API error includes 401", async () => {
    apiMock.mockRejectedValueOnce(new Error("HTTP 401"));

    await expect(fetchAccountStatement(1)).resolves.toEqual({ status: 401, data: null });
  });

  it("exports CSV with statement filters and ignores pagination params", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response("csv", {
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="finch-extrato-nubank-2026-07-29.csv"',
        "Content-Type": "text/csv",
      }),
    }));

    const result = await exportAccountStatementCsv(7, {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      movementType: "income",
      direction: "credit",
      page: 9,
      perPage: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/accounts/7/statement/export_csv?start_date=2026-07-01&end_date=2026-07-31&movement_type=income&direction=credit",
      {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      }
    );
    expect(result.status).toBe(200);
    expect(result.data?.filename).toBe("finch-extrato-nubank-2026-07-29.csv");
  });
});

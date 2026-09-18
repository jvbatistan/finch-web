import { act, renderHook, waitFor } from "@testing-library/react";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import { fetchDashboard } from "@/features/dashboard/services/dashboard.service";

vi.mock("@/features/dashboard/services/dashboard.service", () => ({
  fetchDashboard: vi.fn(),
}));

const fetchDashboardMock = vi.mocked(fetchDashboard);
const overview = {
  period: { month: 4, year: 2026, label: "abril/2026" },
  summary: { incomes_total: 0, expenses_total: 0, balance_total: 0, open_total: 0, paid_total: 0, transactions_count: 0 },
  monthly_trend: [],
  by_card: [],
  by_category: [],
  recent_expenses: [],
  statements: [],
};

describe("useDashboard", () => {
  beforeEach(() => {
    fetchDashboardMock.mockReset().mockResolvedValue({ status: 200, data: overview });
  });

  it("does not refetch when the selected month and year remain unchanged", async () => {
    const onUnauthorized = vi.fn();
    const { result, rerender } = renderHook(
      ({ month, year }) => useDashboard({ month, year, enabled: true, onUnauthorized }),
      { initialProps: { month: 4, year: 2026 } },
    );

    await waitFor(() => expect(result.current.overview).toEqual(overview));
    expect(fetchDashboardMock).toHaveBeenCalledTimes(1);

    rerender({ month: 4, year: 2026 });
    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchDashboardMock).toHaveBeenCalledTimes(1);
  });
});

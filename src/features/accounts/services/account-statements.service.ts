import type { AccountStatementResponse, FetchAccountStatementParams } from "@/features/accounts/types/account-statement.types";
import { api } from "@/lib/api";
import { todayLocalCivilDate } from "@/lib/civil-date";

function buildStatementQuery(params: FetchAccountStatementParams, includePagination: boolean) {
  const searchParams = new URLSearchParams();

  if (params.startDate) searchParams.set("start_date", params.startDate);
  if (params.endDate) searchParams.set("end_date", params.endDate);
  if (params.movementType) searchParams.set("movement_type", params.movementType);
  if (params.direction) searchParams.set("direction", params.direction);
  if (includePagination && params.page) searchParams.set("page", String(params.page));
  if (includePagination && params.perPage) searchParams.set("per_page", String(params.perPage));

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export async function fetchAccountStatement(accountId: number, params: FetchAccountStatementParams = {}) {
  const path = `/api/accounts/${accountId}/statement${buildStatementQuery(params, true)}`;

  try {
    const data = (await api(path, {
      cache: "no-store",
      signal: params.signal,
    })) as AccountStatementResponse;

    return { status: 200 as const, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as AccountStatementResponse | null };
    }
    throw err;
  }
}

export async function fetchAccountStatementForPrint(accountId: number, params: FetchAccountStatementParams = {}) {
  const path = `/api/accounts/${accountId}/statement/print${buildStatementQuery(params, false)}`;

  try {
    const data = (await api(path, {
      cache: "no-store",
      signal: params.signal,
    })) as AccountStatementResponse;

    return { status: 200 as const, data };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as AccountStatementResponse | null };
    }
    throw err;
  }
}

function filenameFromContentDisposition(contentDisposition: string | null) {
  if (!contentDisposition) return null;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1]);

  const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return filenameMatch?.[1] ?? null;
}

export async function exportAccountStatementCsv(accountId: number, params: FetchAccountStatementParams = {}) {
  const query = buildStatementQuery(params, false);

  try {
    const response = await fetch(`/api/accounts/${accountId}/statement/export_csv${query}`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });

    if (!response.ok) {
      const message = response.status === 401 ? "HTTP 401" : "Não foi possível exportar o extrato.";
      throw new Error(message);
    }

    const blob = await response.blob();
    const filename =
      filenameFromContentDisposition(response.headers.get("content-disposition")) ??
      `finch-extrato-conta-${todayLocalCivilDate()}.csv`;

    return { status: 200 as const, data: { blob, filename } };
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      return { status: 401 as const, data: null as { blob: Blob; filename: string } | null };
    }

    throw err;
  }
}

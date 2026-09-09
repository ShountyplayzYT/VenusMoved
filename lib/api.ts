import type {
  AllLaneLoadChangesResponse,
  CustomerMonthlyLoadsResponse,
  ImportResult,
  InsightsCustomersResponse,
  LaneLoadChangesResponse,
  LaneMonthlyLoadsResponse,
  LookupResponse,
  QuoteHistoryResponse,
  UninvoicedLoadsResponse,
  User,
} from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function getMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (res.status === 401) return null;
  return handle<User>(res);
}

export async function login(identifier: string, password: string): Promise<User> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ identifier, password }),
  });
  return handle<User>(res);
}

export async function signup(name: string, email: string, password: string): Promise<User> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name, email, password }),
  });
  return handle<User>(res);
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
}

export async function lookup(laneText: string): Promise<LookupResponse> {
  const res = await fetch("/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ laneText }),
  });
  return handle<LookupResponse>(res);
}

export async function getCustomerMonthlyLoads(): Promise<CustomerMonthlyLoadsResponse> {
  const res = await fetch("/api/insights/customer-loads", { credentials: "same-origin" });
  return handle<CustomerMonthlyLoadsResponse>(res);
}

export async function getInsightsCustomers(): Promise<InsightsCustomersResponse> {
  const res = await fetch("/api/insights/customers", { credentials: "same-origin" });
  return handle<InsightsCustomersResponse>(res);
}

export async function getCustomerLaneMonthlyLoads(company: string): Promise<LaneMonthlyLoadsResponse> {
  const res = await fetch(`/api/insights/customer-lanes?company=${encodeURIComponent(company)}`, {
    credentials: "same-origin",
  });
  return handle<LaneMonthlyLoadsResponse>(res);
}

export async function getLaneLoadChanges(
  company: string,
  threshold: number
): Promise<LaneLoadChangesResponse> {
  const res = await fetch(
    `/api/insights/customer-lane-changes?company=${encodeURIComponent(company)}&threshold=${threshold}`,
    { credentials: "same-origin" }
  );
  return handle<LaneLoadChangesResponse>(res);
}

export async function getAllLaneLoadChanges(): Promise<AllLaneLoadChangesResponse> {
  const res = await fetch("/api/insights/lane-decreases", { credentials: "same-origin" });
  return handle<AllLaneLoadChangesResponse>(res);
}

export async function getUninvoicedLoads(): Promise<UninvoicedLoadsResponse> {
  const res = await fetch("/api/insights/uninvoiced-loads", { credentials: "same-origin" });
  return handle<UninvoicedLoadsResponse>(res);
}

export async function createQuote(input: {
  origin: string;
  destination: string;
  customer: string;
  quotedRate: number;
}): Promise<{ id: number; createdAt: string }> {
  const res = await fetch("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
  });
  return handle(res);
}

export async function getQuoteHistory(): Promise<QuoteHistoryResponse> {
  const res = await fetch("/api/quotes", { credentials: "same-origin" });
  return handle<QuoteHistoryResponse>(res);
}

export async function setQuoteOutcome(quoteId: number, outcome: "won" | "lost"): Promise<void> {
  const res = await fetch(`/api/quotes/${quoteId}/outcome`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ outcome }),
  });
  await handle(res);
}

export async function deleteQuote(quoteId: number): Promise<void> {
  const res = await fetch(`/api/quotes/${quoteId}`, { method: "DELETE", credentials: "same-origin" });
  await handle(res);
}

export async function importReport(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/import", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });
  return handle<ImportResult>(res);
}

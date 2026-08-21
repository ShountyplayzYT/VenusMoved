import type {
  CustomerMonthlyLoadsResponse,
  ImportResult,
  InsightsCustomersResponse,
  LaneLoadChangesResponse,
  LaneMonthlyLoadsResponse,
  LookupResponse,
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
import type {
  CustomerWeeklyLoadsResponse,
  ImportResult,
  InsightsCustomersResponse,
  LaneWeeklyLoadsResponse,
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

export async function getCustomerWeeklyLoads(): Promise<CustomerWeeklyLoadsResponse> {
  const res = await fetch("/api/insights/customer-loads", { credentials: "same-origin" });
  return handle<CustomerWeeklyLoadsResponse>(res);
}

export async function getInsightsCustomers(): Promise<InsightsCustomersResponse> {
  const res = await fetch("/api/insights/customers", { credentials: "same-origin" });
  return handle<InsightsCustomersResponse>(res);
}

export async function getCustomerLaneWeeklyLoads(company: string): Promise<LaneWeeklyLoadsResponse> {
  const res = await fetch(`/api/insights/customer-lanes?company=${encodeURIComponent(company)}`, {
    credentials: "same-origin",
  });
  return handle<LaneWeeklyLoadsResponse>(res);
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
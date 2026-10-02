export type User = { id: string; firstName: string; lastName: string; email: string };
export type Group = { id: string; name: string; currency: string };
export type Dashboard = {
  summary: { totalExpenses: number };
  balances: { user: { _id: string; firstName: string }; net: number }[];
  recentExpenses: { _id: string; description: string; amount: number; date: string; paidBy: { firstName: string } }[];
  upcomingBills: { _id: string; name?: string; title?: string; amount: number; dueDate: string }[];
};

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function request<T>(path: string, token?: string, body?: unknown): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (!base) throw new Error('Set EXPO_PUBLIC_API_URL in mobile/.env to your backend API URL.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${base}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok) throw new ApiError(payload.message || 'Request failed. Please try again.', response.status);
    return payload.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The server took too long to respond. Please try again.');
    throw new Error('Could not reach the server. Check your API URL and connection.');
  } finally { clearTimeout(timeout); }
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackError = "Request failed",
): Promise<T> {
  const res = await fetch(input, init);
  const payload = await res.json().catch(() => ({}) as Record<string, unknown>);

  if (!res.ok) {
    const message =
      typeof payload?.error === "string" ? payload.error : fallbackError;
    throw new Error(message);
  }

  return payload as T;
}

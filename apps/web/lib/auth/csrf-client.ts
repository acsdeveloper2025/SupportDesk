export async function fetchWithCsrf(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = (init.method ?? "GET").toUpperCase();

  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return fetch(input, init);
  }

  const csrfResponse = await fetch("/api/auth/csrf", { method: "GET" });
  const csrfBody = (await csrfResponse.json()) as { csrfToken?: string };
  const headers = new Headers(init.headers);
  headers.set("x-csrf-token", csrfBody.csrfToken ?? "");

  return fetch(input, {
    ...init,
    headers,
  });
}

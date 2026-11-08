export class RequestError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/" + path, {
    method,
    cache: "no-store",
    headers:
      body instanceof FormData
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok)
    throw new RequestError(json.error || "server_error", response.status);
  return json.data as T;
}
export type Row = { id: string; title?: string; [key: string]: unknown };
export type Me = {
  id: string;
  email: string;
  roles: string[];
  destination: string;
  profile: { display_name: string };
  preferences: {
    language: "en" | "uz" | "ru";
    theme: "light" | "dark";
    ai_consent: boolean;
  };
  onboarding: Record<string, unknown> | null;
};

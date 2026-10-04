export class SyliError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly code: string | null;

  constructor(message: string, status = 0, body: unknown = null, code?: string | null) {
    super(message);
    this.name = "SyliError";
    this.status = status;
    this.body = body;
    this.code =
      code ??
      (body && typeof body === "object" && !Array.isArray(body) && "code" in body
        ? String((body as { code?: unknown }).code ?? "") || null
        : null);
  }
}

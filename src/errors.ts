export class SyliError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status = 0, body: unknown = null) {
    super(message);
    this.name = "SyliError";
    this.status = status;
    this.body = body;
  }
}

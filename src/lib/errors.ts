export class AppError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
    this.name = "AppError";
  }
}

// Generic API error carrying an HTTP status (for non-authz cases like 400).
// AuthzError already carries a status too; errorResponse handles any
// status-bearing error uniformly.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

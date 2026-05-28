/** Postgres unique-violation error code. */
const PG_UNIQUE_VIOLATION = "23505";

/**
 * True when `err` (or any error in its `.cause` chain) is a Postgres
 * unique-constraint violation. Drizzle wraps driver errors in a
 * DrizzleQueryError, exposing the original pg error (which carries the SQLSTATE
 * `code`) on `.cause`.
 */
export function isUniqueViolation(err: unknown): boolean {
  for (let cur: unknown = err; cur != null; cur = (cur as { cause?: unknown }).cause) {
    if (
      typeof cur === "object" &&
      "code" in cur &&
      (cur as { code?: string }).code === PG_UNIQUE_VIOLATION
    ) {
      return true;
    }
  }
  return false;
}

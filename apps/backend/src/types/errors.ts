/** Sentinel domain errors. Routes map these to HTTP status codes. */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Malformed or incomplete request (e.g. a required upload is missing). */
export class BadRequestError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super(id ? `${entity} ${id} not found` : `${entity} not found`, 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
  }
}

/** Authentication failure (bad credentials). */
export class UnauthorizedError extends DomainError {
  constructor(message = "Invalid credentials") {
    super(message, 401);
  }
}

/** Authenticated but not permitted to perform the action. */
export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

/** Illegal state-machine transition (e.g. paid → draft). */
export class InvalidTransitionError extends DomainError {
  constructor(from: string, to: string) {
    super(`Cannot transition bill from "${from}" to "${to}"`, 422);
  }
}

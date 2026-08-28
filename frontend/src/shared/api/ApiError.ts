/** Error de negocio del backend.
 *
 *  El servidor traduce sus excepciones a `{"error": {"code", "message"}}` con
 *  un handler global, así que el cliente puede distinguir el caso concreto
 *  (`license_expired`, `validation_failed`, `rate_limited`…) en vez de pintar
 *  un "algo salió mal" genérico.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** 401 = no sabemos quién eres (renovar). 403 = sabemos quién eres y esto no
   *  te toca: NO cerrar sesión, un docente tocando algo de editor da 403. */
  get isUnauthenticated() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isRateLimited() {
    return this.status === 429;
  }
  get isConflict() {
    return this.status === 409;
  }
}

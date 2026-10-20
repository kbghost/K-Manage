export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const unauthorized = (m = "Connexion requise") => new AppError(401, "UNAUTHORIZED", m);
export const forbidden = (m = "Action non autorisee") => new AppError(403, "FORBIDDEN", m);
export const notFound = (m = "Ressource introuvable") => new AppError(404, "NOT_FOUND", m);
export const conflict = (code: string, m: string) => new AppError(409, code, m);

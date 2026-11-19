import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AppError } from "../errors";

export function ensureRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError("Usuário não autenticado", 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError("Acesso não autorizado para este perfil", 403);
    }
    next();
  };
}

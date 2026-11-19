import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../errors";

function mapPrismaUniqueMessage(target: unknown): string {
  const fields = Array.isArray(target) ? target.join(",") : String(target || "");
  if (fields.includes("email")) return "E-mail já cadastrado na plataforma";
  if (fields.includes("cpfCnpj")) return "CPF/CNPJ já cadastrado na plataforma";
  if (fields.includes("serviceOrderId") && fields.includes("providerId")) {
    return "Você já enviou uma proposta para este serviço";
  }
  if (fields.includes("serviceOrderId") && fields.includes("authorId")) {
    return "Você já enviou uma avaliação para este serviço";
  }
  return "Registro duplicado para campo único";
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Erro de validação dos campos",
      details: err.errors.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: mapPrismaUniqueMessage(err.meta?.target) });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Registro não encontrado" });
      return;
    }
    if (err.code === "P2023" || err.code === "P2003") {
      res.status(400).json({ error: "Identificador ou referência de registro inválido" });
      return;
    }
  }

  if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400) {
    res.status(400).json({ error: "Corpo da requisição JSON inválido" });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Erro interno do servidor" });
}

import { Request, Response } from "express";
import { z } from "zod";
import { AuthService } from "./auth.service";
import { Role } from "@prisma/client";

const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres"),
  phone: z.string().trim().min(8, "Telefone deve ter no mínimo 8 dígitos"),
  role: z.enum([Role.CLIENT, Role.PROVIDER], {
    errorMap: () => ({ message: "Perfil de cadastro permitido: CLIENT ou PROVIDER" }),
  }),
  cpfCnpj: z.string().trim().optional(),
  pixKey: z.string().trim().optional(),
  bio: z.string().trim().optional(),
  categories: z.array(z.string().trim()).optional(),
  serviceAreas: z.array(z.string().trim()).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const data = registerSchema.parse(req.body);
    const user = await authService.register(data);
    res.status(201).json(user);
  }

  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = loginSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json(result);
  }

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getMe(req.user!.id);
    res.json(user);
  }
}

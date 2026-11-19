import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../shared/database";
import { AppError } from "../../shared/errors";
import { ENV } from "../../config/env";
import { Role } from "@prisma/client";

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: Role;
  cpfCnpj?: string;
  pixKey?: string;
  bio?: string;
  categories?: string[];
  serviceAreas?: string[];
}

export class AuthService {
  async register(data: RegisterDTO) {
    if (data.role === Role.ADMIN) {
      throw new AppError("Não é permitido cadastrar usuários administradores pela rota pública", 403);
    }

    const email = data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("E-mail já cadastrado na plataforma", 409);
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    if (data.role === Role.PROVIDER) {
      const cpfCnpj = data.cpfCnpj?.trim();
      const pixKey = data.pixKey?.trim();
      if (!cpfCnpj || !pixKey) {
        throw new AppError("CPF/CNPJ e Chave Pix são obrigatórios para prestadores", 400);
      }

      const existingCpf = await prisma.providerProfile.findUnique({ where: { cpfCnpj } });
      if (existingCpf) {
        throw new AppError("CPF/CNPJ já cadastrado na plataforma", 409);
      }

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: data.name.trim(),
          phone: data.phone.trim(),
          role: Role.PROVIDER,
          providerProfile: {
            create: {
              cpfCnpj,
              pixKey,
              bio: data.bio?.trim() || "",
              categories: data.categories || [],
              serviceAreas: data.serviceAreas || [],
            },
          },
        },
        include: { providerProfile: true },
      });
      const { passwordHash: _, ...rest } = user;
      return rest;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: data.name.trim(),
        phone: data.phone.trim(),
        role: Role.CLIENT,
      },
    });
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  async login(email: string, pass: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { providerProfile: true },
    });
    if (!user) {
      throw new AppError("Credenciais inválidas", 401);
    }

    const matches = await bcrypt.compare(pass, user.passwordHash);
    if (!matches) {
      throw new AppError("Credenciais inválidas", 401);
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      ENV.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        providerProfile: user.providerProfile,
      },
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { providerProfile: true },
    });
    if (!user) {
      throw new AppError("Usuário não encontrado", 404);
    }
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
}

import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

describe("Auth Integration Tests", () => {
  const uniqueSuffix = Date.now();

  it("should register a new client successfully", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: `client_${uniqueSuffix}@teste.com`,
        password: "senhaSegura123",
        name: "Cliente Teste",
        phone: "11987654321",
        role: "CLIENT",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.email).toBe(`client_${uniqueSuffix}@teste.com`);
    expect(res.body.role).toBe("CLIENT");
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("should register a new provider with required profile fields", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: `provider_${uniqueSuffix}@teste.com`,
        password: "senhaSegura123",
        name: "Prestador Teste",
        phone: "11912345678",
        role: "PROVIDER",
        cpfCnpj: `cpf_${uniqueSuffix}`,
        pixKey: `pix_${uniqueSuffix}`,
        categories: ["Hidráulica"],
        serviceAreas: ["Campinas"],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body.providerProfile).toBeDefined();
    expect(res.body.providerProfile.status).toBe("PENDING_VERIFICATION");
  });

  it("should reject duplicate cpfCnpj on provider registration with 409", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: `provider_dup_cpf_${uniqueSuffix}@teste.com`,
        password: "senhaSegura123",
        name: "Prestador Duplicado",
        phone: "11912345679",
        role: "PROVIDER",
        cpfCnpj: `cpf_${uniqueSuffix}`,
        pixKey: `pix_other_${uniqueSuffix}`,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("CPF/CNPJ");
  });

  it("should forbid registering with ADMIN role via public endpoint", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: `hacker_admin_${uniqueSuffix}@teste.com`,
        password: "senhaSegura123",
        name: "Fake Admin",
        phone: "11912345600",
        role: "ADMIN",
      });

    expect(res.status).toBe(400);
  });

  it("should reject duplicate email registration", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        email: `client_${uniqueSuffix}@teste.com`,
        password: "outraSenha",
        name: "Outro Nome",
        phone: "11999998888",
        role: "CLIENT",
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain("E-mail já cadastrado");
  });

  it("should login successfully and return JWT token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: `client_${uniqueSuffix}@teste.com`,
        password: "senhaSegura123",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user.email).toBe(`client_${uniqueSuffix}@teste.com`);
  });

  it("should reject invalid login credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({
        email: `client_${uniqueSuffix}@teste.com`,
        password: "senhaErrada",
      });

    expect(res.status).toBe(401);
  });
});

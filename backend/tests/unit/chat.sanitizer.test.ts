import { describe, it, expect } from "vitest";
import {
  sanitizeMessageContent,
  BLOCKED_NOTICE,
} from "../../src/modules/chat/chat.sanitizer";

describe("Chat Sanitizer Anti-Leakage (Unit Tests)", () => {
  it("should preserve harmless text, dates, voltages, and prices without contact information", () => {
    const input =
      "Olá! O serviço será feito no dia 12/11/2026 pela manhã (2026-11-13). Preciso de 2 tomadas 220V, orçamento R$ 1.250,00.";
    const result = sanitizeMessageContent(input);

    expect(result.hasBlockedContact).toBe(false);
    expect(result.sanitized).toBe(input);
  });

  it("should block cell phones with Brazilian DDD formatted as (11) 98888-7777", () => {
    const input = "Me chama no zap (11) 98888-7777 para combinar mais rápido";
    const result = sanitizeMessageContent(input);

    expect(result.hasBlockedContact).toBe(true);
    expect(result.sanitized).toContain(BLOCKED_NOTICE);
    expect(result.sanitized).not.toContain("98888-7777");
  });

  it("should block unformatted phone numbers like 11988887777", () => {
    const input = "Meu telefone é 11988887777 me liga";
    const result = sanitizeMessageContent(input);

    expect(result.hasBlockedContact).toBe(true);
    expect(result.sanitized).toContain(BLOCKED_NOTICE);
    expect(result.sanitized).not.toContain("11988887777");
  });

  it("should block dotted and spaced phone numbers", () => {
    const dotted = sanitizeMessageContent("Me liga no 11.98888.7777 hoje");
    expect(dotted.hasBlockedContact).toBe(true);
    expect(dotted.sanitized).not.toContain("11.98888.7777");

    const spaced = sanitizeMessageContent("Meu numero é 9 8 8 8 8 7 7 7 7");
    expect(spaced.hasBlockedContact).toBe(true);
    expect(spaced.sanitized).not.toContain("9 8 8 8 8 7 7 7 7");

    const spacedWithDdd = sanitizeMessageContent("Contato +55 11 9 8888 7777");
    expect(spacedWithDdd.hasBlockedContact).toBe(true);
    expect(spacedWithDdd.sanitized).not.toContain("8888 7777");
  });

  it("should block email addresses", () => {
    const input = "Pode me mandar o comprovante em contato@prestador.com.br por favor?";
    const result = sanitizeMessageContent(input);

    expect(result.hasBlockedContact).toBe(true);
    expect(result.sanitized).toContain(BLOCKED_NOTICE);
    expect(result.sanitized).not.toContain("contato@prestador.com.br");
  });

  it("should block wa.me, telegram, instagram, generic URLs and social handles", () => {
    const wa = sanitizeMessageContent("Entra no meu link https://wa.me/5511999998888 para fechar");
    expect(wa.hasBlockedContact).toBe(true);
    expect(wa.sanitized).not.toContain("wa.me");

    const tg = sanitizeMessageContent("Me chama no t.me/carlospintor");
    expect(tg.hasBlockedContact).toBe(true);
    expect(tg.sanitized).not.toContain("t.me");

    const ig = sanitizeMessageContent("Veja meu perfil instagram.com/carlos_reparos");
    expect(ig.hasBlockedContact).toBe(true);
    expect(ig.sanitized).not.toContain("instagram.com");

    const url = sanitizeMessageContent("Acesse https://meusite.com.br/orcamento");
    expect(url.hasBlockedContact).toBe(true);
    expect(url.sanitized).not.toContain("meusite.com.br");

    const handle = sanitizeMessageContent("Meu insta é @carlos_eletricista ok?");
    expect(handle.hasBlockedContact).toBe(true);
    expect(handle.sanitized).not.toContain("@carlos_eletricista");
  });

  it("should block Pix keys (CPF, CNPJ, and EVP/UUID)", () => {
    const cpf = sanitizeMessageContent("Paga no meu pix CPF 123.456.789-01");
    expect(cpf.hasBlockedContact).toBe(true);
    expect(cpf.sanitized).not.toContain("123.456.789-01");

    const cnpj = sanitizeMessageContent("Meu pix CNPJ é 12.345.678/0001-99");
    expect(cnpj.hasBlockedContact).toBe(true);
    expect(cnpj.sanitized).not.toContain("12.345.678/0001-99");

    const evp = sanitizeMessageContent(
      "Chave aleatória: 550e8400-e29b-41d4-a716-446655440000"
    );
    expect(evp.hasBlockedContact).toBe(true);
    expect(evp.sanitized).not.toContain("550e8400-e29b-41d4-a716-446655440000");
  });
});

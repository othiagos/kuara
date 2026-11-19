import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

describe("Dispute & Mediation Integration Test", () => {
  let adminToken = "";
  let clientToken = "";
  let providerToken = "";
  let otherProviderToken = "";
  let orderId = "";
  let disputeId = "";

  const stamp = Date.now();

  async function createEscrowHeldOrder(suffix: string, laborCostCents = 40000) {
    const orderRes = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        title: `Pintura ${suffix}`,
        description: "Pintura de duas paredes em cor cinza claro.",
        category: "Pintura",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "02000-000",
        addressLine: "Rua das Flores, 50",
      });
    const newOrderId = orderRes.body.id;

    const propRes = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        serviceOrderId: newOrderId,
        description: "Duas demãos com tinta lavável.",
        estimatedDays: 2,
        laborCostCents,
      });

    await request(app)
      .patch(`/api/proposals/${propRes.body.id}/accept`)
      .set("Authorization", `Bearer ${clientToken}`);

    await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ serviceOrderId: newOrderId });

    return newOrderId;
  }

  beforeAll(async () => {
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@kuara.com.br", password: "admin123" });
    adminToken = adminRes.body.token;

    await request(app).post("/api/auth/register").send({
      email: `client_disp_${stamp}@kuara.com`,
      password: "senha123",
      name: "Cliente Disputa",
      phone: "11999993333",
      role: "CLIENT",
    });
    const clientLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: `client_disp_${stamp}@kuara.com`, password: "senha123" });
    clientToken = clientLogin.body.token;

    const provRes = await request(app).post("/api/auth/register").send({
      email: `provider_disp_${stamp}@kuara.com`,
      password: "senha123",
      name: "Prestador Disputa",
      phone: "11988884444",
      role: "PROVIDER",
      cpfCnpj: `cpf_disp_${stamp}`,
      pixKey: `pix_disp_${stamp}`,
      categories: ["Pintura"],
      serviceAreas: ["São Paulo"],
    });
    await request(app)
      .patch(`/api/providers/${provRes.body.providerProfile.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "VERIFIED" });

    const provLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: `provider_disp_${stamp}@kuara.com`, password: "senha123" });
    providerToken = provLogin.body.token;

    // Unrelated verified provider
    const otherRes = await request(app).post("/api/auth/register").send({
      email: `other_prov_disp_${stamp}@kuara.com`,
      password: "senha123",
      name: "Outro Prestador",
      phone: "11988885555",
      role: "PROVIDER",
      cpfCnpj: `cpf_other_disp_${stamp}`,
      pixKey: `pix_other_disp_${stamp}`,
    });
    await request(app)
      .patch(`/api/providers/${otherRes.body.providerProfile.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "VERIFIED" });
    const otherLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: `other_prov_disp_${stamp}@kuara.com`, password: "senha123" });
    otherProviderToken = otherLogin.body.token;

    orderId = await createEscrowHeldOrder(`Principal_${stamp}`);

    await request(app)
      .post("/api/escrow/complete")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ serviceOrderId: orderId });
  });

  it("should forbid opening a dispute on OPEN or ESCROW_PENDING orders", async () => {
    const openOrder = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        title: "Serviço Ainda Aberto",
        description: "Descrição válida para serviço aberto.",
        category: "Pintura",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "02000-000",
        addressLine: "Rua Teste, 10",
      });

    const openDispute = await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        serviceOrderId: openOrder.body.id,
        reason: "Tentativa indevida de abrir disputa em pedido aberto.",
      });
    expect(openDispute.status).toBe(400);
  });

  it("should allow client to open a dispute with reason and evidence, and block duplicates", async () => {
    const dispRes = await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        serviceOrderId: orderId,
        reason: "A tinta manchou a parede e o rodapé ficou sem acabamento.",
        evidencePhotos: ["https://kuara.com/evidencia1.jpg"],
      });

    expect(dispRes.status).toBe(201);
    expect(dispRes.body).toHaveProperty("id");
    disputeId = dispRes.body.id;

    // Duplicate dispute attempt must fail
    const dupRes = await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        serviceOrderId: orderId,
        reason: "Tentativa de segunda disputa no mesmo serviço.",
      });
    expect([400, 409]).toContain(dupRes.status);

    // Unrelated provider cannot attach counter-evidence
    const badEvidence = await request(app)
      .post(`/api/escrow/dispute/${disputeId}/evidence`)
      .set("Authorization", `Bearer ${otherProviderToken}`)
      .send({
        reason: "Prestador alheio tentando intervir.",
      });
    expect(badEvidence.status).toBe(403);

    // Opener (client) cannot submit counter-evidence against own contestation
    const openerCounter = await request(app)
      .post(`/api/escrow/dispute/${disputeId}/evidence`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        reason: "Autor tentando enviar contraprova para o próprio relato.",
      });
    expect(openerCounter.status).toBe(403);

    // Accepted provider CAN submit counter-evidence
    const goodEvidence = await request(app)
      .post(`/api/escrow/dispute/${disputeId}/evidence`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        reason: "A parede já apresentava infiltração prévia conforme fotos.",
        evidencePhotos: ["https://kuara.com/contra_prova.jpg"],
      });
    expect(goodEvidence.status).toBe(200);
    expect(goodEvidence.body.counterEvidenceReason).toContain("infiltração");

    const getOrder = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(getOrder.body.status).toBe("IN_DISPUTE");
    expect(getOrder.body.escrow.status).toBe("DISPUTED");
  });

  it("should allow admin to resolve dispute by refunding the client and forbid re-resolving or reopening", async () => {
    const resolveRes = await request(app)
      .post(`/api/escrow/dispute/${disputeId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "REFUND_TO_CLIENT",
        notes: "Comprovado erro grave de aplicação. Valor reembolsado integralmente.",
      });

    expect(resolveRes.status).toBe(200);

    const getOrder = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(getOrder.body.status).toBe("CANCELLED");
    expect(getOrder.body.escrow.status).toBe("REFUNDED");

    // Re-resolving already resolved dispute must fail
    const reResolve = await request(app)
      .post(`/api/escrow/dispute/${disputeId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "RELEASE_TO_PROVIDER",
        notes: "Tentativa indevida de reverter disputa já resolvida.",
      });
    expect(reResolve.status).toBe(400);

    // Reopening dispute on CANCELLED order must fail
    const reopen = await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        serviceOrderId: orderId,
        reason: "Tentativa de reabrir disputa em ordem cancelada.",
      });
    expect(reopen.status).toBe(400);
  });

  it("should allow accepted provider to open dispute and support admin SPLIT decision with accurate fee math", async () => {
    const splitOrderId = await createEscrowHeldOrder(`Split_${stamp}`, 50000);

    // Accepted provider opens dispute while IN_PROGRESS
    const provDispute = await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        serviceOrderId: splitOrderId,
        reason: "Cliente solicitou escopo extra fora do combinado após início.",
      });
    expect(provDispute.status).toBe(201);
    const splitDisputeId = provDispute.body.id;

    // Opener (provider) cannot overwrite counter-evidence; client can submit defense
    const provCounter = await request(app)
      .post(`/api/escrow/dispute/${splitDisputeId}/evidence`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        reason: "Prestador tentando responder a si mesmo.",
      });
    expect(provCounter.status).toBe(403);

    const clientDefense = await request(app)
      .post(`/api/escrow/dispute/${splitDisputeId}/evidence`)
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        reason: "Não houve pedido extra além do orçamento aprovado.",
      });
    expect(clientDefense.status).toBe(200);

    // Admin sees clear attribution of opener vs contested party
    const adminDisputes = await request(app)
      .get("/api/admin/disputes?page=1&limit=20")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminDisputes.status).toBe(200);
    const provOpenedRow = adminDisputes.body.items.find((d: any) => d.id === splitDisputeId);
    expect(provOpenedRow).toBeTruthy();
    expect(provOpenedRow.parties).toMatchObject({
      openedByRole: "PROVIDER",
      contestedRole: "CLIENT",
      opener: { role: "PROVIDER", label: "Contratado" },
      contested: { role: "CLIENT", label: "Contratante" },
    });

    // Admin resolves with 60% SPLIT to provider (R$ 300,00 gross -> 5% fee R$ 15,00 -> net R$ 285,00; R$ 200,00 refunded)
    const splitResolve = await request(app)
      .post(`/api/escrow/dispute/${splitDisputeId}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "SPLIT",
        providerSharePercent: 60,
        notes: "Acordo parcial: 60% para o prestador e 40% estornado ao cliente.",
      });

    expect(splitResolve.status).toBe(200);
    expect(splitResolve.body.providerReleaseCents).toBe(30000);
    expect(splitResolve.body.clientRefundCents).toBe(20000);
    expect(splitResolve.body.feeAmountCents).toBe(1500);
    expect(splitResolve.body.netAmountCents).toBe(28500);

    const orderCheck = await request(app)
      .get(`/api/services/${splitOrderId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(orderCheck.body.status).toBe("FINISHED");
    expect(orderCheck.body.escrow.status).toBe("RELEASED");
    expect(orderCheck.body.escrow.netAmountCents).toBe(28500);
    expect(orderCheck.body.escrow.refundedAmountCents).toBe(20000);
  });

  it("should support admin REWORK decision returning order to IN_PROGRESS and HELD escrow", async () => {
    const reworkOrderId = await createEscrowHeldOrder(`Rework_${stamp}`, 20000);

    await request(app)
      .post("/api/escrow/complete")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ serviceOrderId: reworkOrderId });

    const dispRes = await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        serviceOrderId: reworkOrderId,
        reason: "Faltou acabamento próximo ao teto.",
      });
    expect(dispRes.status).toBe(201);

    const reworkRes = await request(app)
      .post(`/api/escrow/dispute/${dispRes.body.id}/resolve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        decision: "REWORK",
        notes: "Prestador deve retornar para finalizar o acabamento.",
      });
    expect(reworkRes.status).toBe(200);

    const checkOrder = await request(app)
      .get(`/api/services/${reworkOrderId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(checkOrder.body.status).toBe("IN_PROGRESS");
    expect(checkOrder.body.escrow.status).toBe("HELD");

    // Provider re-completes and client approves
    const reComplete = await request(app)
      .post("/api/escrow/complete")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ serviceOrderId: reworkOrderId });
    expect(reComplete.status).toBe(200);

    const release = await request(app)
      .post(`/api/escrow/release/${reworkOrderId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(release.status).toBe(200);

    // Cannot open dispute on FINISHED order
    const postFinishDispute = await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        serviceOrderId: reworkOrderId,
        reason: "Tentativa pós-conclusão definitiva.",
      });
    expect(postFinishDispute.status).toBe(400);
  });
});

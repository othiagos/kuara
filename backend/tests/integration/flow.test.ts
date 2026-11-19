import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

describe("Complete Kuara Flow Integration Test", () => {
  let adminToken = "";
  let clientToken = "";
  let providerToken = "";
  let clientId = "";
  let providerId = "";
  let providerProfileId = "";
  let orderId = "";
  let proposalId = "";

  const stamp = Date.now();

  beforeAll(async () => {
    // 1. Login Admin (from seed)
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@kuara.com.br", password: "admin123" });
    adminToken = adminRes.body.token;

    // 2. Register Client
    const clientRes = await request(app).post("/api/auth/register").send({
      email: `client_flow_${stamp}@kuara.com`,
      password: "senha123",
      name: "Cliente do Fluxo",
      phone: "11999991111",
      role: "CLIENT",
    });
    clientId = clientRes.body.id;

    const clientLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: `client_flow_${stamp}@kuara.com`, password: "senha123" });
    clientToken = clientLogin.body.token;

    // 3. Register Provider (starts PENDING_VERIFICATION)
    const providerRes = await request(app).post("/api/auth/register").send({
      email: `provider_flow_${stamp}@kuara.com`,
      password: "senha123",
      name: "Prestador do Fluxo",
      phone: "11988882222",
      role: "PROVIDER",
      cpfCnpj: `cpf_flow_${stamp}`,
      pixKey: `pix_flow_${stamp}`,
      categories: ["Elétrica", "Instalações"],
      serviceAreas: ["São Paulo"],
    });
    providerId = providerRes.body.id;
    providerProfileId = providerRes.body.providerProfile.id;

    const providerLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: `provider_flow_${stamp}@kuara.com`, password: "senha123" });
    providerToken = providerLogin.body.token;
  });

  it("should prevent unverified provider from sending proposals", async () => {
    // Client creates order first
    const orderRes = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        title: "Troca de Chuveiro e Disjuntor",
        description: "Preciso trocar chuveiro 220V que queimou na suite.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01000-000",
        addressLine: "Av Paulista, 1000",
      });
    expect(orderRes.status).toBe(201);
    orderId = orderRes.body.id;

    // Attempt proposal with unverified provider
    const unverifiedRes = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        serviceOrderId: orderId,
        description: "Faço a troca em 1 hora.",
        estimatedDays: 1,
        laborCostCents: 15000,
      });

    expect(unverifiedRes.status).toBe(403);
    expect(unverifiedRes.body.error).toContain("VERIFICADO");
  });

  it("should allow admin to verify provider documents", async () => {
    const approveRes = await request(app)
      .patch(`/api/providers/${providerProfileId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "VERIFIED" });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("VERIFIED");
  });

  it("should allow verified provider to submit proposal", async () => {
    const propRes = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        serviceOrderId: orderId,
        description: "Troca completa do chuveiro com teste de fiação e isolamento.",
        estimatedDays: 1,
        laborCostCents: 20000, // R$ 200,00
        materialCostCents: 5000, // R$ 50,00
      });

    expect(propRes.status).toBe(201);
    expect(propRes.body.totalCents).toBe(25000); // R$ 250,00
    proposalId = propRes.body.id;
  });

  it("should allow client to accept proposal and change status to ESCROW_PENDING", async () => {
    const acceptRes = await request(app)
      .patch(`/api/proposals/${proposalId}/accept`)
      .set("Authorization", `Bearer ${clientToken}`);

    expect(acceptRes.status).toBe(200);

    const getOrder = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(getOrder.body.status).toBe("ESCROW_PENDING");
  });

  it("should immediately release materials for purchase, hold labor in escrow, and calculate 5% fee on labor only", async () => {
    const payRes = await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ serviceOrderId: orderId, paymentMethod: "PIX" });

    expect(payRes.status).toBe(200);
    expect(payRes.body.status).toBe("HELD");
    expect(payRes.body.grossAmountCents).toBe(25000); // 20000 labor + 5000 materials
    expect(payRes.body.laborAmountCents).toBe(20000);
    expect(payRes.body.materialsAmountCents).toBe(5000);
    expect(payRes.body.materialsReleasedAt).toBeTruthy();
    expect(payRes.body.feeAmountCents).toBe(1000); // 5% on labor 20000 only = 1000
    expect(payRes.body.netAmountCents).toBe(19000); // 20000 - 1000 = 19000

    // Provider attaches NF/receipt proof for purchased materials
    const proofRes = await request(app)
      .post("/api/escrow/materials-proof")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        serviceOrderId: orderId,
        proofUrls: ["https://kuara.com/nf_chuveiro.jpg"],
      });
    expect(proofRes.status).toBe(200);
    expect(proofRes.body.materialProofUrls).toContain("https://kuara.com/nf_chuveiro.jpg");

    const getOrder = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(getOrder.body.status).toBe("IN_PROGRESS");
    expect(getOrder.body.escrow.materialProofUrls).toContain("https://kuara.com/nf_chuveiro.jpg");
  });

  it("should allow exchange of contact info in chat once escrow is secured", async () => {
    const chatRes = await request(app)
      .post(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ content: "Oi, meu WhatsApp é 11988882222, estarei aí às 14h!" });

    expect(chatRes.status).toBe(201);
    // Because escrow is HELD, phone is not blocked!
    expect(chatRes.body.content).toContain("11988882222");
  });

  it("should allow provider to mark service as completed with 72h auto-release date", async () => {
    const completeRes = await request(app)
      .post("/api/escrow/complete")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        serviceOrderId: orderId,
        completionPhotos: ["https://kuara.com/foto_concluida.jpg"],
      });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe("COMPLETED_PENDING_APPROVAL");
    expect(completeRes.body.autoReleaseAt).toBeDefined();
  });

  it("should allow client to approve delivery and release net funds to provider", async () => {
    const releaseRes = await request(app)
      .post(`/api/escrow/release/${orderId}`)
      .set("Authorization", `Bearer ${clientToken}`);

    expect(releaseRes.status).toBe(200);

    const getOrder = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${clientToken}`);
    expect(getOrder.body.status).toBe("FINISHED");
    expect(getOrder.body.escrow.status).toBe("RELEASED");
  });

  it("should allow mutual reviews post-completion and calculate provider rating", async () => {
    // Client reviews provider
    const revClient = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        serviceOrderId: orderId,
        rating: 5,
        tags: ["Pontual", "Trabalho Limpo"],
        comment: "Excelente profissional!",
      });
    expect(revClient.status).toBe(201);

    // Provider reviews client
    const revProvider = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        serviceOrderId: orderId,
        rating: 5,
        tags: ["Ótima Comunicação"],
        comment: "Cliente muito atenciosa.",
      });
    expect(revProvider.status).toBe(201);

    // Verify provider profile average
    const showcaseRes = await request(app).get("/api/providers/showcase");
    const p = showcaseRes.body.find((item: any) => item.userId === providerId);
    expect(p).toBeDefined();
    expect(p.ratingAverage).toBe(5);
    expect(p.ratingCount).toBe(1);
  });
});

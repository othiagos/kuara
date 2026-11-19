import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

describe("Security, Anti-Leakage, Chat Isolation & Business Rules Integration Tests", () => {
  let adminToken = "";
  let client1Token = "";
  let client1Id = "";
  let client2Token = "";
  let prov1Token = "";
  let prov1Id = "";
  let prov1ProfileId = "";
  let prov2Token = "";
  let prov2Id = "";
  let prov3Token = "";
  let prov4Token = "";
  let prov5Token = "";

  const stamp = Date.now();

  async function registerAndVerifyProvider(idx: number) {
    const email = `sec_prov_${idx}_${stamp}@kuara.com`;
    const reg = await request(app).post("/api/auth/register").send({
      email,
      password: "senha123",
      name: `Prestador Sec ${idx}`,
      phone: `1198888000${idx}`,
      role: "PROVIDER",
      cpfCnpj: `cpf_sec_${idx}_${stamp}`,
      pixKey: `pix_sec_${idx}_${stamp}`,
      categories: ["Elétrica", "Hidráulica"],
      serviceAreas: ["São Paulo"],
    });
    const profileId = reg.body.providerProfile.id;
    await request(app)
      .patch(`/api/providers/${profileId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "VERIFIED" });

    const login = await request(app).post("/api/auth/login").send({ email, password: "senha123" });
    return {
      token: login.body.token as string,
      id: reg.body.id as string,
      profileId: profileId as string,
    };
  }

  beforeAll(async () => {
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@kuara.com.br", password: "admin123" });
    adminToken = adminRes.body.token;

    const c1Reg = await request(app).post("/api/auth/register").send({
      email: `sec_client1_${stamp}@kuara.com`,
      password: "senha123",
      name: "Cliente Um",
      phone: "11999991234",
      role: "CLIENT",
    });
    client1Id = c1Reg.body.id;
    const c1Login = await request(app)
      .post("/api/auth/login")
      .send({ email: `sec_client1_${stamp}@kuara.com`, password: "senha123" });
    client1Token = c1Login.body.token;

    await request(app).post("/api/auth/register").send({
      email: `sec_client2_${stamp}@kuara.com`,
      password: "senha123",
      name: "Cliente Dois",
      phone: "11999995678",
      role: "CLIENT",
    });
    const c2Login = await request(app)
      .post("/api/auth/login")
      .send({ email: `sec_client2_${stamp}@kuara.com`, password: "senha123" });
    client2Token = c2Login.body.token;

    const p1 = await registerAndVerifyProvider(1);
    prov1Token = p1.token;
    prov1Id = p1.id;
    prov1ProfileId = p1.profileId;

    const p2 = await registerAndVerifyProvider(2);
    prov2Token = p2.token;
    prov2Id = p2.id;

    const p3 = await registerAndVerifyProvider(3);
    prov3Token = p3.token;

    const p4 = await registerAndVerifyProvider(4);
    prov4Token = p4.token;

    const p5 = await registerAndVerifyProvider(5);
    prov5Token = p5.token;
  });

  it("should never expose PII (phone, email, cpfCnpj, pixKey, documentUrl) on public /providers/showcase", async () => {
    const res = await request(app).get("/api/providers/showcase");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    for (const p of res.body) {
      expect(p).not.toHaveProperty("cpfCnpj");
      expect(p).not.toHaveProperty("pixKey");
      expect(p).not.toHaveProperty("documentUrl");
      expect(p).not.toHaveProperty("addressProofUrl");
      expect(p).not.toHaveProperty("rejectionReason");
      expect(p.user).toBeDefined();
      expect(p.user).toHaveProperty("name");
      expect(p.user).not.toHaveProperty("email");
      expect(p.user).not.toHaveProperty("phone");
    }

    // Case-insensitive and accent-insensitive filter
    const filtered = await request(app).get(
      "/api/providers/showcase?category=eletrica&city=sao%20paulo"
    );
    expect(filtered.status).toBe(200);
    expect(filtered.body.some((p: any) => p.userId === prov1Id)).toBe(true);
  });

  it("should allow PROVIDER on GET /api/services/my, enforce /services/open case-insensitive filtering & anti-leakage", async () => {
    const orderRes = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        title: `Troca de Disjuntor ${stamp}`,
        description: "Preciso trocar disjuntor principal que está desarmando.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01310-100",
        addressLine: "Av Paulista, 1500 Ap 42",
      });
    const orderId = orderRes.body.id;

    // /services/open must mask exact addressLine & addressZip & client.phone, and support case/accent-insensitive search
    const openRes = await request(app)
      .get("/api/services/open?category=eletrica&city=sao%20paulo")
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(openRes.status).toBe(200);
    const found = openRes.body.find((o: any) => o.id === orderId);
    expect(found).toBeDefined();
    expect(found).not.toHaveProperty("addressLine");
    expect(found).not.toHaveProperty("addressZip");
    expect(found.client).not.toHaveProperty("phone");
    expect(found.client).not.toHaveProperty("email");
    expect(found.hasMyProposal).toBe(false);

    // Submit proposal by prov1 and prov2
    const prop1 = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({
        serviceOrderId: orderId,
        description: "Troca completa do disjuntor com reaperto geral.",
        estimatedDays: 1,
        laborCostCents: 18000,
      });
    expect(prop1.status).toBe(201);
    expect(prop1.body.status).toBe("PENDING");

    const prop2 = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov2Token}`)
      .send({
        serviceOrderId: orderId,
        description: "Serviço garantido com teste de carga.",
        estimatedDays: 1,
        laborCostCents: 20000,
      });
    expect(prop2.status).toBe(201);

    // PROVIDER calling GET /api/services/my MUST succeed (200) and ONLY see own proposal, NO PII!
    const myProvRes = await request(app)
      .get("/api/services/my")
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(myProvRes.status).toBe(200);
    const myOrder = myProvRes.body.find((o: any) => o.id === orderId);
    expect(myOrder).toBeDefined();
    expect(myOrder.proposals).toHaveLength(1);
    expect(myOrder.proposals[0].providerId).toBe(prov1Id);
    expect(myOrder).not.toHaveProperty("addressLine");
    expect(myOrder).not.toHaveProperty("addressZip");
    expect(myOrder.client).not.toHaveProperty("phone");

    // Uninvolved CLIENT2 must get 403 on GET /api/services/:id and GET /api/proposals/order/:orderId
    const leakOrder = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${client2Token}`);
    expect(leakOrder.status).toBe(403);

    const leakProps = await request(app)
      .get(`/api/proposals/order/${orderId}`)
      .set("Authorization", `Bearer ${client2Token}`);
    expect(leakProps.status).toBe(403);

    // Uninvolved prov3 gets 403 on GET /api/proposals/order/:orderId
    const leakPropsProv3 = await request(app)
      .get(`/api/proposals/order/${orderId}`)
      .set("Authorization", `Bearer ${prov3Token}`);
    expect(leakPropsProv3.status).toBe(403);

    // Client1 views GET /api/services/:id before escrow -> no provider phones, no cpfCnpj/pixKey
    const clientViewBefore = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${client1Token}`);
    expect(clientViewBefore.status).toBe(200);
    expect(clientViewBefore.body.proposals).toHaveLength(2);
    for (const p of clientViewBefore.body.proposals) {
      expect(p.provider).not.toHaveProperty("phone");
      expect(p.provider).not.toHaveProperty("email");
      expect(p.provider.providerProfile).not.toHaveProperty("cpfCnpj");
      expect(p.provider.providerProfile).not.toHaveProperty("pixKey");
    }

    // Chat isolation PRE-ACCEPTANCE: prov1 and prov2 cannot spy on each other
    const msgFromProv1 = await request(app)
      .post(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({ content: "Consigo ir amanhã, meu zap é 11.98888.7777" });
    expect(msgFromProv1.status).toBe(201);
    expect(msgFromProv1.body.content).not.toContain("98888");
    expect(msgFromProv1.body.proposalId).toBe(prop1.body.id);

    // Prov2 listing messages MUST NOT see prov1's message
    const prov2Msgs = await request(app)
      .get(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${prov2Token}`);
    expect(prov2Msgs.status).toBe(200);
    expect(prov2Msgs.body).toHaveLength(0);

    // Client replying without proposalId when 2 proposals exist must be guided to target one
    const ambiguousReply = await request(app)
      .post(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ content: "Qual o melhor horário?" });
    expect(ambiguousReply.status).toBe(400);

    // Client replies specifically to prov1's proposal
    const targetedReply = await request(app)
      .post(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ content: "Pode vir às 10h?", proposalId: prop1.body.id });
    expect(targetedReply.status).toBe(201);

    const prov1Msgs = await request(app)
      .get(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(prov1Msgs.body).toHaveLength(2);

    const prov2MsgsStillEmpty = await request(app)
      .get(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${prov2Token}`);
    expect(prov2MsgsStillEmpty.body).toHaveLength(0);

    // Accept prop1 -> prop2 explicitly REJECTED; prov2 blocked from chat AND /services/:id hides acceptedProposal
    const acceptRes = await request(app)
      .patch(`/api/proposals/${prop1.body.id}/accept`)
      .set("Authorization", `Bearer ${client1Token}`);
    expect(acceptRes.status).toBe(200);

    // Second accept on prop2 fails
    const secondAccept = await request(app)
      .patch(`/api/proposals/${prop2.body.id}/accept`)
      .set("Authorization", `Bearer ${client1Token}`);
    expect(secondAccept.status).toBe(400);

    // Rejected prov2 sees REJECTED on own proposal, NO acceptedProposal, NO PII
    const prov2OrderView = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${prov2Token}`);
    expect(prov2OrderView.status).toBe(200);
    expect(prov2OrderView.body.proposals[0].status).toBe("REJECTED");
    expect(prov2OrderView.body).not.toHaveProperty("acceptedProposal");
    expect(prov2OrderView.body).not.toHaveProperty("addressLine");

    // Rejected prov2 CANNOT read or send in chat anymore
    const prov2ChatRead = await request(app)
      .get(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${prov2Token}`);
    expect(prov2ChatRead.status).toBe(403);

    const prov2ChatSend = await request(app)
      .post(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${prov2Token}`)
      .send({ content: "Ainda posso fazer mais barato!" });
    expect(prov2ChatSend.status).toBe(403);

    // Uninvolved prov3 gets 403 on GET /api/services/:id once order is ESCROW_PENDING
    const prov3ViewClosed = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${prov3Token}`);
    expect(prov3ViewClosed.status).toBe(403);

    // Before escrow payment (ESCROW_PENDING), prov1 STILL cannot see client phone or exact address
    const prov1PendingView = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(prov1PendingView.body).not.toHaveProperty("addressLine");
    expect(prov1PendingView.body.client).not.toHaveProperty("phone");
    expect(prov1PendingView.body.contactUnlocked).toBe(false);

    // Pay escrow with CARD
    const payRes = await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ serviceOrderId: orderId, paymentMethod: "CARD" });
    expect(payRes.status).toBe(200);
    expect(payRes.body.paymentMethod).toBe("CARD");

    // Now contact & exact address ARE unlocked for prov1 and client1
    const prov1PaidView = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(prov1PaidView.body.contactUnlocked).toBe(true);
    expect(prov1PaidView.body.addressLine).toBe("Av Paulista, 1500 Ap 42");
    expect(prov1PaidView.body.addressZip).toBe("01310-100");
    expect(prov1PaidView.body.client.phone).toBe("11999991234");

    const clientPaidView = await request(app)
      .get(`/api/services/${orderId}`)
      .set("Authorization", `Bearer ${client1Token}`);
    expect(clientPaidView.body.acceptedProposal.provider.phone).toBe("11988880001");
    expect(clientPaidView.body.acceptedProposal.provider.providerProfile).not.toHaveProperty(
      "cpfCnpj"
    );

    // Open dispute -> DISPUTED escrow MUST keep isEscrowSecured=true and allow ADMIN chat moderation
    await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        serviceOrderId: orderId,
        reason: "Disjuntor incompatível com o quadro atual.",
      });

    const chatDuringDispute = await request(app)
      .post(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({ content: "Meu WhatsApp 11988880001 continua liberado na disputa." });
    expect(chatDuringDispute.status).toBe(201);
    expect(chatDuringDispute.body.content).toContain("11988880001");

    const adminModerationMsg = await request(app)
      .post(`/api/chat/${orderId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ content: "Mediação Kuara iniciada. Analisando evidências." });
    expect(adminModerationMsg.status).toBe(201);
    expect(adminModerationMsg.body.sender.role).toBe("ADMIN");
  });

  it("should enforce symbolic bid rejection, duplicate prevention, 4-proposal concurrency cap, and withdraw", async () => {
    const orderRes = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        title: `Concorrência 4 Propostas ${stamp}`,
        description: "Instalação elétrica completa para teste de concorrência.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01000-000",
        addressLine: "Rua da Consolação, 200",
      });
    const orderId = orderRes.body.id;

    // Symbolic bid (< 500 cents) rejected
    const symbolicRes = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({
        serviceOrderId: orderId,
        description: "Proposta com valor simbólico inválido.",
        estimatedDays: 1,
        laborCostCents: 1,
      });
    expect(symbolicRes.status).toBe(400);

    // Concurrent proposals from 5 verified providers -> at most 4 succeed, 5th fails cleanly
    const results = await Promise.all(
      [prov1Token, prov2Token, prov3Token, prov4Token, prov5Token].map((token, i) =>
        request(app)
          .post("/api/proposals")
          .set("Authorization", `Bearer ${token}`)
          .send({
            serviceOrderId: orderId,
            description: `Proposta concorrente número ${i + 1} detalhada.`,
            estimatedDays: 2,
            laborCostCents: 15000 + i * 1000,
          })
      )
    );
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 400);
    expect(created).toHaveLength(4);
    expect(rejected).toHaveLength(1);

    // Duplicate bid from one of the winning 4 fails
    const dupToken = [prov1Token, prov2Token, prov3Token, prov4Token, prov5Token].find(
      (_, idx) => results[idx].status === 201
    )!;
    const dupRes = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${dupToken}`)
      .send({
        serviceOrderId: orderId,
        description: "Tentativa de segunda proposta do mesmo prestador.",
        estimatedDays: 1,
        laborCostCents: 12000,
      });
    expect([400, 409]).toContain(dupRes.status);

    // Withdraw one proposal -> another provider can submit
    const firstCreated = created[0].body;
    const ownerIdx = results.findIndex((r) => r.body?.id === firstCreated.id);
    const ownerToken = [prov1Token, prov2Token, prov3Token, prov4Token, prov5Token][ownerIdx];

    const withdrawRes = await request(app)
      .delete(`/api/proposals/${firstCreated.id}`)
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(withdrawRes.status).toBe(200);
  });

  it("should enforce order cancellation rules, pre-start refund, and block chat on CANCELLED orders", async () => {
    // 1. Cancel OPEN order
    const openOrder = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        title: `Ordem Cancelável ${stamp}`,
        description: "Ordem para testar cancelamento antes da custódia.",
        category: "Hidráulica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01000-000",
        addressLine: "Rua Augusta, 100",
      });
    const openId = openOrder.body.id;

    // Wrong client cannot cancel
    const forbiddenCancel = await request(app)
      .patch(`/api/services/${openId}/cancel`)
      .set("Authorization", `Bearer ${client2Token}`)
      .send({ reason: "Cancelamento indevido" });
    expect(forbiddenCancel.status).toBe(403);

    const cancelOpen = await request(app)
      .patch(`/api/services/${openId}/cancel`)
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ reason: "Não preciso mais do reparo" });
    expect(cancelOpen.status).toBe(200);
    expect(cancelOpen.body.status).toBe("CANCELLED");
    expect(cancelOpen.body.cancelledReason).toBe("Não preciso mais do reparo");

    // 2. Pre-start IN_PROGRESS cancellation -> refunds escrow (REFUNDED) & blocks chat
    const paidOrder = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        title: `Ordem Estorno Pré-Início ${stamp}`,
        description: "Serviço para testar cancelamento pré-início com estorno.",
        category: "Hidráulica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01000-000",
        addressLine: "Rua Augusta, 101",
      });
    const paidId = paidOrder.body.id;

    const prop = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({
        serviceOrderId: paidId,
        description: "Troca de registro completa.",
        estimatedDays: 1,
        laborCostCents: 12000,
      });
    await request(app)
      .patch(`/api/proposals/${prop.body.id}/accept`)
      .set("Authorization", `Bearer ${client1Token}`);
    await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ serviceOrderId: paidId });

    const preStartCancel = await request(app)
      .patch(`/api/services/${paidId}/cancel`)
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ reason: "Imprevisto antes do início da execução" });
    expect(preStartCancel.status).toBe(200);
    expect(preStartCancel.body.status).toBe("CANCELLED");
    expect(preStartCancel.body.escrow.status).toBe("REFUNDED");

    // Chat blocked on CANCELLED order
    const chatAfterCancel = await request(app)
      .post(`/api/chat/${paidId}`)
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ content: "Mensagem após cancelamento" });
    expect(chatAfterCancel.status).toBe(400);

    // Re-cancelling cancelled order fails
    const doubleCancel = await request(app)
      .patch(`/api/services/${paidId}/cancel`)
      .set("Authorization", `Bearer ${client1Token}`);
    expect(doubleCancel.status).toBe(400);
  });

  it("should support Direct Request (targetProviderId) restricted to chosen verified provider", async () => {
    const directOrder = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        title: `Chamado Direto ${stamp}`,
        description: "Solicitação direta exclusiva para Prestador Sec 1.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01000-000",
        addressLine: "Rua Oscar Freire, 300",
        targetProviderId: prov1Id,
      });
    expect(directOrder.status).toBe(201);
    const directId = directOrder.body.id;

    // Prov2 should NOT see directId in /services/open and gets 403 on GET /services/:id & POST /proposals
    const openProv2 = await request(app)
      .get("/api/services/open")
      .set("Authorization", `Bearer ${prov2Token}`);
    expect(openProv2.body.some((o: any) => o.id === directId)).toBe(false);

    const viewProv2 = await request(app)
      .get(`/api/services/${directId}`)
      .set("Authorization", `Bearer ${prov2Token}`);
    expect(viewProv2.status).toBe(403);

    const bidProv2 = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov2Token}`)
      .send({
        serviceOrderId: directId,
        description: "Tentativa de lance em chamado direto alheio.",
        estimatedDays: 1,
        laborCostCents: 15000,
      });
    expect(bidProv2.status).toBe(403);

    // Prov1 DOES see it in /services/my and CAN bid
    const myProv1 = await request(app)
      .get("/api/services/my")
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(myProv1.body.some((o: any) => o.id === directId)).toBe(true);

    const bidProv1 = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({
        serviceOrderId: directId,
        description: "Aceito o chamado direto com atendimento imediato.",
        estimatedDays: 1,
        laborCostCents: 15000,
      });
    expect(bidProv1.status).toBe(201);
  });

  it("should enforce review guards (no ADMIN, no duplicates) and preserve seeded rating baseline", async () => {
    // Finish an order with seeded Carlos Eletricista (ratingCount=14, ratingAverage=4.9)
    const carlosLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "carlos.eletricista@kuara.com.br", password: "senha123" });
    const carlosToken = carlosLogin.body.token;
    const carlosId = carlosLogin.body.user.id;
    const beforeCount = carlosLogin.body.user.providerProfile.ratingCount;

    const orderRes = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        title: `Revisão Elétrica Carlos ${stamp}`,
        description: "Revisão completa do quadro elétrico residencial.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01310-100",
        addressLine: "Av Paulista, 900",
        targetProviderId: carlosId,
      });
    const orderId = orderRes.body.id;

    const prop = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${carlosToken}`)
      .send({
        serviceOrderId: orderId,
        description: "Revisão completa com termografia.",
        estimatedDays: 1,
        laborCostCents: 30000,
      });
    await request(app)
      .patch(`/api/proposals/${prop.body.id}/accept`)
      .set("Authorization", `Bearer ${client1Token}`);
    await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ serviceOrderId: orderId });
    await request(app)
      .post("/api/escrow/complete")
      .set("Authorization", `Bearer ${carlosToken}`)
      .send({ serviceOrderId: orderId });
    await request(app)
      .post(`/api/escrow/release/${orderId}`)
      .set("Authorization", `Bearer ${client1Token}`);

    // ADMIN cannot review
    const adminRev = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ serviceOrderId: orderId, rating: 5 });
    expect(adminRev.status).toBe(403);

    // Client reviews Carlos -> count increments from beforeCount to beforeCount + 1 (not reset to 1!)
    const clientRev = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        serviceOrderId: orderId,
        rating: 5,
        tags: ["Pontual"],
      });
    expect(clientRev.status).toBe(201);

    // Duplicate review fails
    const dupRev = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        serviceOrderId: orderId,
        rating: 4,
      });
    expect(dupRev.status).toBe(409);

    const showcase = await request(app).get("/api/providers/showcase");
    const carlosAfter = showcase.body.find((p: any) => p.userId === carlosId);
    expect(carlosAfter.ratingCount).toBe(beforeCount + 1);

    // Provider reviews client -> summary endpoint aggregates client rating
    const provRev = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${carlosToken}`)
      .send({
        serviceOrderId: orderId,
        rating: 5,
        tags: ["Escopo Claro"],
      });
    expect(provRev.status).toBe(201);

    const clientSummary = await request(app).get(`/api/reviews/user/${client1Id}/summary`);
    expect(clientSummary.status).toBe(200);
    expect(clientSummary.body.ratingAverage).toBe(5);
    expect(clientSummary.body.ratingCount).toBe(1);
  });

  it("should forbid accepting proposal if provider was suspended after proposing", async () => {
    const orderRes = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        title: `Teste Prestador Suspenso ${stamp}`,
        description: "Ordem para validar bloqueio de proposta de prestador suspenso.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01000-000",
        addressLine: "Rua Vergueiro, 100",
      });
    const orderId = orderRes.body.id;

    const prop = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({
        serviceOrderId: orderId,
        description: "Execução rápida em 1 dia.",
        estimatedDays: 1,
        laborCostCents: 15000,
      });

    // Suspend prov1
    await request(app)
      .patch(`/api/providers/${prov1ProfileId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "SUSPENDED", rejectionReason: "Suspensão temporária para auditoria." });

    const acceptSuspended = await request(app)
      .patch(`/api/proposals/${prop.body.id}/accept`)
      .set("Authorization", `Bearer ${client1Token}`);
    expect(acceptSuspended.status).toBe(400);

    // Restore prov1 to VERIFIED cleanly
    await request(app)
      .patch(`/api/providers/${prov1ProfileId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "VERIFIED" });
  });

  it("should enforce materialPolicy consistency, release materials immediately at checkout, and separate held labor in wallet & cancel refund", async () => {
    const orderRes = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({
        title: `Troca Tubulação Materiais ${stamp}`,
        description: "Substituição de registro com materiais inclusos.",
        category: "Hidráulica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01000-000",
        addressLine: "Rua Oscar Freire, 500",
      });
    const matOrderId = orderRes.body.id;

    // Invalid: CLIENT_SUPPLIES cannot have materialCostCents > 0
    const badMatProp = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({
        serviceOrderId: matOrderId,
        description: "Proposta inconsistente para validação.",
        estimatedDays: 1,
        laborCostCents: 20000,
        materialCostCents: 10000,
        materialPolicy: "CLIENT_SUPPLIES",
      });
    expect(badMatProp.status).toBe(400);

    // Valid PROVIDER_ADVANCE proposal with materialsList
    const validMatProp = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({
        serviceOrderId: matOrderId,
        description: "Troca completa de registro de pressão e vedação.",
        estimatedDays: 1,
        laborCostCents: 20000,
        materialCostCents: 10000,
        materialPolicy: "PROVIDER_ADVANCE",
        materialsList: "1x Registro Deca 3/4, 2x Conexões cobre",
      });
    expect(validMatProp.status).toBe(201);
    expect(validMatProp.body.materialPolicy).toBe("PROVIDER_ADVANCE");

    await request(app)
      .patch(`/api/proposals/${validMatProp.body.id}/accept`)
      .set("Authorization", `Bearer ${client1Token}`);

    const payMat = await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ serviceOrderId: matOrderId, paymentMethod: "CARD" });
    expect(payMat.status).toBe(200);
    expect(payMat.body.grossAmountCents).toBe(30000);
    expect(payMat.body.laborAmountCents).toBe(20000);
    expect(payMat.body.materialsAmountCents).toBe(10000);
    expect(payMat.body.materialsReleasedAt).toBeTruthy();
    expect(payMat.body.feeAmountCents).toBe(1000); // 5% of 20000 labor only
    expect(payMat.body.netAmountCents).toBe(19000);

    const walletRes = await request(app)
      .get("/api/providers/wallet")
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(walletRes.status).toBe(200);
    expect(walletRes.body.materialsAdvancedCents).toBeGreaterThanOrEqual(10000);

    // Pre-start cancel only refunds held labor custody (20000), not already-disbursed materials (10000)
    const cancelRes = await request(app)
      .patch(`/api/services/${matOrderId}/cancel`)
      .set("Authorization", `Bearer ${client1Token}`)
      .send({ reason: "Cancelamento antes do início da obra." });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("CANCELLED");
    expect(cancelRes.body.escrow.status).toBe("REFUNDED");
    expect(cancelRes.body.escrow.refundedAmountCents).toBe(20000);
  });

  it("should support server-side pagination, summary counts, wallet counters, and accent-insensitive showcase search", async () => {
    // Ensure client1 has at least 3 open orders for multi-page testing
    const createdIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const o = await request(app)
        .post("/api/services")
        .set("Authorization", `Bearer ${client1Token}`)
        .send({
          title: `Pedido Paginado ${i} ${stamp}`,
          description: `Instalação elétrica de luminárias ponto ${i}.`,
          category: "Elétrica",
          addressCity: "São Paulo",
          addressState: "SP",
          addressZip: "01000-000",
          addressLine: `Rua Paginação, ${i * 10}`,
        });
      expect(o.status).toBe(201);
      createdIds.push(o.body.id);
    }

    // Have prov1 bid on the first created order so provider scopes are populated too
    const bidRes = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${prov1Token}`)
      .send({
        serviceOrderId: createdIds[0],
        description: "Orçamento para paginação e conferência.",
        estimatedDays: 1,
        laborCostCents: 15000,
      });
    expect(bidRes.status).toBe(201);

    // 1. Client /services/my pagination + summary
    const myPage1 = await request(app)
      .get("/api/services/my?page=1&limit=2")
      .set("Authorization", `Bearer ${client1Token}`);
    expect(myPage1.status).toBe(200);
    expect(myPage1.body.items.length).toBe(2);
    expect(myPage1.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      hasPrevPage: false,
      hasNextPage: true,
    });
    expect(myPage1.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(myPage1.body.meta.totalPages).toBe(Math.ceil(myPage1.body.meta.total / 2));
    expect(myPage1.body.summary).toMatchObject({
      totalOrders: myPage1.body.meta.total,
    });
    expect(myPage1.body.summary.openCount).toBeGreaterThanOrEqual(3);

    const myPage2 = await request(app)
      .get("/api/services/my?page=2&limit=2")
      .set("Authorization", `Bearer ${client1Token}`);
    expect(myPage2.status).toBe(200);
    expect(myPage2.body.items.length).toBeGreaterThanOrEqual(1);
    expect(myPage2.body.meta.page).toBe(2);
    expect(myPage2.body.meta.hasPrevPage).toBe(true);
    const page1Ids = new Set(myPage1.body.items.map((x: any) => x.id));
    for (const item of myPage2.body.items) {
      expect(page1Ids.has(item.id)).toBe(false);
    }

    // 2. Provider /services/open pagination + summary
    const openPage1 = await request(app)
      .get(`/api/services/open?page=1&limit=2&search=${encodeURIComponent(`Pedido Paginado`)}`)
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(openPage1.status).toBe(200);
    expect(openPage1.body.items.length).toBe(2);
    expect(openPage1.body.meta.total).toBeGreaterThanOrEqual(3);
    expect(openPage1.body.summary).toHaveProperty("totalOpen");
    expect(openPage1.body.summary).toHaveProperty("availableOpenCount");

    // 3. Provider /services/my scoped pagination & wallet badge counts
    const provBids = await request(app)
      .get("/api/services/my?scope=bids&page=1&limit=2")
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(provBids.status).toBe(200);
    expect(provBids.body.items.length).toBeGreaterThanOrEqual(1);
    expect(provBids.body.summary.bidsCount).toBeGreaterThanOrEqual(1);
    expect(provBids.body.summary).toHaveProperty("activeCount");
    expect(provBids.body.summary).toHaveProperty("historyCount");
    expect(provBids.body.summary).toHaveProperty("finishedCount");

    const walletRes = await request(app)
      .get("/api/providers/wallet")
      .set("Authorization", `Bearer ${prov1Token}`);
    expect(walletRes.status).toBe(200);
    expect(typeof walletRes.body.openOpportunitiesCount).toBe("number");
    expect(typeof walletRes.body.activeJobsCount).toBe("number");
    expect(typeof walletRes.body.escrowPendingCount).toBe("number");

    // 4. Showcase accent-insensitive pagination (?category=eletrica matches "Elétrica") & PII safety
    const showcaseRes = await request(app)
      .get("/api/providers/showcase?category=eletrica&page=1&limit=1");
    expect(showcaseRes.status).toBe(200);
    expect(showcaseRes.body.items.length).toBe(1);
    expect(showcaseRes.body.meta.page).toBe(1);
    expect(showcaseRes.body.meta.limit).toBe(1);
    expect(showcaseRes.body.meta.total).toBeGreaterThanOrEqual(2);
    expect(showcaseRes.body.meta.hasNextPage).toBe(true);
    const providerCard = showcaseRes.body.items[0];
    expect(providerCard.cpfCnpj).toBeUndefined();
    expect(providerCard.pixKey).toBeUndefined();
    expect(providerCard.user.email).toBeUndefined();
    expect(providerCard.user.phone).toBeUndefined();
  });
});

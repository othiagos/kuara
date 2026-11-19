import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app";

describe("Admin, Moderation & Wallet Integration Tests", () => {
  let adminToken = "";
  let clientToken = "";
  let providerToken = "";

  const stamp = Date.now();

  beforeAll(async () => {
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@kuara.com.br", password: "admin123" });
    adminToken = adminRes.body.token;

    const clientRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "maria.cliente@kuara.com.br", password: "senha123" });
    clientToken = clientRes.body.token;

    const provRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "carlos.eletricista@kuara.com.br", password: "senha123" });
    providerToken = provRes.body.token;
  });

  it("should block non-admin users from accessing /api/admin/metrics", async () => {
    const res = await request(app)
      .get("/api/admin/metrics")
      .set("Authorization", `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
  });

  it("should allow admin to access metrics with GMV, revenue, disputed and all status counts", async () => {
    const res = await request(app)
      .get("/api/admin/metrics")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("financial");
    expect(res.body).toHaveProperty("counts");
    expect(res.body.financial).toHaveProperty("totalGMVCents");
    expect(res.body.financial).toHaveProperty("totalRevenueKuaraCents");
    expect(res.body.financial).toHaveProperty("activeEscrowCents");
    expect(res.body.financial).toHaveProperty("disputedEscrowCents");
    expect(res.body.counts).toHaveProperty("totalUsers");
    expect(res.body.counts).toHaveProperty("totalOrders");
    expect(res.body.counts.ordersByStatus).toHaveProperty("OPEN");
    expect(res.body.counts.ordersByStatus).toHaveProperty("IN_DISPUTE");
  });

  it("should allow admin to list all platform orders, users, and providers", async () => {
    const ordersRes = await request(app)
      .get("/api/admin/orders")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(ordersRes.status).toBe(200);
    expect(Array.isArray(ordersRes.body)).toBe(true);

    const usersRes = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(usersRes.status).toBe(200);
    expect(Array.isArray(usersRes.body)).toBe(true);

    const providersRes = await request(app)
      .get("/api/admin/providers")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(providersRes.status).toBe(200);
    expect(Array.isArray(providersRes.body)).toBe(true);
  });

  it("should allow provider to fetch their wallet metrics including disputed funds", async () => {
    const res = await request(app)
      .get("/api/providers/wallet")
      .set("Authorization", `Bearer ${providerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("inEscrowCents");
    expect(res.body).toHaveProperty("heldCents");
    expect(res.body).toHaveProperty("disputedCents");
    expect(res.body).toHaveProperty("availableNetCents");
    expect(res.body).toHaveProperty("totalEarnedCents");
    expect(res.body).toHaveProperty("activeServicesCount");
  });

  it("should enforce provider moderation security: rejectionReason, no SUSPENDED self-reset, no VERIFIED demotion", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      email: `mod_prov_${stamp}@kuara.com`,
      password: "senha123",
      name: "Prestador Moderação",
      phone: "11988881010",
      role: "PROVIDER",
      cpfCnpj: `cpf_mod_${stamp}`,
      pixKey: `pix_mod_${stamp}`,
    });
    const profileId = reg.body.providerProfile.id;

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: `mod_prov_${stamp}@kuara.com`, password: "senha123" });
    const modToken = login.body.token;

    // 1. Admin rejects with justification
    const rejectRes = await request(app)
      .patch(`/api/admin/providers/${profileId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "REJECTED",
        rejectionReason: "Documento com foto ilegível, reenvie com boa iluminação.",
      });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe("REJECTED");
    expect(rejectRes.body.rejectionReason).toContain("ilegível");

    // 2. Rejected provider CAN resubmit docs -> returns to PENDING_VERIFICATION and clears reason
    const resubmit = await request(app)
      .post("/api/providers/verify")
      .set("Authorization", `Bearer ${modToken}`)
      .send({
        documentUrl: "https://kuara.com/docs/rg_novo.pdf",
        addressProofUrl: "https://kuara.com/docs/residencia_novo.pdf",
      });
    expect(resubmit.status).toBe(200);
    expect(resubmit.body.status).toBe("PENDING_VERIFICATION");
    expect(resubmit.body.rejectionReason).toBeNull();

    // 3. Admin verifies provider
    const verifyRes = await request(app)
      .patch(`/api/providers/${profileId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "VERIFIED" });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.status).toBe("VERIFIED");

    // 4. Verified provider CANNOT accidentally demote themselves via /verify
    const demoteAttempt = await request(app)
      .post("/api/providers/verify")
      .set("Authorization", `Bearer ${modToken}`)
      .send({
        documentUrl: "https://kuara.com/docs/rg2.pdf",
        addressProofUrl: "https://kuara.com/docs/res2.pdf",
      });
    expect(demoteAttempt.status).toBe(400);

    // 5. Admin suspends provider with reason
    const suspendRes = await request(app)
      .patch(`/api/admin/providers/${profileId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "SUSPENDED",
        rejectionReason: "Tentativa de desintermediação recorrente.",
      });
    expect(suspendRes.status).toBe(200);
    expect(suspendRes.body.status).toBe("SUSPENDED");
    expect(suspendRes.body.rejectionReason).toContain("desintermediação");

    // 6. Suspended provider CANNOT self-reset via /verify
    const selfReset = await request(app)
      .post("/api/providers/verify")
      .set("Authorization", `Bearer ${modToken}`)
      .send({
        documentUrl: "https://kuara.com/docs/rg3.pdf",
        addressProofUrl: "https://kuara.com/docs/res3.pdf",
      });
    expect(selfReset.status).toBe(403);
  });

  it("should include DISPUTED escrows in admin metrics and provider wallet", async () => {
    const orderRes = await request(app)
      .post("/api/services")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        title: `Teste Métrica Disputa ${stamp}`,
        description: "Instalação de quadro de energia completo.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "01310-100",
        addressLine: "Av Paulista, 500",
      });
    const orderId = orderRes.body.id;

    const propRes = await request(app)
      .post("/api/proposals")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({
        serviceOrderId: orderId,
        description: "Instalação completa com disjuntores.",
        estimatedDays: 1,
        laborCostCents: 10000,
      });

    await request(app)
      .patch(`/api/proposals/${propRes.body.id}/accept`)
      .set("Authorization", `Bearer ${clientToken}`);

    await request(app)
      .post("/api/escrow/pay")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({ serviceOrderId: orderId, paymentMethod: "CARD" });

    const beforeDisputeWallet = await request(app)
      .get("/api/providers/wallet")
      .set("Authorization", `Bearer ${providerToken}`);

    await request(app)
      .post("/api/escrow/dispute")
      .set("Authorization", `Bearer ${clientToken}`)
      .send({
        serviceOrderId: orderId,
        reason: "Discrepância no disjuntor instalado durante execução.",
      });

    const afterDisputeWallet = await request(app)
      .get("/api/providers/wallet")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(afterDisputeWallet.body.disputedCents).toBeGreaterThanOrEqual(8800);
    expect(afterDisputeWallet.body.inEscrowCents).toBe(
      beforeDisputeWallet.body.inEscrowCents
    );

    const metricsRes = await request(app)
      .get("/api/admin/metrics")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(metricsRes.body.financial.disputedEscrowCents).toBeGreaterThanOrEqual(10000);
    expect(metricsRes.body.financial.activeEscrowCents).toBeGreaterThanOrEqual(10000);
    expect(typeof metricsRes.body.counts.activeDisputes).toBe("number");
    expect(metricsRes.body.counts.activeDisputes).toBeGreaterThanOrEqual(1);
  });

  it("should support server-side pagination and filters on admin endpoints", async () => {
    // Seed 2 deterministic orders scoped to this test so parallel integration files don't shift pages
    const pagPrefix = `PagAdmin_${stamp}`;
    for (let i = 1; i <= 2; i++) {
      const created = await request(app)
        .post("/api/services")
        .set("Authorization", `Bearer ${clientToken}`)
        .send({
          title: `${pagPrefix} Ordem ${i}`,
          description: "Serviço para validação determinística de paginação admin.",
          category: "Elétrica",
          addressCity: "São Paulo",
          addressState: "SP",
          addressZip: "01310-100",
          addressLine: `Av Paulista, ${100 + i}`,
        });
      expect(created.status).toBe(201);
    }

    // 1. Orders pagination page 1 & page 2 scoped by test prefix
    const page1 = await request(app)
      .get(`/api/admin/orders?page=1&limit=1&search=${encodeURIComponent(pagPrefix)}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(page1.status).toBe(200);
    expect(Array.isArray(page1.body.items)).toBe(true);
    expect(page1.body.items.length).toBe(1);
    expect(page1.body.meta.page).toBe(1);
    expect(page1.body.meta.limit).toBe(1);
    expect(page1.body.meta.total).toBe(2);
    expect(page1.body.meta.hasPrevPage).toBe(false);
    expect(page1.body.meta.hasNextPage).toBe(true);
    expect(page1.body.meta.totalPages).toBe(2);

    const page2 = await request(app)
      .get(`/api/admin/orders?page=2&limit=1&search=${encodeURIComponent(pagPrefix)}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.items.length).toBe(1);
    expect(page2.body.meta.page).toBe(2);
    expect(page2.body.meta.hasPrevPage).toBe(true);
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);

    // Filtered order search
    const filteredOrder = await request(app)
      .get(`/api/admin/orders?page=1&limit=5&search=${encodeURIComponent(`Teste Métrica Disputa ${stamp}`)}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(filteredOrder.status).toBe(200);
    expect(filteredOrder.body.items.length).toBe(1);
    expect(filteredOrder.body.items[0].title).toContain(`Teste Métrica Disputa ${stamp}`);

    // 2. Users pagination with role filter
    const usersPage = await request(app)
      .get("/api/admin/users?page=1&limit=2&role=PROVIDER")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(usersPage.status).toBe(200);
    expect(usersPage.body.items.length).toBeGreaterThanOrEqual(1);
    expect(usersPage.body.items.length).toBeLessThanOrEqual(2);
    expect(usersPage.body.items.every((u: any) => u.role === "PROVIDER")).toBe(true);
    expect(usersPage.body.meta.page).toBe(1);

    // 3. Providers pagination with status filter
    const provsPage = await request(app)
      .get("/api/admin/providers?page=1&limit=1&status=VERIFIED")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(provsPage.status).toBe(200);
    expect(provsPage.body.items.length).toBe(1);
    expect(provsPage.body.items[0].status).toBe("VERIFIED");
    expect(provsPage.body.meta.limit).toBe(1);

    // 4. Disputes pagination & party attribution
    const disputesPage = await request(app)
      .get("/api/admin/disputes?page=1&limit=1")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(disputesPage.status).toBe(200);
    expect(disputesPage.body.items.length).toBe(1);
    expect(disputesPage.body.meta.total).toBeGreaterThanOrEqual(1);
    expect(disputesPage.body.items[0]).toHaveProperty("parties");
    expect(["CLIENT", "PROVIDER", null]).toContain(disputesPage.body.items[0].parties.openedByRole);
  });
});

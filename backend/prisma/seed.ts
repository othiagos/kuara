import {
  PrismaClient,
  Role,
  ProviderStatus,
  ServiceStatus,
  EscrowStatus,
  ProposalStatus,
  MaterialPolicy,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const POC_IDS = {
  orders: {
    open1: "10000000-0000-4000-8000-000000000001",
    open2: "10000000-0000-4000-8000-000000000002",
    open3: "10000000-0000-4000-8000-000000000003",
    open4: "10000000-0000-4000-8000-000000000004",
    open5: "10000000-0000-4000-8000-000000000005",
    proposalsReceived: "10000000-0000-4000-8000-000000000006",
    escrowPending: "10000000-0000-4000-8000-000000000007",
    inProgress: "10000000-0000-4000-8000-000000000008",
    completedPending: "10000000-0000-4000-8000-000000000009",
    disputeByClient: "10000000-0000-4000-8000-000000000010",
    disputeByProvider: "10000000-0000-4000-8000-000000000011",
    finished: "10000000-0000-4000-8000-000000000012",
    cancelled: "10000000-0000-4000-8000-000000000013",
  },
  proposals: {
    propAna1: "20000000-0000-4000-8000-000000000001",
    propCarlos1: "20000000-0000-4000-8000-000000000002",
    propEscrowPending: "20000000-0000-4000-8000-000000000003",
    propInProgress: "20000000-0000-4000-8000-000000000004",
    propCompletedPending: "20000000-0000-4000-8000-000000000005",
    propDisputeClient: "20000000-0000-4000-8000-000000000006",
    propDisputeProvider: "20000000-0000-4000-8000-000000000007",
    propFinished: "20000000-0000-4000-8000-000000000008",
  },
  escrows: {
    escInProgress: "30000000-0000-4000-8000-000000000001",
    escCompletedPending: "30000000-0000-4000-8000-000000000002",
    escDisputeClient: "30000000-0000-4000-8000-000000000003",
    escDisputeProvider: "30000000-0000-4000-8000-000000000004",
    escFinished: "30000000-0000-4000-8000-000000000005",
  },
  disputes: {
    byClient: "40000000-0000-4000-8000-000000000001",
    byProvider: "40000000-0000-4000-8000-000000000002",
  },
};

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function seedOrderOnce(id: string, fn: () => Promise<void>) {
  const existing = await prisma.serviceOrder.findUnique({
    where: { id },
    select: { id: true },
  });
  if (existing) return;
  await fn();
}

async function main() {
  console.log("🌱 Semeando dados iniciais PoC da Kuara...");

  const passwordHash = await bcrypt.hash("senha123", 10);
  const adminHash = await bcrypt.hash("admin123", 10);

  // 1. Admin
  await prisma.user.upsert({
    where: { email: "admin@kuara.com.br" },
    update: {},
    create: {
      email: "admin@kuara.com.br",
      passwordHash: adminHash,
      name: "Administrador Kuara",
      phone: "11999990000",
      role: Role.ADMIN,
    },
  });

  // 2. Verified Providers
  const carlos = await prisma.user.upsert({
    where: { email: "carlos.eletricista@kuara.com.br" },
    update: {},
    create: {
      email: "carlos.eletricista@kuara.com.br",
      passwordHash,
      name: "Carlos Ferreira (Eletricista)",
      phone: "11988887777",
      role: Role.PROVIDER,
      providerProfile: {
        create: {
          cpfCnpj: "12345678901",
          pixKey: "carlos@pix.com",
          bio: "Eletricista residencial e predial há mais de 8 anos. Instalações, chuveiros e quadros de força.",
          categories: ["Elétrica", "Climatização"],
          serviceAreas: ["São Paulo", "Pinheiros", "Vila Mariana"],
          status: ProviderStatus.VERIFIED,
          ratingAverage: 4.9,
          ratingCount: 14,
          documentUrl: "https://docs.kuara.com/carlos_cnh.pdf",
          addressProofUrl: "https://docs.kuara.com/carlos_residencia.pdf",
        },
      },
    },
  });

  const ana = await prisma.user.upsert({
    where: { email: "ana.hidraulica@kuara.com.br" },
    update: {},
    create: {
      email: "ana.hidraulica@kuara.com.br",
      passwordHash,
      name: "Ana Paula Oliveira (Hidráulica)",
      phone: "19987654321",
      role: Role.PROVIDER,
      providerProfile: {
        create: {
          cpfCnpj: "23456789012",
          pixKey: "ana.hidraulica@pix.com",
          bio: "Especialista em caça-vazamentos, válvulas Hydra, registros e impermeabilização residencial.",
          categories: ["Hidráulica", "Alvenaria"],
          serviceAreas: ["São Paulo", "Campinas", "Osasco"],
          status: ProviderStatus.VERIFIED,
          ratingAverage: 4.8,
          ratingCount: 9,
          documentUrl: "https://docs.kuara.com/ana_cnh.pdf",
          addressProofUrl: "https://docs.kuara.com/ana_residencia.pdf",
        },
      },
    },
  });

  // 3. Pending & Rejected Providers (for Admin Moderation tab)
  await prisma.user.upsert({
    where: { email: "joao.pedreiro@kuara.com.br" },
    update: {},
    create: {
      email: "joao.pedreiro@kuara.com.br",
      passwordHash,
      name: "João Silva (Alvenaria e Pintura)",
      phone: "11977776666",
      role: Role.PROVIDER,
      providerProfile: {
        create: {
          cpfCnpj: "98765432100",
          pixKey: "joao@pix.com",
          bio: "Especialista em reformas, pisos, pintura e alvenaria em geral.",
          categories: ["Alvenaria", "Pintura"],
          serviceAreas: ["São Paulo", "Zona Sul", "Santo Amaro"],
          status: ProviderStatus.PENDING_VERIFICATION,
          documentUrl: "https://docs.kuara.com/joao_rg.pdf",
          addressProofUrl: "https://docs.kuara.com/joao_residencia.pdf",
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "marcos.pintura@kuara.com.br" },
    update: {},
    create: {
      email: "marcos.pintura@kuara.com.br",
      passwordHash,
      name: "Marcos Souza (Pintura)",
      phone: "11955554444",
      role: Role.PROVIDER,
      providerProfile: {
        create: {
          cpfCnpj: "34567890123",
          pixKey: "marcos@pix.com",
          bio: "Pintura interna, massa corrida e textura.",
          categories: ["Pintura"],
          serviceAreas: ["Guarulhos", "São Paulo"],
          status: ProviderStatus.REJECTED,
          rejectionReason:
            "Comprovante de residência emitido há mais de 90 dias. Reenvie um documento atualizado.",
          documentUrl: "https://docs.kuara.com/marcos_rg.pdf",
          addressProofUrl: "https://docs.kuara.com/marcos_residencia.pdf",
        },
      },
    },
  });

  // 4. Clients
  const maria = await prisma.user.upsert({
    where: { email: "maria.cliente@kuara.com.br" },
    update: {},
    create: {
      email: "maria.cliente@kuara.com.br",
      passwordHash,
      name: "Maria Antônia Albuquerque",
      phone: "11966665555",
      role: Role.CLIENT,
    },
  });

  const roberto = await prisma.user.upsert({
    where: { email: "roberto.cliente@kuara.com.br" },
    update: {},
    create: {
      email: "roberto.cliente@kuara.com.br",
      passwordHash,
      name: "Roberto Mendes",
      phone: "19966664444",
      role: Role.CLIENT,
    },
  });

  // 5. Realistic PoC Orders spanning all lifecycle stages + pagination
  const openOrdersSeed = [
    {
      id: POC_IDS.orders.open1,
      clientId: maria.id,
      title: "Instalação de 2 ventiladores de teto na sala",
      description:
        "Preciso instalar dois ventiladores novos em pontos já existentes com interruptor de parede.",
      category: "Elétrica",
      addressCity: "São Paulo",
      addressState: "SP",
      addressZip: "05422-010",
      addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
      createdAt: hoursAgo(2),
    },
    {
      id: POC_IDS.orders.open2,
      clientId: maria.id,
      title: "Reparo de infiltração embaixo da pia da cozinha",
      description:
        "Há um gotejamento constante na conexão da parede quando a torneira é aberta.",
      category: "Hidráulica",
      addressCity: "São Paulo",
      addressState: "SP",
      addressZip: "05422-010",
      addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
      createdAt: hoursAgo(4),
    },
    {
      id: POC_IDS.orders.open3,
      clientId: maria.id,
      title: "Pintura de quarto infantil e correção de trincas",
      description:
        "Aplicar massa em duas fissuras superficiais e duas demãos de tinta acrílica lavável.",
      category: "Pintura",
      addressCity: "São Paulo",
      addressState: "SP",
      addressZip: "05422-010",
      addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
      createdAt: hoursAgo(6),
    },
    {
      id: POC_IDS.orders.open4,
      clientId: maria.id,
      title: "Troca de 6 tomadas antigas para padrão 20A",
      description:
        "Substituir tomadas da cozinha e lavanderia para suportar eletrodomésticos novos.",
      category: "Elétrica",
      addressCity: "São Paulo",
      addressState: "SP",
      addressZip: "05422-010",
      addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
      createdAt: hoursAgo(8),
    },
    {
      id: POC_IDS.orders.open5,
      clientId: roberto.id,
      title: "Assentamento de piso cerâmico na área de serviço",
      description:
        "Área de aproximadamente 9 m² já nivelada; o piso cerâmico já está no local.",
      category: "Alvenaria",
      addressCity: "Campinas",
      addressState: "SP",
      addressZip: "13015-100",
      addressLine: "Av. Francisco Glicério, 980 - Centro",
      createdAt: hoursAgo(10),
    },
  ];

  for (const ord of openOrdersSeed) {
    await seedOrderOnce(ord.id, async () => {
      await prisma.serviceOrder.create({
        data: {
          ...ord,
          photos: [],
          completionPhotos: [],
          status: ServiceStatus.OPEN,
        },
      });
    });
  }

  // Order 6: PROPOSALS_RECEIVED (2 competing proposals, with and without materials advance)
  await seedOrderOnce(POC_IDS.orders.proposalsReceived, async () => {
    await prisma.serviceOrder.create({
      data: {
        id: POC_IDS.orders.proposalsReceived,
        clientId: maria.id,
        title: "Troca de registro geral e sifão da lavanderia",
        description:
          "Registro principal está emperrado e o sifão do tanque apresenta vazamento na rosca.",
        category: "Hidráulica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "05422-010",
        addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
        photos: [],
        completionPhotos: [],
        status: ServiceStatus.PROPOSALS_RECEIVED,
        createdAt: hoursAgo(14),
      },
    });

    await prisma.proposal.createMany({
      data: [
        {
          id: POC_IDS.proposals.propAna1,
          serviceOrderId: POC_IDS.orders.proposalsReceived,
          providerId: ana.id,
          description:
            "Substituição completa do registro de gaveta com solda fria, troca do sifão e teste de estanqueidade.",
          estimatedDays: 1,
          laborCostCents: 20000,
          materialCostCents: 8000,
          materialPolicy: MaterialPolicy.PROVIDER_ADVANCE,
          materialsList: "1x Registro 3/4 Deca, 1x Sifão universal reforçado, fita veda-rosca",
          totalCents: 28000,
          status: ProposalStatus.PENDING,
        },
        {
          id: POC_IDS.proposals.propCarlos1,
          serviceOrderId: POC_IDS.orders.proposalsReceived,
          providerId: carlos.id,
          description:
            "Mão de obra para troca do registro e revisão das conexões (contratante fornece peças).",
          estimatedDays: 1,
          laborCostCents: 24000,
          materialCostCents: 0,
          materialPolicy: MaterialPolicy.CLIENT_SUPPLIES,
          totalCents: 24000,
          status: ProposalStatus.PENDING,
        },
      ],
    });

    await prisma.message.create({
      data: {
        serviceOrderId: POC_IDS.orders.proposalsReceived,
        proposalId: POC_IDS.proposals.propAna1,
        senderId: maria.id,
        recipientId: ana.id,
        content: "Ana, você consegue realizar o serviço ainda nesta semana no período da manhã?",
      },
    });
  });

  // Order 7: ESCROW_PENDING (Accepted proposal awaiting PIX/Card payment)
  await seedOrderOnce(POC_IDS.orders.escrowPending, async () => {
    await prisma.serviceOrder.create({
      data: {
        id: POC_IDS.orders.escrowPending,
        clientId: maria.id,
        title: "Higienização e recarga de gás de ar-condicionado split",
        description:
          "Aparelho 12.000 BTUs parou de gelar adequadamente; precisa de limpeza completa.",
        category: "Climatização",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "05422-010",
        addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
        photos: [],
        completionPhotos: [],
        status: ServiceStatus.ESCROW_PENDING,
        createdAt: hoursAgo(18),
      },
    });

    await prisma.proposal.create({
      data: {
        id: POC_IDS.proposals.propEscrowPending,
        serviceOrderId: POC_IDS.orders.escrowPending,
        providerId: carlos.id,
        description:
          "Desmontagem de carenagem, higienização bactericida, verificação de pressão e carga de gás.",
        estimatedDays: 1,
        laborCostCents: 22000,
        materialCostCents: 6000,
        materialPolicy: MaterialPolicy.PROVIDER_ADVANCE,
        materialsList: "Fluido refrigerante R410A e solução higienizadora",
        totalCents: 28000,
        isAccepted: true,
        status: ProposalStatus.ACCEPTED,
      },
    });

    await prisma.serviceOrder.update({
      where: { id: POC_IDS.orders.escrowPending },
      data: { acceptedProposalId: POC_IDS.proposals.propEscrowPending },
    });
  });

  // Order 8: IN_PROGRESS (Paid via CARD, materials released immediately, labor held in custody)
  await seedOrderOnce(POC_IDS.orders.inProgress, async () => {
    await prisma.serviceOrder.create({
      data: {
        id: POC_IDS.orders.inProgress,
        clientId: maria.id,
        title: "Substituição de disjuntores e revisão do quadro de força",
        description:
          "Quadro residencial antigo com desarmes frequentes ao ligar chuveiro e micro-ondas juntos.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "05422-010",
        addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
        photos: [],
        completionPhotos: [],
        status: ServiceStatus.IN_PROGRESS,
        createdAt: hoursAgo(30),
      },
    });

    await prisma.proposal.create({
      data: {
        id: POC_IDS.proposals.propInProgress,
        serviceOrderId: POC_IDS.orders.inProgress,
        providerId: carlos.id,
        description:
          "Substituição de barramento, instalação de disjuntor DR e balanceamento das fases.",
        estimatedDays: 1,
        laborCostCents: 40000,
        materialCostCents: 15000,
        materialPolicy: MaterialPolicy.PROVIDER_ADVANCE,
        materialsList: "1x Disjuntor DR 63A, 4x Disjuntores DIN 20A/32A, terminais e barramento",
        totalCents: 55000,
        isAccepted: true,
        status: ProposalStatus.ACCEPTED,
      },
    });

    await prisma.serviceOrder.update({
      where: { id: POC_IDS.orders.inProgress },
      data: { acceptedProposalId: POC_IDS.proposals.propInProgress },
    });

    await prisma.escrow.create({
      data: {
        id: POC_IDS.escrows.escInProgress,
        serviceOrderId: POC_IDS.orders.inProgress,
        grossAmountCents: 55000,
        laborAmountCents: 40000,
        materialsAmountCents: 15000,
        materialsReleasedAt: hoursAgo(26),
        feeAmountCents: 2000,
        netAmountCents: 38000,
        status: EscrowStatus.HELD,
        paymentMethod: "CARD",
        paymentProviderId: "PAY-POC-0008",
        paidAt: hoursAgo(26),
      },
    });

    await prisma.message.createMany({
      data: [
        {
          serviceOrderId: POC_IDS.orders.inProgress,
          proposalId: POC_IDS.proposals.propInProgress,
          senderId: carlos.id,
          content: "Pagamento confirmado e materiais adquiridos. Chegarei às 09h conforme combinado.",
        },
        {
          serviceOrderId: POC_IDS.orders.inProgress,
          proposalId: POC_IDS.proposals.propInProgress,
          senderId: maria.id,
          content: "Perfeito, estarei em casa para liberar a portaria.",
        },
      ],
    });
  });

  // Order 9: COMPLETED_PENDING_APPROVAL (72h inspection window active)
  await seedOrderOnce(POC_IDS.orders.completedPending, async () => {
    await prisma.serviceOrder.create({
      data: {
        id: POC_IDS.orders.completedPending,
        clientId: roberto.id,
        title: "Reparo em vazamento de válvula Hydra no banheiro",
        description: "Descarga continua escorrendo água após acionamento.",
        category: "Hidráulica",
        addressCity: "Campinas",
        addressState: "SP",
        addressZip: "13015-100",
        addressLine: "Av. Francisco Glicério, 980 - Centro",
        photos: [],
        completionPhotos: [],
        status: ServiceStatus.COMPLETED_PENDING_APPROVAL,
        completedAt: hoursAgo(5),
        autoReleaseAt: hoursFromNow(67),
        createdAt: hoursAgo(48),
      },
    });

    await prisma.proposal.create({
      data: {
        id: POC_IDS.proposals.propCompletedPending,
        serviceOrderId: POC_IDS.orders.completedPending,
        providerId: ana.id,
        description: "Troca do reparo completo da válvula Hydra e vedação da sede.",
        estimatedDays: 1,
        laborCostCents: 30000,
        materialCostCents: 0,
        materialPolicy: MaterialPolicy.CLIENT_SUPPLIES,
        totalCents: 30000,
        isAccepted: true,
        status: ProposalStatus.ACCEPTED,
      },
    });

    await prisma.serviceOrder.update({
      where: { id: POC_IDS.orders.completedPending },
      data: { acceptedProposalId: POC_IDS.proposals.propCompletedPending },
    });

    await prisma.escrow.create({
      data: {
        id: POC_IDS.escrows.escCompletedPending,
        serviceOrderId: POC_IDS.orders.completedPending,
        grossAmountCents: 30000,
        laborAmountCents: 30000,
        materialsAmountCents: 0,
        feeAmountCents: 1500,
        netAmountCents: 28500,
        status: EscrowStatus.HELD,
        paymentMethod: "PIX",
        paymentProviderId: "PIX-POC-0009",
        paidAt: hoursAgo(40),
      },
    });
  });

  // Order 10: IN_DISPUTE (Opened by Client, Provider responded with counter-evidence)
  await seedOrderOnce(POC_IDS.orders.disputeByClient, async () => {
    await prisma.serviceOrder.create({
      data: {
        id: POC_IDS.orders.disputeByClient,
        clientId: roberto.id,
        title: "Impermeabilização e vedação de box do banheiro",
        description: "Reaplicação de silicone estrutural e rejunte epóxi na área molhada.",
        category: "Hidráulica",
        addressCity: "Campinas",
        addressState: "SP",
        addressZip: "13015-100",
        addressLine: "Av. Francisco Glicério, 980 - Centro",
        photos: [],
        completionPhotos: [],
        status: ServiceStatus.IN_DISPUTE,
        completedAt: hoursAgo(20),
        createdAt: hoursAgo(72),
      },
    });

    await prisma.proposal.create({
      data: {
        id: POC_IDS.proposals.propDisputeClient,
        serviceOrderId: POC_IDS.orders.disputeByClient,
        providerId: ana.id,
        description: "Remoção do rejunte antigo e vedação completa do box com silicone acético.",
        estimatedDays: 1,
        laborCostCents: 35000,
        materialCostCents: 15000,
        materialPolicy: MaterialPolicy.PROVIDER_ADVANCE,
        materialsList: "2x Silicone estrutural, rejunte epóxi 1kg",
        totalCents: 50000,
        isAccepted: true,
        status: ProposalStatus.ACCEPTED,
      },
    });

    await prisma.serviceOrder.update({
      where: { id: POC_IDS.orders.disputeByClient },
      data: { acceptedProposalId: POC_IDS.proposals.propDisputeClient },
    });

    await prisma.escrow.create({
      data: {
        id: POC_IDS.escrows.escDisputeClient,
        serviceOrderId: POC_IDS.orders.disputeByClient,
        grossAmountCents: 50000,
        laborAmountCents: 35000,
        materialsAmountCents: 15000,
        materialsReleasedAt: hoursAgo(65),
        feeAmountCents: 1750,
        netAmountCents: 33250,
        status: EscrowStatus.DISPUTED,
        paymentMethod: "PIX",
        paymentProviderId: "PIX-POC-0010",
        paidAt: hoursAgo(65),
      },
    });

    await prisma.dispute.create({
      data: {
        id: POC_IDS.disputes.byClient,
        serviceOrderId: POC_IDS.orders.disputeByClient,
        openedById: roberto.id,
        reason:
          "Após o primeiro banho, ainda há água escorrendo pelo canto esquerdo do perfil do box para fora do banheiro.",
        evidencePhotos: [],
        counterEvidenceReason:
          "A vedação aplicada secou normalmente; a passagem ocorre por desnível antigo no piso fora da área do perfil que não fazia parte do escopo.",
        counterEvidencePhotos: [],
        status: "PENDING_REVIEW",
        createdAt: hoursAgo(12),
      },
    });
  });

  // Order 11: IN_DISPUTE (Opened by Provider, awaiting Client counter-evidence)
  await seedOrderOnce(POC_IDS.orders.disputeByProvider, async () => {
    await prisma.serviceOrder.create({
      data: {
        id: POC_IDS.orders.disputeByProvider,
        clientId: maria.id,
        title: "Passagem de circuito 220V para ar-condicionado",
        description: "Levar circuito exclusivo do quadro até o quarto principal.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "05422-010",
        addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
        photos: [],
        completionPhotos: [],
        status: ServiceStatus.IN_DISPUTE,
        createdAt: hoursAgo(96),
      },
    });

    await prisma.proposal.create({
      data: {
        id: POC_IDS.proposals.propDisputeProvider,
        serviceOrderId: POC_IDS.orders.disputeByProvider,
        providerId: carlos.id,
        description: "Passagem de cabeamento 4mm em conduíte existente e disjuntor bipolar.",
        estimatedDays: 2,
        laborCostCents: 60000,
        materialCostCents: 0,
        materialPolicy: MaterialPolicy.CLIENT_SUPPLIES,
        totalCents: 60000,
        isAccepted: true,
        status: ProposalStatus.ACCEPTED,
      },
    });

    await prisma.serviceOrder.update({
      where: { id: POC_IDS.orders.disputeByProvider },
      data: { acceptedProposalId: POC_IDS.proposals.propDisputeProvider },
    });

    await prisma.escrow.create({
      data: {
        id: POC_IDS.escrows.escDisputeProvider,
        serviceOrderId: POC_IDS.orders.disputeByProvider,
        grossAmountCents: 60000,
        laborAmountCents: 60000,
        materialsAmountCents: 0,
        feeAmountCents: 3000,
        netAmountCents: 57000,
        status: EscrowStatus.DISPUTED,
        paymentMethod: "CARD",
        paymentProviderId: "PAY-POC-0011",
        paidAt: hoursAgo(80),
      },
    });

    await prisma.dispute.create({
      data: {
        id: POC_IDS.disputes.byProvider,
        serviceOrderId: POC_IDS.orders.disputeByProvider,
        openedById: carlos.id,
        reason:
          "O eletroduto embutido está obstruído por concreto e a contratante solicita quebra de alvenaria e novo acabamento fora do orçamento aprovado.",
        evidencePhotos: [],
        counterEvidenceReason: null,
        counterEvidencePhotos: [],
        status: "PENDING_REVIEW",
        createdAt: hoursAgo(6),
      },
    });
  });

  // Order 12: FINISHED (Released escrow + mutual 5-star reviews)
  await seedOrderOnce(POC_IDS.orders.finished, async () => {
    await prisma.serviceOrder.create({
      data: {
        id: POC_IDS.orders.finished,
        clientId: maria.id,
        title: "Troca de resistência e fiação do chuveiro",
        description: "Chuveiro queimou conector e precisa de emenda adequada em porcelana.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "05422-010",
        addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
        photos: [],
        completionPhotos: [],
        status: ServiceStatus.FINISHED,
        completedAt: hoursAgo(120),
        createdAt: hoursAgo(144),
      },
    });

    await prisma.proposal.create({
      data: {
        id: POC_IDS.proposals.propFinished,
        serviceOrderId: POC_IDS.orders.finished,
        providerId: carlos.id,
        description: "Substituição de conector cerâmico, revisão do cabo 6mm e teste de carga.",
        estimatedDays: 1,
        laborCostCents: 18000,
        materialCostCents: 0,
        materialPolicy: MaterialPolicy.CLIENT_SUPPLIES,
        totalCents: 18000,
        isAccepted: true,
        status: ProposalStatus.ACCEPTED,
      },
    });

    await prisma.serviceOrder.update({
      where: { id: POC_IDS.orders.finished },
      data: { acceptedProposalId: POC_IDS.proposals.propFinished },
    });

    await prisma.escrow.create({
      data: {
        id: POC_IDS.escrows.escFinished,
        serviceOrderId: POC_IDS.orders.finished,
        grossAmountCents: 18000,
        laborAmountCents: 18000,
        materialsAmountCents: 0,
        feeAmountCents: 900,
        netAmountCents: 17100,
        status: EscrowStatus.RELEASED,
        paymentMethod: "PIX",
        paymentProviderId: "PIX-POC-0012",
        paidAt: hoursAgo(130),
        releasedAt: hoursAgo(118),
      },
    });

    await prisma.review.createMany({
      data: [
        {
          serviceOrderId: POC_IDS.orders.finished,
          authorId: maria.id,
          targetId: carlos.id,
          rating: 5,
          tags: ["Pontual", "Capricho", "Escopo Claro"],
          comment: "Atendimento rápido, deixou tudo limpo e explicou o problema.",
        },
        {
          serviceOrderId: POC_IDS.orders.finished,
          authorId: carlos.id,
          targetId: maria.id,
          rating: 5,
          tags: ["Comunicação Clara", "Acesso Facilitado"],
          comment: "Contratante atenciosa e aprovação rápida após os testes.",
        },
      ],
    });
  });

  // Order 13: CANCELLED (so Maria has 9+ orders to demonstrate pagination cleanly)
  await seedOrderOnce(POC_IDS.orders.cancelled, async () => {
    await prisma.serviceOrder.create({
      data: {
        id: POC_IDS.orders.cancelled,
        clientId: maria.id,
        title: "Revisão de interfone do sobrado",
        description: "Botão externo sem retorno de áudio.",
        category: "Elétrica",
        addressCity: "São Paulo",
        addressState: "SP",
        addressZip: "05422-010",
        addressLine: "Rua dos Pinheiros, 420 - Pinheiros",
        photos: [],
        completionPhotos: [],
        status: ServiceStatus.CANCELLED,
        cancelledReason: "Condomínio assumiu o reparo da central.",
        cancelledAt: hoursAgo(140),
        createdAt: hoursAgo(160),
      },
    });
  });

  console.log("✅ Seed PoC concluído com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

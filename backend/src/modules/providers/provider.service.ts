import { prisma } from "../../shared/database";
import { AppError } from "../../shared/errors";
import { Prisma, ProviderStatus, EscrowStatus, ServiceStatus } from "@prisma/client";
import { normalizeText, SAFE_PROVIDER_PROFILE_SELECT } from "../../shared/presenters";
import {
  buildPaginationMeta,
  normalizeSqlLikePattern,
  PaginationParams,
  pgUnaccentSql,
} from "../../shared/pagination";

export interface ShowcaseFilterOptions {
  category?: string;
  city?: string;
  search?: string;
  pagination?: PaginationParams;
}

export interface AdminProvidersFilterOptions {
  status?: ProviderStatus;
  search?: string;
  pagination?: PaginationParams;
}

export class ProviderService {
  async getShowcase(
    categoryOrOptions?: string | ShowcaseFilterOptions,
    city?: string,
    search?: string
  ) {
    const opts: ShowcaseFilterOptions =
      typeof categoryOrOptions === "object" && categoryOrOptions !== null
        ? categoryOrOptions
        : { category: categoryOrOptions, city, search };

    const cat = opts.category?.trim();
    const cty = opts.city?.trim();
    const q = opts.search?.trim();

    if (opts.pagination?.isPaginated) {
      const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'VERIFIED'::"ProviderStatus"`];

      if (cat) {
        const pat = normalizeSqlLikePattern(cat);
        conditions.push(
          Prisma.sql`EXISTS (SELECT 1 FROM unnest(p.categories) AS c WHERE ${pgUnaccentSql(
            Prisma.sql`c`
          )} LIKE ${pat})`
        );
      }
      if (cty) {
        const pat = normalizeSqlLikePattern(cty);
        conditions.push(
          Prisma.sql`EXISTS (SELECT 1 FROM unnest(p."serviceAreas") AS a WHERE ${pgUnaccentSql(
            Prisma.sql`a`
          )} LIKE ${pat})`
        );
      }
      if (q) {
        const pat = normalizeSqlLikePattern(q);
        conditions.push(
          Prisma.sql`(
            ${pgUnaccentSql(Prisma.sql`u.name`)} LIKE ${pat}
            OR ${pgUnaccentSql(Prisma.sql`coalesce(p.bio, '')`)} LIKE ${pat}
            OR EXISTS (SELECT 1 FROM unnest(p.categories) AS c WHERE ${pgUnaccentSql(
              Prisma.sql`c`
            )} LIKE ${pat})
            OR EXISTS (SELECT 1 FROM unnest(p."serviceAreas") AS a WHERE ${pgUnaccentSql(
              Prisma.sql`a`
            )} LIKE ${pat})
          )`
        );
      }

      const whereSql = Prisma.join(conditions, " AND ");

      const [countRows, idRows] = await Promise.all([
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COUNT(*)::int AS total
          FROM "ProviderProfile" p
          JOIN "User" u ON u.id = p."userId"
          WHERE ${whereSql}
        `,
        prisma.$queryRaw<{ id: string }[]>`
          SELECT p.id
          FROM "ProviderProfile" p
          JOIN "User" u ON u.id = p."userId"
          WHERE ${whereSql}
          ORDER BY p."ratingAverage" DESC, p."createdAt" DESC
          LIMIT ${opts.pagination.limit} OFFSET ${opts.pagination.skip}
        `,
      ]);

      const total = countRows[0]?.total ?? 0;
      const ids = idRows.map((r) => r.id);

      const profiles =
        ids.length > 0
          ? await prisma.providerProfile.findMany({
              where: { id: { in: ids } },
              select: {
                ...SAFE_PROVIDER_PROFILE_SELECT,
                user: { select: { id: true, name: true } },
              },
            })
          : [];

      const byId = new Map(profiles.map((p) => [p.id, p]));
      const items = ids.map((id) => byId.get(id)).filter(Boolean);

      return {
        items,
        meta: buildPaginationMeta(total, opts.pagination.page, opts.pagination.limit),
      };
    }

    const profiles = await prisma.providerProfile.findMany({
      where: { status: ProviderStatus.VERIFIED },
      select: {
        ...SAFE_PROVIDER_PROFILE_SELECT,
        user: { select: { id: true, name: true } },
      },
      orderBy: { ratingAverage: "desc" },
    });

    const normCategory = cat ? normalizeText(cat) : "";
    const normCity = cty ? normalizeText(cty) : "";
    const normSearch = q ? normalizeText(q) : "";

    return profiles.filter((p) => {
      if (normCategory) {
        const matchesCat = p.categories.some((c) => normalizeText(c).includes(normCategory));
        if (!matchesCat) return false;
      }
      if (normCity) {
        const matchesCity = p.serviceAreas.some((area) => normalizeText(area).includes(normCity));
        if (!matchesCity) return false;
      }
      if (normSearch) {
        const haystack = [
          p.user.name,
          p.bio || "",
          ...p.categories,
          ...p.serviceAreas,
        ]
          .map(normalizeText)
          .join(" ");
        if (!haystack.includes(normSearch)) return false;
      }
      return true;
    });
  }

  async submitVerificationDocs(userId: string, documentUrl: string, addressProofUrl: string) {
    const profile = await prisma.providerProfile.findUnique({ where: { userId } });
    if (!profile) throw new AppError("Perfil de prestador não encontrado", 404);

    if (profile.status === ProviderStatus.SUSPENDED) {
      throw new AppError(
        "Perfil suspenso pela moderação. Entre em contato com o suporte para reativação.",
        403
      );
    }

    if (profile.status === ProviderStatus.VERIFIED) {
      throw new AppError(
        "Seu perfil já está verificado. Não é necessário reenviar documentos.",
        400
      );
    }

    return prisma.providerProfile.update({
      where: { userId },
      data: {
        documentUrl,
        addressProofUrl,
        status: ProviderStatus.PENDING_VERIFICATION,
        rejectionReason: null,
      },
    });
  }

  async getPendingVerifications() {
    return prisma.providerProfile.findMany({
      where: { status: ProviderStatus.PENDING_VERIFICATION },
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getAllProviders(options?: AdminProvidersFilterOptions) {
    const where: Prisma.ProviderProfileWhereInput = {};
    if (options?.status) {
      where.status = options.status;
    }
    const q = options?.search?.trim();
    if (q) {
      where.OR = [
        { cpfCnpj: { contains: q, mode: "insensitive" } },
        { pixKey: { contains: q, mode: "insensitive" } },
        { user: { name: { contains: q, mode: "insensitive" } } },
        { user: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const pag = options?.pagination;
    if (pag?.isPaginated) {
      const [total, items] = await Promise.all([
        prisma.providerProfile.count({ where }),
        prisma.providerProfile.findMany({
          where,
          include: { user: { select: { id: true, name: true, email: true, phone: true } } },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: pag.skip,
          take: pag.limit,
        }),
      ]);

      return {
        items,
        meta: buildPaginationMeta(total, pag.page, pag.limit),
      };
    }

    return prisma.providerProfile.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async updateVerificationStatus(
    profileId: string,
    status: ProviderStatus,
    rejectionReason?: string
  ) {
    let profile = await prisma.providerProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      profile = await prisma.providerProfile.findUnique({ where: { userId: profileId } });
    }
    if (!profile) throw new AppError("Perfil de prestador não encontrado", 404);

    const nextReason =
      status === ProviderStatus.REJECTED || status === ProviderStatus.SUSPENDED
        ? rejectionReason ?? profile.rejectionReason ?? null
        : null;

    return prisma.providerProfile.update({
      where: { id: profile.id },
      data: {
        status,
        rejectionReason: nextReason,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async getWalletMetrics(userId: string) {
    const [orders, escrowPendingCount, openOpportunitiesRows] = await Promise.all([
      prisma.serviceOrder.findMany({
        where: { acceptedProposal: { providerId: userId } },
        include: { escrow: true },
      }),
      prisma.serviceOrder.count({
        where: {
          status: ServiceStatus.ESCROW_PENDING,
          acceptedProposal: { providerId: userId },
        },
      }),
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM "ServiceOrder" o
        WHERE o.status IN ('OPEN'::"ServiceStatus", 'PROPOSALS_RECEIVED'::"ServiceStatus")
          AND (o."targetProviderId" IS NULL OR o."targetProviderId" = ${userId})
          AND NOT EXISTS (
            SELECT 1 FROM "Proposal" p
            WHERE p."serviceOrderId" = o.id AND p."providerId" = ${userId}
          )
          AND (
            SELECT COUNT(*) FROM "Proposal" p2
            WHERE p2."serviceOrderId" = o.id
          ) < 4
      `,
    ]);

    let heldCents = 0;
    let disputedCents = 0;
    let availableNetCents = 0;
    let materialsAdvancedCents = 0;
    let completedCount = 0;
    let activeCount = 0;
    let disputedCount = 0;

    for (const o of orders) {
      if (o.escrow?.materialsReleasedAt && o.escrow.materialsAmountCents > 0) {
        materialsAdvancedCents += o.escrow.materialsAmountCents;
      }

      if (o.escrow?.status === EscrowStatus.HELD) {
        heldCents += o.escrow.netAmountCents;
        activeCount++;
      } else if (o.escrow?.status === EscrowStatus.DISPUTED) {
        disputedCents += o.escrow.netAmountCents;
        disputedCount++;
        activeCount++;
      } else if (o.escrow?.status === EscrowStatus.RELEASED) {
        availableNetCents += o.escrow.netAmountCents;
        completedCount++;
      }
    }

    return {
      inEscrowCents: heldCents + disputedCents,
      heldCents,
      disputedCents,
      materialsAdvancedCents,
      availableNetCents,
      totalEarnedCents: availableNetCents,
      totalReceivedWithMaterialsCents: availableNetCents + materialsAdvancedCents,
      activeServicesCount: activeCount,
      escrowPendingCount,
      activeJobsCount: activeCount + escrowPendingCount,
      openOpportunitiesCount: openOpportunitiesRows[0]?.total ?? 0,
      disputedServicesCount: disputedCount,
      completedServicesCount: completedCount,
    };
  }
}

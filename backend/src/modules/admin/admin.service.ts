import { prisma } from "../../shared/database";
import { EscrowStatus, Prisma, ProviderStatus, Role, ServiceStatus } from "@prisma/client";
import { getHeldCustodyCents } from "../escrow/escrow.rules";
import {
  buildPaginationMeta,
  normalizeSqlLikePattern,
  PaginationParams,
  pgUnaccentSql,
} from "../../shared/pagination";

export interface AdminDisputesFilter {
  status?: string;
  pagination?: PaginationParams;
}

export interface AdminOrdersFilter {
  status?: string;
  search?: string;
  pagination?: PaginationParams;
}

export interface AdminUsersFilter {
  role?: string;
  search?: string;
  pagination?: PaginationParams;
}

export class AdminService {
  async getMetrics() {
    const [escrows, orders, providers, userCount, activeDisputesCount] = await Promise.all([
      prisma.escrow.findMany(),
      prisma.serviceOrder.findMany({ select: { status: true } }),
      prisma.providerProfile.findMany({ select: { status: true } }),
      prisma.user.count(),
      prisma.dispute.count({ where: { status: { not: "RESOLVED" } } }),
    ]);

    const totalGMVCents = escrows.reduce((acc, e) => {
      if (e.status === EscrowStatus.HELD || e.status === EscrowStatus.DISPUTED) {
        return acc + e.grossAmountCents;
      }
      if (e.status === EscrowStatus.RELEASED) {
        return acc + Math.max(0, e.grossAmountCents - (e.refundedAmountCents || 0));
      }
      return acc;
    }, 0);

    const totalRevenueKuaraCents = escrows
      .filter((e) => e.status === EscrowStatus.RELEASED)
      .reduce((acc, e) => acc + e.feeAmountCents, 0);

    const activeEscrowCents = escrows
      .filter((e) => e.status === EscrowStatus.HELD || e.status === EscrowStatus.DISPUTED)
      .reduce((acc, e) => acc + getHeldCustodyCents(e), 0);

    const disputedEscrowCents = escrows
      .filter((e) => e.status === EscrowStatus.DISPUTED)
      .reduce((acc, e) => acc + getHeldCustodyCents(e), 0);

    const materialsAdvancedTotalCents = escrows
      .filter((e) => e.materialsReleasedAt !== null && e.materialsAmountCents > 0)
      .reduce((acc, e) => acc + e.materialsAmountCents, 0);

    const refundedTotalCents = escrows.reduce((acc, e) => {
      if (e.status === EscrowStatus.REFUNDED) {
        return acc + (e.refundedAmountCents > 0 ? e.refundedAmountCents : getHeldCustodyCents(e));
      }
      if (e.status === EscrowStatus.RELEASED) return acc + (e.refundedAmountCents || 0);
      return acc;
    }, 0);

    const ordersByStatus: Record<string, number> = {};
    for (const status of Object.values(ServiceStatus)) {
      ordersByStatus[status] = 0;
    }
    for (const o of orders) {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    }

    const verifiedProviders = providers.filter((p) => p.status === ProviderStatus.VERIFIED).length;
    const pendingProviders = providers.filter(
      (p) => p.status === ProviderStatus.PENDING_VERIFICATION
    ).length;
    const rejectedProviders = providers.filter((p) => p.status === ProviderStatus.REJECTED).length;
    const suspendedProviders = providers.filter(
      (p) => p.status === ProviderStatus.SUSPENDED
    ).length;

    return {
      financial: {
        totalGMVCents,
        totalRevenueKuaraCents,
        activeEscrowCents,
        disputedEscrowCents,
        materialsAdvancedTotalCents,
        refundedTotalCents,
      },
      counts: {
        totalUsers: userCount,
        totalOrders: orders.length,
        activeDisputes: activeDisputesCount,
        verifiedProviders,
        pendingProviders,
        rejectedProviders,
        suspendedProviders,
        ordersByStatus,
      },
    };
  }

  async getDisputes(options?: AdminDisputesFilter) {
    const where: Prisma.DisputeWhereInput = {};
    if (options?.status && options.status !== "ALL") {
      if (options.status === "PENDING_REVIEW") {
        where.status = { not: "RESOLVED" };
      } else if (options.status === "RESOLVED") {
        where.status = "RESOLVED";
      }
    }

    const include = {
      serviceOrder: {
        include: {
          client: { select: { id: true, name: true, email: true, phone: true } },
          acceptedProposal: {
            include: {
              provider: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  phone: true,
                  providerProfile: {
                    select: { id: true, status: true, ratingAverage: true, ratingCount: true },
                  },
                },
              },
            },
          },
          escrow: true,
        },
      },
    };

    const decorateDispute = (dispute: any) => {
      const client = dispute.serviceOrder?.client || null;
      const provider = dispute.serviceOrder?.acceptedProposal?.provider || null;
      const openedById = dispute.openedById || null;

      let openedByRole: "CLIENT" | "PROVIDER" | null = null;
      if (openedById && client?.id && openedById === client.id) {
        openedByRole = "CLIENT";
      } else if (
        openedById &&
        ((provider?.id && openedById === provider.id) ||
          openedById === dispute.serviceOrder?.acceptedProposal?.providerId)
      ) {
        openedByRole = "PROVIDER";
      }

      const contestedRole =
        openedByRole === "CLIENT"
          ? "PROVIDER"
          : openedByRole === "PROVIDER"
          ? "CLIENT"
          : null;

      return {
        ...dispute,
        parties: {
          openedByRole,
          contestedRole,
          opener:
            openedByRole === "CLIENT"
              ? { role: "CLIENT", label: "Contratante", user: client }
              : openedByRole === "PROVIDER"
              ? { role: "PROVIDER", label: "Contratado", user: provider }
              : null,
          contested:
            contestedRole === "CLIENT"
              ? { role: "CLIENT", label: "Contratante", user: client }
              : contestedRole === "PROVIDER"
              ? { role: "PROVIDER", label: "Contratado", user: provider }
              : null,
        },
      };
    };

    const pag = options?.pagination;
    if (pag?.isPaginated) {
      const [total, items] = await Promise.all([
        prisma.dispute.count({ where }),
        prisma.dispute.findMany({
          where,
          include,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: pag.skip,
          take: pag.limit,
        }),
      ]);
      return {
        items: items.map(decorateDispute),
        meta: buildPaginationMeta(total, pag.page, pag.limit),
      };
    }

    const items = await prisma.dispute.findMany({
      where,
      include,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return items.map(decorateDispute);
  }

  async getAllOrders(options?: AdminOrdersFilter) {
    const where: Prisma.ServiceOrderWhereInput = {};
    if (options?.status && options.status !== "ALL") {
      if (Object.values(ServiceStatus).includes(options.status as ServiceStatus)) {
        where.status = options.status as ServiceStatus;
      }
    }

    const q = options?.search?.trim();
    if (q) {
      const pat = normalizeSqlLikePattern(q);
      const matchingIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT o.id
        FROM "ServiceOrder" o
        LEFT JOIN "User" c ON c.id = o."clientId"
        WHERE lower(o.id) LIKE ${pat}
           OR ${pgUnaccentSql(Prisma.sql`o.title`)} LIKE ${pat}
           OR ${pgUnaccentSql(Prisma.sql`o.category`)} LIKE ${pat}
           OR ${pgUnaccentSql(Prisma.sql`o."addressCity"`)} LIKE ${pat}
           OR ${pgUnaccentSql(Prisma.sql`coalesce(c.name, '')`)} LIKE ${pat}
      `;
      where.id = { in: matchingIds.map((r) => r.id) };
    }

    const include = {
      client: { select: { id: true, name: true, email: true } },
      acceptedProposal: {
        include: { provider: { select: { id: true, name: true, email: true } } },
      },
      escrow: true,
      dispute: true,
      _count: { select: { proposals: true } },
    };

    const pag = options?.pagination;
    if (pag?.isPaginated) {
      const [total, items] = await Promise.all([
        prisma.serviceOrder.count({ where }),
        prisma.serviceOrder.findMany({
          where,
          include,
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

    return prisma.serviceOrder.findMany({
      where,
      include,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  async getAllUsers(options?: AdminUsersFilter) {
    const where: Prisma.UserWhereInput = {};
    if (options?.role && options.role !== "ALL") {
      if (Object.values(Role).includes(options.role as Role)) {
        where.role = options.role as Role;
      }
    }

    const q = options?.search?.trim();
    if (q) {
      const pat = normalizeSqlLikePattern(q);
      const matchingIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" u
        WHERE ${pgUnaccentSql(Prisma.sql`u.name`)} LIKE ${pat}
           OR lower(u.email) LIKE ${pat}
           OR lower(u.phone) LIKE ${pat}
      `;
      where.id = { in: matchingIds.map((r) => r.id) };
    }

    const select = {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      providerProfile: {
        select: {
          id: true,
          status: true,
          rejectionReason: true,
          ratingAverage: true,
          ratingCount: true,
          categories: true,
          serviceAreas: true,
        },
      },
    };

    const pag = options?.pagination;
    if (pag?.isPaginated) {
      const [total, items] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select,
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

    return prisma.user.findMany({
      where,
      select,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }
}

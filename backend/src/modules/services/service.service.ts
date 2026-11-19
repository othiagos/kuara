import { prisma } from "../../shared/database";
import { AppError } from "../../shared/errors";
import {
  EscrowStatus,
  Prisma,
  ProposalStatus,
  ProviderStatus,
  Role,
  ServiceStatus,
} from "@prisma/client";
import {
  normalizeText,
  RatingSummary,
  SAFE_PROVIDER_PROFILE_SELECT,
  sanitizeServiceOrder,
  ViewerContext,
} from "../../shared/presenters";
import {
  buildPaginationMeta,
  normalizeSqlLikePattern,
  PaginationParams,
  pgUnaccentSql,
} from "../../shared/pagination";
import { getHeldCustodyCents } from "../escrow/escrow.rules";

export interface ListOpenFilterOptions {
  category?: string;
  city?: string;
  search?: string;
  pagination?: PaginationParams;
}

export interface ListMyOrdersOptions {
  status?: string;
  scope?: string;
  search?: string;
  pagination?: PaginationParams;
}

export interface CreateOrderDTO {
  title: string;
  description: string;
  category: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  addressLine: string;
  photos?: string[];
  targetProviderId?: string;
}

const ORDER_DETAIL_INCLUDE = {
  client: { select: { id: true, name: true, phone: true, email: true } },
  proposals: {
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          providerProfile: { select: SAFE_PROVIDER_PROFILE_SELECT },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  acceptedProposal: {
    include: {
      provider: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          providerProfile: { select: SAFE_PROVIDER_PROFILE_SELECT },
        },
      },
    },
  },
  escrow: true,
  dispute: true,
  reviews: {
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  _count: { select: { proposals: true } },
} as const;

export class ServiceService {
  private async getClientRatingsMap(clientIds: string[]): Promise<Map<string, RatingSummary>> {
    const map = new Map<string, RatingSummary>();
    if (clientIds.length === 0) return map;

    const uniqueIds = [...new Set(clientIds)];
    const grouped = await prisma.review.groupBy({
      by: ["targetId"],
      where: { targetId: { in: uniqueIds } },
      _avg: { rating: true },
      _count: { rating: true },
    });

    for (const g of grouped) {
      map.set(g.targetId, {
        ratingAverage: Math.round((g._avg.rating || 0) * 10) / 10,
        ratingCount: g._count.rating,
      });
    }
    return map;
  }

  async create(clientId: string, data: CreateOrderDTO) {
    if (data.targetProviderId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: data.targetProviderId },
        include: { providerProfile: true },
      });
      if (
        !targetUser ||
        targetUser.role !== Role.PROVIDER ||
        targetUser.providerProfile?.status !== ProviderStatus.VERIFIED
      ) {
        throw new AppError("O prestador escolhido não está verificado ou disponível", 400);
      }
    }

    return prisma.serviceOrder.create({
      data: {
        clientId,
        targetProviderId: data.targetProviderId || null,
        title: data.title,
        description: data.description,
        category: data.category,
        addressCity: data.addressCity,
        addressState: data.addressState,
        addressZip: data.addressZip,
        addressLine: data.addressLine,
        photos: data.photos || [],
        status: ServiceStatus.OPEN,
      },
    });
  }

  async listOpen(
    viewerId: string,
    categoryOrOptions?: string | ListOpenFilterOptions,
    city?: string
  ) {
    const opts: ListOpenFilterOptions =
      typeof categoryOrOptions === "object" && categoryOrOptions !== null
        ? categoryOrOptions
        : { category: categoryOrOptions, city };

    const OPEN_SELECT = {
      id: true,
      clientId: true,
      targetProviderId: true,
      title: true,
      description: true,
      category: true,
      addressCity: true,
      addressState: true,
      photos: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, name: true } },
      proposals: {
        where: { providerId: viewerId },
        select: { id: true },
      },
      _count: { select: { proposals: true } },
    } as const;

    const mapOpenRow = (o: any, ratings: Map<string, RatingSummary>) => ({
      id: o.id,
      clientId: o.clientId,
      targetProviderId: o.targetProviderId,
      title: o.title,
      description: o.description,
      category: o.category,
      addressCity: o.addressCity,
      addressState: o.addressState,
      photos: o.photos,
      status: o.status,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
      client: {
        id: o.client.id,
        name: o.client.name,
        ...(ratings.get(o.clientId) || { ratingAverage: 0, ratingCount: 0 }),
      },
      _count: o._count,
      proposalsCount: o._count.proposals,
      hasMyProposal: o.proposals.length > 0,
    });

    if (opts.pagination?.isPaginated) {
      const baseConditions: Prisma.Sql[] = [
        Prisma.sql`o.status IN ('OPEN'::"ServiceStatus", 'PROPOSALS_RECEIVED'::"ServiceStatus")`,
        Prisma.sql`(o."targetProviderId" IS NULL OR o."targetProviderId" = ${viewerId})`,
      ];
      const filterConditions = [...baseConditions];

      const cat = opts.category?.trim();
      const cty = opts.city?.trim();
      const q = opts.search?.trim();

      if (cat) {
        const pat = normalizeSqlLikePattern(cat);
        filterConditions.push(Prisma.sql`${pgUnaccentSql(Prisma.sql`o.category`)} LIKE ${pat}`);
      }
      if (cty) {
        const pat = normalizeSqlLikePattern(cty);
        filterConditions.push(
          Prisma.sql`${pgUnaccentSql(Prisma.sql`o."addressCity"`)} LIKE ${pat}`
        );
      }
      if (q) {
        const pat = normalizeSqlLikePattern(q);
        filterConditions.push(
          Prisma.sql`(
            ${pgUnaccentSql(Prisma.sql`o.title`)} LIKE ${pat}
            OR ${pgUnaccentSql(Prisma.sql`o.category`)} LIKE ${pat}
            OR ${pgUnaccentSql(Prisma.sql`o."addressCity"`)} LIKE ${pat}
          )`
        );
      }

      const baseWhereSql = Prisma.join(baseConditions, " AND ");
      const filterWhereSql = Prisma.join(filterConditions, " AND ");

      const [countRows, idRows, totalOpenRows, availableOpenRows] = await Promise.all([
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COUNT(*)::int AS total FROM "ServiceOrder" o WHERE ${filterWhereSql}
        `,
        prisma.$queryRaw<{ id: string }[]>`
          SELECT o.id FROM "ServiceOrder" o
          WHERE ${filterWhereSql}
          ORDER BY o."createdAt" DESC
          LIMIT ${opts.pagination.limit} OFFSET ${opts.pagination.skip}
        `,
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COUNT(*)::int AS total FROM "ServiceOrder" o WHERE ${baseWhereSql}
        `,
        prisma.$queryRaw<{ total: number }[]>`
          SELECT COUNT(*)::int AS total FROM "ServiceOrder" o
          WHERE ${baseWhereSql}
            AND NOT EXISTS (
              SELECT 1 FROM "Proposal" p
              WHERE p."serviceOrderId" = o.id AND p."providerId" = ${viewerId}
            )
            AND (
              SELECT COUNT(*) FROM "Proposal" p2
              WHERE p2."serviceOrderId" = o.id
            ) < 4
        `,
      ]);

      const total = countRows[0]?.total ?? 0;
      const ids = idRows.map((r) => r.id);

      const pageOrders =
        ids.length > 0
          ? await prisma.serviceOrder.findMany({
              where: { id: { in: ids } },
              select: OPEN_SELECT,
            })
          : [];

      const byId = new Map(pageOrders.map((o) => [o.id, o]));
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as typeof pageOrders;
      const ratings = await this.getClientRatingsMap(ordered.map((o) => o.clientId));

      return {
        items: ordered.map((o) => mapOpenRow(o, ratings)),
        meta: buildPaginationMeta(total, opts.pagination.page, opts.pagination.limit),
        summary: {
          totalOpen: totalOpenRows[0]?.total ?? 0,
          availableOpenCount: availableOpenRows[0]?.total ?? 0,
        },
      };
    }

    const orders = await prisma.serviceOrder.findMany({
      where: {
        status: { in: [ServiceStatus.OPEN, ServiceStatus.PROPOSALS_RECEIVED] },
        OR: [{ targetProviderId: null }, { targetProviderId: viewerId }],
      },
      select: OPEN_SELECT,
      orderBy: { createdAt: "desc" },
    });

    const normCategory = opts.category ? normalizeText(opts.category) : "";
    const normCity = opts.city ? normalizeText(opts.city) : "";

    const filtered = orders.filter((o) => {
      if (normCategory && !normalizeText(o.category).includes(normCategory)) {
        return false;
      }
      if (normCity && !normalizeText(o.addressCity).includes(normCity)) {
        return false;
      }
      return true;
    });

    const ratings = await this.getClientRatingsMap(filtered.map((o) => o.clientId));
    return filtered.map((o) => mapOpenRow(o, ratings));
  }

  async listMyOrders(viewer: ViewerContext, options?: ListMyOrdersOptions) {
    const baseWhere: Prisma.ServiceOrderWhereInput =
      viewer.role === Role.CLIENT
        ? { clientId: viewer.id }
        : {
            OR: [
              { targetProviderId: viewer.id },
              { acceptedProposal: { providerId: viewer.id } },
              { proposals: { some: { providerId: viewer.id } } },
            ],
          };

    const scopeWhere: Prisma.ServiceOrderWhereInput = { ...baseWhere };

    if (viewer.role === Role.PROVIDER && options?.scope) {
      if (options.scope === "active") {
        scopeWhere.status = {
          in: [
            ServiceStatus.ESCROW_PENDING,
            ServiceStatus.IN_PROGRESS,
            ServiceStatus.COMPLETED_PENDING_APPROVAL,
            ServiceStatus.IN_DISPUTE,
          ],
        };
        scopeWhere.OR = [
          { acceptedProposal: { providerId: viewer.id } },
          { targetProviderId: viewer.id, acceptedProposalId: null },
        ];
      } else if (options.scope === "bids") {
        scopeWhere.status = { in: [ServiceStatus.OPEN, ServiceStatus.PROPOSALS_RECEIVED] };
      } else if (options.scope === "history") {
        scopeWhere.status = { in: [ServiceStatus.FINISHED, ServiceStatus.CANCELLED] };
      } else if (options.scope === "finished") {
        scopeWhere.status = ServiceStatus.FINISHED;
        scopeWhere.OR = [{ acceptedProposal: { providerId: viewer.id } }];
      }
    }

    if (options?.status && options.status !== "ALL") {
      if (options.status === "OPEN") {
        scopeWhere.status = { in: [ServiceStatus.OPEN, ServiceStatus.PROPOSALS_RECEIVED] };
      } else if (options.status === "IN_PROGRESS") {
        scopeWhere.status = {
          in: [
            ServiceStatus.ESCROW_PENDING,
            ServiceStatus.IN_PROGRESS,
            ServiceStatus.COMPLETED_PENDING_APPROVAL,
            ServiceStatus.IN_DISPUTE,
          ],
        };
      } else if (Object.values(ServiceStatus).includes(options.status as ServiceStatus)) {
        scopeWhere.status = options.status as ServiceStatus;
      }
    }

    const q = options?.search?.trim();
    if (q) {
      const pat = normalizeSqlLikePattern(q);
      const matchingIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "ServiceOrder" o
        WHERE ${pgUnaccentSql(Prisma.sql`o.title`)} LIKE ${pat}
           OR ${pgUnaccentSql(Prisma.sql`o.category`)} LIKE ${pat}
           OR ${pgUnaccentSql(Prisma.sql`o."addressCity"`)} LIKE ${pat}
      `;
      scopeWhere.id = { in: matchingIds.map((r) => r.id) };
    }

    const pag = options?.pagination;
    if (pag?.isPaginated) {
      let summary: Record<string, number>;

      if (viewer.role === Role.CLIENT) {
        const grouped = await prisma.serviceOrder.groupBy({
          by: ["status"],
          where: { clientId: viewer.id },
          _count: { _all: true },
        });
        let totalOrders = 0;
        let openCount = 0;
        let inProgressCount = 0;
        let finishedCount = 0;
        for (const row of grouped) {
          const cnt = row._count._all;
          totalOrders += cnt;
          if (row.status === ServiceStatus.OPEN || row.status === ServiceStatus.PROPOSALS_RECEIVED) {
            openCount += cnt;
          } else if (
            row.status === ServiceStatus.ESCROW_PENDING ||
            row.status === ServiceStatus.IN_PROGRESS ||
            row.status === ServiceStatus.COMPLETED_PENDING_APPROVAL ||
            row.status === ServiceStatus.IN_DISPUTE
          ) {
            inProgressCount += cnt;
          } else if (row.status === ServiceStatus.FINISHED) {
            finishedCount += cnt;
          }
        }
        summary = { totalOrders, openCount, inProgressCount, finishedCount };
      } else {
        const [activeCount, bidsCount, historyCount, finishedCount] = await Promise.all([
          prisma.serviceOrder.count({
            where: {
              status: {
                in: [
                  ServiceStatus.ESCROW_PENDING,
                  ServiceStatus.IN_PROGRESS,
                  ServiceStatus.COMPLETED_PENDING_APPROVAL,
                  ServiceStatus.IN_DISPUTE,
                ],
              },
              OR: [
                { acceptedProposal: { providerId: viewer.id } },
                { targetProviderId: viewer.id, acceptedProposalId: null },
              ],
            },
          }),
          prisma.serviceOrder.count({
            where: {
              ...baseWhere,
              status: { in: [ServiceStatus.OPEN, ServiceStatus.PROPOSALS_RECEIVED] },
            },
          }),
          prisma.serviceOrder.count({
            where: {
              ...baseWhere,
              status: { in: [ServiceStatus.FINISHED, ServiceStatus.CANCELLED] },
            },
          }),
          prisma.serviceOrder.count({
            where: {
              status: ServiceStatus.FINISHED,
              acceptedProposal: { providerId: viewer.id },
            },
          }),
        ]);
        summary = { activeCount, bidsCount, historyCount, finishedCount };
      }

      const [total, orders] = await Promise.all([
        prisma.serviceOrder.count({ where: scopeWhere }),
        prisma.serviceOrder.findMany({
          where: scopeWhere,
          include: ORDER_DETAIL_INCLUDE,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: pag.skip,
          take: pag.limit,
        }),
      ]);

      const ratings = await this.getClientRatingsMap(orders.map((o) => o.clientId));
      const items = orders.map((o) =>
        sanitizeServiceOrder(
          o,
          viewer,
          ratings.get(o.clientId) || { ratingAverage: 0, ratingCount: 0 }
        )
      );

      return {
        items,
        meta: buildPaginationMeta(total, pag.page, pag.limit),
        summary,
      };
    }

    const orders = await prisma.serviceOrder.findMany({
      where: scopeWhere,
      include: ORDER_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    const ratings = await this.getClientRatingsMap(orders.map((o) => o.clientId));
    return orders.map((o) =>
      sanitizeServiceOrder(o, viewer, ratings.get(o.clientId) || { ratingAverage: 0, ratingCount: 0 })
    );
  }

  async getById(id: string, viewer: ViewerContext) {
    const order = await prisma.serviceOrder.findUnique({
      where: { id },
      include: ORDER_DETAIL_INCLUDE,
    });

    if (!order) {
      throw new AppError("Solicitação de serviço não encontrada", 404);
    }

    const isAdmin = viewer.role === Role.ADMIN;
    const isClient = order.clientId === viewer.id;
    const isAcceptedProvider = order.acceptedProposal?.providerId === viewer.id;
    const hasProposed = order.proposals.some((p) => p.providerId === viewer.id);
    const isDirectTarget = order.targetProviderId === viewer.id;
    const isPublicOpenOrder =
      !order.targetProviderId &&
      (order.status === ServiceStatus.OPEN || order.status === ServiceStatus.PROPOSALS_RECEIVED);

    if (!isAdmin && !isClient) {
      if (viewer.role !== Role.PROVIDER) {
        throw new AppError("Você não tem permissão para visualizar esta solicitação", 403);
      }
      if (order.targetProviderId && !isDirectTarget && !isAcceptedProvider && !hasProposed) {
        throw new AppError("Esta solicitação foi direcionada a outro prestador", 403);
      }
      if (!isPublicOpenOrder && !isDirectTarget && !isAcceptedProvider && !hasProposed) {
        throw new AppError("Você não tem permissão para visualizar esta solicitação", 403);
      }
    }

    const ratings = await this.getClientRatingsMap([order.clientId]);
    return sanitizeServiceOrder(
      order,
      viewer,
      ratings.get(order.clientId) || { ratingAverage: 0, ratingCount: 0 }
    );
  }

  async cancelOrder(orderId: string, viewer: ViewerContext, reason?: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${orderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: orderId },
        include: { escrow: true },
      });
      if (!order) {
        throw new AppError("Solicitação de serviço não encontrada", 404);
      }

      const isAdmin = viewer.role === Role.ADMIN;
      if (!isAdmin && order.clientId !== viewer.id) {
        throw new AppError("Apenas o contratante ou um administrador pode cancelar o serviço", 403);
      }

      const cancellablePreEscrow: ServiceStatus[] = [
        ServiceStatus.OPEN,
        ServiceStatus.PROPOSALS_RECEIVED,
        ServiceStatus.ESCROW_PENDING,
      ];

      const isPreStartRefund =
        order.status === ServiceStatus.IN_PROGRESS &&
        order.escrow?.status === EscrowStatus.HELD &&
        !order.completedAt;

      if (!cancellablePreEscrow.includes(order.status) && !isPreStartRefund) {
        throw new AppError(
          "Não é possível cancelar um serviço neste estado atual",
          400
        );
      }

      const cancelText = reason || "Solicitação cancelada";
      const now = new Date();

      const updatedOrder = await tx.serviceOrder.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: ServiceStatus.CANCELLED,
          cancelledReason: cancelText,
          cancelledAt: now,
        },
      });
      if (updatedOrder.count === 0) {
        throw new AppError("O status do serviço foi alterado concorrentemente", 409);
      }

      await tx.proposal.updateMany({
        where: {
          serviceOrderId: orderId,
          status: { in: [ProposalStatus.PENDING, ProposalStatus.ACCEPTED] },
        },
        data: { isAccepted: false, status: ProposalStatus.REJECTED },
      });

      if (isPreStartRefund && order.escrow) {
        const refundableHeldCents = getHeldCustodyCents(order.escrow);
        const refunded = await tx.escrow.updateMany({
          where: { serviceOrderId: orderId, status: EscrowStatus.HELD },
          data: {
            status: EscrowStatus.REFUNDED,
            refundedAmountCents: refundableHeldCents,
            feeAmountCents: 0,
            netAmountCents: 0,
          },
        });
        if (refunded.count === 0) {
          throw new AppError("Não foi possível estornar a custódia", 409);
        }
      } else if (order.escrow && order.escrow.status === EscrowStatus.PENDING) {
        await tx.escrow.updateMany({
          where: { serviceOrderId: orderId, status: EscrowStatus.PENDING },
          data: { status: EscrowStatus.REFUNDED },
        });
      }

      return tx.serviceOrder.findUnique({
        where: { id: orderId },
        include: { escrow: true },
      });
    });
  }
}

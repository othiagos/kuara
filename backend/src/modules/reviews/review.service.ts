import { prisma } from "../../shared/database";
import { AppError } from "../../shared/errors";
import { ServiceStatus } from "@prisma/client";

export interface CreateReviewDTO {
  serviceOrderId: string;
  rating: number; // 1 to 5
  tags?: string[];
  comment?: string;
}

export class ReviewService {
  async createReview(authorId: string, data: CreateReviewDTO) {
    if (data.rating < 1 || data.rating > 5) {
      throw new AppError("A nota deve ser entre 1 e 5 estrelas", 400);
    }

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ServiceOrder" WHERE id = ${data.serviceOrderId} FOR UPDATE`;

      const order = await tx.serviceOrder.findUnique({
        where: { id: data.serviceOrderId },
        include: { acceptedProposal: true, reviews: true },
      });
      if (!order) throw new AppError("Ordem de serviço não encontrada", 404);
      if (order.status !== ServiceStatus.FINISHED) {
        throw new AppError("Apenas serviços concluídos e finalizados podem ser avaliados", 400);
      }

      const isClient = order.clientId === authorId;
      const isProvider = order.acceptedProposal?.providerId === authorId;
      if (!isClient && !isProvider) {
        throw new AppError("Você não participou deste serviço finalizado", 403);
      }

      const alreadyReviewed = order.reviews.some((r) => r.authorId === authorId);
      if (alreadyReviewed) {
        throw new AppError("Você já enviou uma avaliação para este serviço", 409);
      }

      const targetId = isClient ? order.acceptedProposal!.providerId : order.clientId;

      const review = await tx.review.create({
        data: {
          serviceOrderId: data.serviceOrderId,
          authorId,
          targetId,
          rating: data.rating,
          tags: data.tags || [],
          comment: data.comment || null,
        },
        include: { author: { select: { id: true, name: true, role: true } } },
      });

      if (isClient) {
        const profile = await tx.providerProfile.findUnique({
          where: { userId: targetId },
        });

        if (profile) {
          const allReviews = await tx.review.findMany({
            where: { targetId },
            select: { rating: true },
          });

          const realBefore = Math.max(0, allReviews.length - 1);
          const historicalCount = Math.max(0, profile.ratingCount - realBefore);
          const historicalSum = profile.ratingAverage * historicalCount;
          const realSum = allReviews.reduce((acc, r) => acc + r.rating, 0);
          const totalCount = historicalCount + allReviews.length;
          const avg =
            totalCount > 0
              ? Math.round(((historicalSum + realSum) / totalCount) * 10) / 10
              : 0;

          await tx.providerProfile.update({
            where: { userId: targetId },
            data: {
              ratingAverage: avg,
              ratingCount: totalCount,
            },
          });
        }
      }

      return review;
    });
  }

  async listByUser(userId: string) {
    return prisma.review.findMany({
      where: { targetId: userId },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async getUserRatingSummary(userId: string) {
    const [reviews, profile] = await Promise.all([
      this.listByUser(userId),
      prisma.providerProfile.findUnique({
        where: { userId },
        select: { ratingAverage: true, ratingCount: true },
      }),
    ]);

    if (profile) {
      return {
        userId,
        ratingAverage: profile.ratingAverage,
        ratingCount: profile.ratingCount,
        reviews,
      };
    }

    const ratingCount = reviews.length;
    const ratingAverage =
      ratingCount > 0
        ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount) * 10) / 10
        : 0;

    return {
      userId,
      ratingAverage,
      ratingCount,
      reviews,
    };
  }
}

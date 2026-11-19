import { Request, Response } from "express";
import { z } from "zod";
import { ReviewService } from "./review.service";

const reviewService = new ReviewService();

const createReviewSchema = z.object({
  serviceOrderId: z.string().uuid("ID da solicitação inválido"),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().trim()).optional(),
  comment: z.string().trim().max(500).optional(),
});

export class ReviewController {
  async create(req: Request, res: Response): Promise<void> {
    const data = createReviewSchema.parse(req.body);
    const review = await reviewService.createReview(req.user!.id, data);
    res.status(201).json(review);
  }

  async listByUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const reviews = await reviewService.listByUser(userId);
    res.json(reviews);
  }

  async getSummaryByUser(req: Request, res: Response): Promise<void> {
    const { userId } = req.params;
    const summary = await reviewService.getUserRatingSummary(userId);
    res.json(summary);
  }
}

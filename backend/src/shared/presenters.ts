import { EscrowStatus, ProposalStatus, ProviderStatus, Role } from "@prisma/client";

export interface ViewerContext {
  id: string;
  role: Role;
}

export interface RatingSummary {
  ratingAverage: number;
  ratingCount: number;
}

export const SAFE_PROVIDER_PROFILE_SELECT = {
  id: true,
  userId: true,
  bio: true,
  categories: true,
  serviceAreas: true,
  status: true,
  ratingAverage: true,
  ratingCount: true,
  createdAt: true,
} as const;

export function isEscrowSecuredStatus(status?: EscrowStatus | null): boolean {
  return (
    status === EscrowStatus.HELD ||
    status === EscrowStatus.RELEASED ||
    status === EscrowStatus.DISPUTED
  );
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function sanitizeProviderProfile(profile: any) {
  if (!profile) return null;
  return {
    id: profile.id,
    userId: profile.userId,
    bio: profile.bio ?? null,
    categories: profile.categories ?? [],
    serviceAreas: profile.serviceAreas ?? [],
    status: profile.status as ProviderStatus,
    ratingAverage: profile.ratingAverage ?? 0,
    ratingCount: profile.ratingCount ?? 0,
    createdAt: profile.createdAt,
  };
}

export function sanitizeUserForOrder(
  user: any,
  allowContact: boolean,
  rating?: RatingSummary
) {
  if (!user) return null;
  const sanitized: Record<string, any> = {
    id: user.id,
    name: user.name,
  };
  if (user.role) sanitized.role = user.role;
  if (rating) {
    sanitized.ratingAverage = rating.ratingAverage;
    sanitized.ratingCount = rating.ratingCount;
  }
  if (allowContact) {
    if (user.phone !== undefined) sanitized.phone = user.phone;
    if (user.email !== undefined) sanitized.email = user.email;
  }
  if ("providerProfile" in user && user.providerProfile !== undefined) {
    sanitized.providerProfile = sanitizeProviderProfile(user.providerProfile);
  }
  return sanitized;
}

export function sanitizeProposal(
  proposal: any,
  allowProviderContact: boolean,
  acceptedProposalId?: string | null
) {
  if (!proposal) return null;
  const status: ProposalStatus =
    proposal.status ??
    (proposal.isAccepted
      ? ProposalStatus.ACCEPTED
      : acceptedProposalId
      ? ProposalStatus.REJECTED
      : ProposalStatus.PENDING);

  const sanitized: Record<string, any> = {
    id: proposal.id,
    serviceOrderId: proposal.serviceOrderId,
    providerId: proposal.providerId,
    description: proposal.description,
    estimatedDays: proposal.estimatedDays,
    laborCostCents: proposal.laborCostCents,
    materialCostCents: proposal.materialCostCents,
    materialPolicy:
      proposal.materialPolicy ??
      ((proposal.materialCostCents ?? 0) > 0 ? "PROVIDER_ADVANCE" : "CLIENT_SUPPLIES"),
    materialsList: proposal.materialsList ?? null,
    totalCents: proposal.totalCents,
    isAccepted: Boolean(proposal.isAccepted),
    status,
    createdAt: proposal.createdAt,
  };

  if (proposal.provider) {
    sanitized.provider = sanitizeUserForOrder(proposal.provider, allowProviderContact);
  }

  return sanitized;
}

export function sanitizeServiceOrder(
  order: any,
  viewer: ViewerContext,
  clientRating?: RatingSummary
) {
  const isAdmin = viewer.role === Role.ADMIN;
  const isClient = order.clientId === viewer.id;
  const isAcceptedProvider = order.acceptedProposal?.providerId === viewer.id;
  const secured = isEscrowSecuredStatus(order.escrow?.status);

  const canSeeExactAddress = isAdmin || isClient || (isAcceptedProvider && secured);
  const canSeeClientContact = isAdmin || isClient || (isAcceptedProvider && secured);

  const rawProposals: any[] = Array.isArray(order.proposals) ? order.proposals : [];
  const visibleProposals =
    isAdmin || isClient
      ? rawProposals
      : rawProposals.filter((p) => p.providerId === viewer.id);

  const sanitizedProposals = visibleProposals.map((p) => {
    const isThisWinner = p.id === order.acceptedProposalId;
    const allowProviderContact = isAdmin || (isClient && secured && isThisWinner);
    return sanitizeProposal(p, allowProviderContact, order.acceptedProposalId);
  });

  const canSeeAcceptedProposal =
    Boolean(order.acceptedProposal) && (isAdmin || isClient || isAcceptedProvider);
  const canSeeEscrowAndDispute = isAdmin || isClient || isAcceptedProvider;

  const result: Record<string, any> = {
    id: order.id,
    clientId: order.clientId,
    targetProviderId: order.targetProviderId ?? null,
    title: order.title,
    description: order.description,
    category: order.category,
    addressCity: order.addressCity,
    addressState: order.addressState,
    photos: order.photos ?? [],
    status: order.status,
    acceptedProposalId: order.acceptedProposalId ?? null,
    cancelledReason: order.cancelledReason ?? null,
    cancelledAt: order.cancelledAt ?? null,
    completionPhotos: order.completionPhotos ?? [],
    completedAt: order.completedAt ?? null,
    autoReleaseAt: order.autoReleaseAt ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    isEscrowSecured: secured,
    contactUnlocked: Boolean(secured && (isClient || isAcceptedProvider || isAdmin)),
    proposalsCount: order._count?.proposals ?? rawProposals.length,
  };

  if (canSeeExactAddress) {
    result.addressZip = order.addressZip;
    result.addressLine = order.addressLine;
  }

  if (order.client) {
    result.client = sanitizeUserForOrder(order.client, canSeeClientContact, clientRating);
  }

  if (order.proposals !== undefined) {
    result.proposals = sanitizedProposals;
  }

  if (canSeeAcceptedProposal) {
    result.acceptedProposal = sanitizeProposal(
      order.acceptedProposal,
      isAdmin || (isClient && secured),
      order.acceptedProposalId
    );
  }

  if (canSeeEscrowAndDispute) {
    if ("escrow" in order) result.escrow = order.escrow ?? null;
    if ("dispute" in order) result.dispute = order.dispute ?? null;
  }

  if (Array.isArray(order.reviews)) {
    result.reviews = order.reviews;
  }

  return result;
}

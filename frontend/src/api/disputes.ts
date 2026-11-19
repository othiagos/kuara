export type DisputePartyRole = "CLIENT" | "PROVIDER";

export interface DisputePartySummary {
  role: DisputePartyRole;
  label: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface ResolvedDisputeParties {
  openedByRole: DisputePartyRole | null;
  contestedRole: DisputePartyRole | null;
  client: DisputePartySummary;
  provider: DisputePartySummary;
  opener: DisputePartySummary | null;
  contested: DisputePartySummary | null;
}

/**
 * Resolves which party (Contratante vs Contratado) initiated a dispute and which responds,
 * preferring backend `dispute.parties` attribution when present and falling back to `openedById`.
 */
export function resolveDisputeParties(
  dispute: any,
  orderOverride?: any
): ResolvedDisputeParties {
  const order = orderOverride || dispute?.serviceOrder || {};
  const clientUser =
    order?.client ||
    (dispute?.parties?.opener?.role === "CLIENT"
      ? dispute?.parties?.opener?.user
      : dispute?.parties?.contested?.role === "CLIENT"
      ? dispute?.parties?.contested?.user
      : undefined);

  const providerUser =
    order?.acceptedProposal?.provider ||
    (dispute?.parties?.opener?.role === "PROVIDER"
      ? dispute?.parties?.opener?.user
      : dispute?.parties?.contested?.role === "PROVIDER"
      ? dispute?.parties?.contested?.user
      : undefined);

  const client: DisputePartySummary = {
    role: "CLIENT",
    label: "Contratante",
    name: clientUser?.name || "Contratante",
    email: clientUser?.email,
    phone: clientUser?.phone,
  };

  const provider: DisputePartySummary = {
    role: "PROVIDER",
    label: "Contratado",
    name: providerUser?.name || "Contratado",
    email: providerUser?.email,
    phone: providerUser?.phone,
  };

  let openedByRole: DisputePartyRole | null = null;
  const backendRole = dispute?.parties?.openedByRole;
  if (backendRole === "CLIENT" || backendRole === "PROVIDER") {
    openedByRole = backendRole;
  } else if (dispute?.openedById) {
    const clientId = order?.clientId || clientUser?.id;
    const providerId = order?.acceptedProposal?.providerId || providerUser?.id;
    if (clientId && dispute.openedById === clientId) {
      openedByRole = "CLIENT";
    } else if (providerId && dispute.openedById === providerId) {
      openedByRole = "PROVIDER";
    }
  }

  const contestedRole: DisputePartyRole | null =
    openedByRole === "CLIENT" ? "PROVIDER" : openedByRole === "PROVIDER" ? "CLIENT" : null;

  return {
    openedByRole,
    contestedRole,
    client,
    provider,
    opener: openedByRole === "CLIENT" ? client : openedByRole === "PROVIDER" ? provider : null,
    contested:
      contestedRole === "CLIENT" ? client : contestedRole === "PROVIDER" ? provider : null,
  };
}

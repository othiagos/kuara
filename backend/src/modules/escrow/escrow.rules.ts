export interface EscrowSplitBreakdown {
  grossAmountCents: number;
  laborAmountCents: number;
  materialsAmountCents: number;
  materialsReleasedImmediate: boolean;
  feeAmountCents: number;
  netAmountCents: number;
  heldAmountCents: number;
}

export function calculatePlatformFee(grossAmountCents: number, feePercentage: number): number {
  if (grossAmountCents <= 0 || feePercentage < 0) {
    return 0;
  }
  return Math.round((grossAmountCents * feePercentage) / 100);
}

export function calculateNetAmount(grossAmountCents: number, feeAmountCents: number): number {
  return Math.max(0, grossAmountCents - feeAmountCents);
}

export function computeEscrowSplit(
  laborCostCents: number,
  materialCostCents: number,
  feePercentage: number
): EscrowSplitBreakdown {
  const safeLabor = Math.max(0, Math.round(laborCostCents));
  const safeMaterials = Math.max(0, Math.round(materialCostCents));
  const grossAmountCents = safeLabor + safeMaterials;
  const feeAmountCents = calculatePlatformFee(safeLabor, feePercentage);
  const netAmountCents = calculateNetAmount(safeLabor, feeAmountCents);

  return {
    grossAmountCents,
    laborAmountCents: safeLabor,
    materialsAmountCents: safeMaterials,
    materialsReleasedImmediate: safeMaterials > 0,
    feeAmountCents,
    netAmountCents,
    heldAmountCents: safeLabor,
  };
}

export function getHeldCustodyCents(escrow: {
  grossAmountCents: number;
  laborAmountCents?: number | null;
  materialsReleasedAt?: Date | string | null;
}): number {
  if (escrow.materialsReleasedAt) {
    return Math.max(0, escrow.laborAmountCents ?? 0);
  }
  return escrow.grossAmountCents;
}

export function isEligibleForAutoRelease(
  completedAt: Date | null,
  autoReleaseAt: Date | null,
  currentTime: Date = new Date()
): boolean {
  if (!completedAt || !autoReleaseAt) {
    return false;
  }
  return currentTime.getTime() >= autoReleaseAt.getTime();
}

export function computeAutoReleaseDate(completedAt: Date, hours = 72): Date {
  return new Date(completedAt.getTime() + hours * 60 * 60 * 1000);
}

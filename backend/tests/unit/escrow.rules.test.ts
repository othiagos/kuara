import { describe, it, expect } from "vitest";
import {
  calculatePlatformFee,
  calculateNetAmount,
  computeEscrowSplit,
  getHeldCustodyCents,
  isEligibleForAutoRelease,
  computeAutoReleaseDate,
} from "../../src/modules/escrow/escrow.rules";

describe("Escrow Rules (Unit Tests)", () => {
  describe("calculatePlatformFee", () => {
    it("should accurately calculate the 5% platform fee on a standard service", () => {
      const grossAmount = 50000; // R$ 500,00 in cents
      const fee = calculatePlatformFee(grossAmount, 5);
      expect(fee).toBe(2500); // R$ 25,00 in cents
    });

    it("should round fee to nearest cent correctly", () => {
      const grossAmount = 14999; // R$ 149,99
      const fee = calculatePlatformFee(grossAmount, 5);
      // 14999 * 0.05 = 749.95 -> 750 cents
      expect(fee).toBe(750);
    });

    it("should return 0 if gross amount is 0 or negative", () => {
      expect(calculatePlatformFee(0, 5)).toBe(0);
      expect(calculatePlatformFee(-100, 5)).toBe(0);
    });
  });

  describe("calculateNetAmount", () => {
    it("should deduct platform fee from gross amount for provider net payout", () => {
      const grossAmount = 50000;
      const feeAmount = 2500;
      const net = calculateNetAmount(grossAmount, feeAmount);
      expect(net).toBe(47500); // R$ 475,00 in cents
    });

    it("should not allow negative net amount", () => {
      expect(calculateNetAmount(100, 200)).toBe(0);
    });
  });

  describe("Auto-Release 72h Logic", () => {
    it("should compute auto release date exactly 72 hours after completion", () => {
      const completedAt = new Date("2026-11-01T10:00:00.000Z");
      const releaseDate = computeAutoReleaseDate(completedAt, 72);
      const expected = new Date("2026-11-04T10:00:00.000Z");
      expect(releaseDate.toISOString()).toBe(expected.toISOString());
    });

    it("should return false if 72 hours have not yet elapsed", () => {
      const completedAt = new Date("2026-11-01T10:00:00.000Z");
      const autoReleaseAt = computeAutoReleaseDate(completedAt, 72);
      const currentTime = new Date("2026-11-03T10:00:00.000Z"); // 48h later

      const eligible = isEligibleForAutoRelease(completedAt, autoReleaseAt, currentTime);
      expect(eligible).toBe(false);
    });

    it("should return true when 72 hours have elapsed or passed", () => {
      const completedAt = new Date("2026-11-01T10:00:00.000Z");
      const autoReleaseAt = computeAutoReleaseDate(completedAt, 72);
      const currentTime = new Date("2026-11-04T10:00:01.000Z"); // 72h + 1s

      const eligible = isEligibleForAutoRelease(completedAt, autoReleaseAt, currentTime);
      expect(eligible).toBe(true);
    });
  });

  describe("computeEscrowSplit & Materials Separation", () => {
    it("should immediately mark materials for release and retain only labor in escrow with 5% fee on labor", () => {
      const split = computeEscrowSplit(30000, 20000, 5);
      expect(split.grossAmountCents).toBe(50000);
      expect(split.laborAmountCents).toBe(30000);
      expect(split.materialsAmountCents).toBe(20000);
      expect(split.materialsReleasedImmediate).toBe(true);
      expect(split.heldAmountCents).toBe(30000);
      expect(split.feeAmountCents).toBe(1500); // 5% on 30000 labor only
      expect(split.netAmountCents).toBe(28500);

      expect(
        getHeldCustodyCents({
          grossAmountCents: split.grossAmountCents,
          laborAmountCents: split.laborAmountCents,
          materialsReleasedAt: new Date(),
        })
      ).toBe(30000);
    });

    it("should keep full amount held when client supplies materials (0 materials cost)", () => {
      const split = computeEscrowSplit(40000, 0, 5);
      expect(split.grossAmountCents).toBe(40000);
      expect(split.materialsReleasedImmediate).toBe(false);
      expect(split.heldAmountCents).toBe(40000);
      expect(split.feeAmountCents).toBe(2000);
      expect(split.netAmountCents).toBe(38000);
    });
  });
});

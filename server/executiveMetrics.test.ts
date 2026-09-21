import { describe, expect, it } from "vitest";
import { calculateRate, calculateRevenueConcentration } from "../client/src/lib/executiveMetrics";

describe("executive dashboard metrics", () => {
  it("calculates commercial funnel rates safely", () => {
    expect(calculateRate(15, 95)).toBeCloseTo(15.789, 2);
    expect(calculateRate(1, 15)).toBeCloseTo(6.667, 2);
    expect(calculateRate(5, 0)).toBe(0);
  });

  it("identifies revenue concentration in high-ticket closures", () => {
    expect(calculateRevenueConcentration(4750, 20393)).toBeCloseTo(81.1, 0);
    expect(calculateRevenueConcentration(0, 0)).toBe(0);
  });
});

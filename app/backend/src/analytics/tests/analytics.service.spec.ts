import { AnalyticsService } from "../analytics.service";

describe("AnalyticsService", () => {
  const service = new AnalyticsService();

  it("should return dashboard data", async () => {
    const data = await service.getDashboardData("user1");
    expect(data).toHaveProperty("totalVolume");
    expect(data).toHaveProperty("distribution");
  });

  it("should return time series data", async () => {
    const series = await service.getTimeSeriesData("user1", "day");
    expect(Array.isArray(series)).toBe(true);
  });

  it("should export CSV", async () => {
    const csv = await service.exportReport("user1", "csv");
    expect(typeof csv).toBe("string");
  });

  it("should export PDF", async () => {
    const pdf = await service.exportReport("user1", "pdf");
    expect(typeof pdf).toBe("string");
  });
});

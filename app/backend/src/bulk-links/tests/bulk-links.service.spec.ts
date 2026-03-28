import { BulkLinksService } from "../bulk-links.service";

describe("BulkLinksService", () => {
  const service = new BulkLinksService();

  it("should generate multiple links", async () => {
    const payments = [
      { email: "user1@example.com", amount: 100, asset: "USD" },
      { email: "user2@example.com", amount: 200, asset: "BTC" },
    ];
    const links = await service.generateLinks(payments);
    expect(links.length).toBe(2);
    expect(links[0]).toContain("/pay/");
  });

  it("should handle 100+ links efficiently", async () => {
    const payments = Array.from({ length: 120 }, (_, i) => ({
      email: `user${i}@example.com`,
      amount: i + 1,
      asset: "USD",
    }));
    const links = await service.generateLinks(payments);
    expect(links.length).toBe(120);
  });
});

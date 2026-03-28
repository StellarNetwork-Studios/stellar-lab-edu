import { getTotalVolumeUSD, getAssetDistribution, getTimeSeries } from "./analytics.repository";
import { exportToCSV } from "../utils/csv-export";
import { exportToPDF } from "../utils/pdf-export";

export class AnalyticsService {
  async getDashboardData(userId: string) {
    const totalVolume = await getTotalVolumeUSD(userId);
    const distribution = await getAssetDistribution(userId);
    return { totalVolume, distribution };
  }

  async getTimeSeriesData(userId: string, interval: "day" | "week" | "month") {
    return getTimeSeries(userId, interval);
  }

  async exportReport(userId: string, format: "csv" | "pdf") {
    const data = await this.getDashboardData(userId);
    if (format === "csv") return exportToCSV(data);
    if (format === "pdf") return exportToPDF(data);
  }
}

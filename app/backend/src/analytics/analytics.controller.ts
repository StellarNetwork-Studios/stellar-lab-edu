import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get("dashboard")
  async dashboard(@Query("userId") userId: string) {
    return this.service.getDashboardData(userId);
  }

  @Get("time-series")
  async timeSeries(@Query("userId") userId: string, @Query("interval") interval: "day" | "week" | "month") {
    return this.service.getTimeSeriesData(userId, interval);
  }

  @Get("export")
  async export(@Query("userId") userId: string, @Query("format") format: "csv" | "pdf") {
    return this.service.exportReport(userId, format);
  }
}

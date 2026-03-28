import { AppDataSource } from "../data-source";
import { Transaction } from "../entities/transaction.entity";

export const transactionRepo = AppDataSource.getRepository(Transaction);

export async function getTotalVolumeUSD(userId: string) {
  return transactionRepo
    .createQueryBuilder("t")
    .select("SUM(t.amount_usd)", "total")
    .where("t.userId = :userId", { userId })
    .getRawOne();
}

export async function getAssetDistribution(userId: string) {
  return transactionRepo
    .createQueryBuilder("t")
    .select("t.asset, SUM(t.amount_usd)", "total")
    .where("t.userId = :userId", { userId })
    .groupBy("t.asset")
    .getRawMany();
}

export async function getTimeSeries(userId: string, interval: "day" | "week" | "month") {
  return transactionRepo
    .createQueryBuilder("t")
    .select(`DATE_TRUNC('${interval}', t.createdAt)`, "period")
    .addSelect("SUM(t.amount_usd)", "total")
    .where("t.userId = :userId", { userId })
    .groupBy("period")
    .orderBy("period", "ASC")
    .getRawMany();
}

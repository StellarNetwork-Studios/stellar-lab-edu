import { AppDataSource } from "../data-source";
import { PaymentLink } from "../entities/payment-link.entity";

export const paymentLinkRepo = AppDataSource.getRepository(PaymentLink);

export async function saveBulkLinks(links: PaymentLink[]) {
  return paymentLinkRepo.save(links);
}

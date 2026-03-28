import { saveBulkLinks } from "./bulk-links.repository";
import { v4 as uuid } from "uuid";

export class BulkLinksService {
  async generateLinks(payments: Array<{ email: string; amount: number; asset: string }>) {
    const links = payments.map(p => ({
      id: uuid(),
      email: p.email,
      amount: p.amount,
      asset: p.asset,
      url: `${process.env.APP_URL}/pay/${uuid()}`,
      createdAt: new Date(),
    }));

    await saveBulkLinks(links);
    return links.map(l => l.url);
  }
}

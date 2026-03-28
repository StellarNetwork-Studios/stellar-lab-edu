import { Controller, Post, UploadedFile, UseInterceptors, Body } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { BulkLinksService } from "./bulk-links.service";
import { parseCSV } from "../utils/csv-parser";

@Controller("bulk-links")
export class BulkLinksController {
  constructor(private readonly service: BulkLinksService) {}

  @Post("csv")
  @UseInterceptors(FileInterceptor("file"))
  async uploadCSV(@UploadedFile() file: Express.Multer.File) {
    const payments = parseCSV(file.buffer);
    return this.service.generateLinks(payments);
  }

  @Post("json")
  async uploadJSON(@Body() payments: Array<{ email: string; amount: number; asset: string }>) {
    return this.service.generateLinks(payments);
  }
}

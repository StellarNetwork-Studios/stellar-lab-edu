import PDFDocument from "pdfkit";

export function exportToPDF(data: any) {
  const doc = new PDFDocument();
  let buffers: Buffer[] = [];
  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => Buffer.concat(buffers));

  doc.text("Financial Report");
  doc.text(JSON.stringify(data, null, 2));
  doc.end();

  return Buffer.concat(buffers).toString("base64");
}

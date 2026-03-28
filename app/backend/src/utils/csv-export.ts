import { Parser } from "json2csv";

export function exportToCSV(data: any) {
  const parser = new Parser();
  return parser.parse(data);
}

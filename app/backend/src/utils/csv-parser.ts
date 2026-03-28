import * as csv from "csv-parse/sync";

export function parseCSV(buffer: Buffer) {
  return csv.parse(buffer.toString(), {
    columns: true,
    skip_empty_lines: true,
  });
}

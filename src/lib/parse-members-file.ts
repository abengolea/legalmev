import * as XLSX from 'xlsx';

export type MemberRow = { email: string; name: string };

/**
 * Parsea Excel (.xlsx, .xls) o CSV con columnas de email y nombre.
 * Acepta headers: email, mail, correo | nombre, name, apellido
 */
export function parseMembersFile(buffer: Buffer, filename?: string): MemberRow[] {
  const name = (filename || '').toLowerCase();

  if (name.endsWith('.csv')) {
    return parseCsv(buffer);
  }

  return parseExcel(buffer);
}

function parseExcel(buffer: Buffer): MemberRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][];
  return extractRows(data);
}

function parseCsv(buffer: Buffer): MemberRow[] {
  const str = buffer.toString('utf-8');
  const lines = str.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];

  const delimiter = detectDelimiter(lines[0]);
  const data = lines.map((line) => parseCsvLine(line, delimiter));
  return extractRows(data);
}

function detectDelimiter(firstLine: string): string {
  if (firstLine.includes(';')) return ';';
  if (firstLine.includes('\t')) return '\t';
  return ',';
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += c;
    } else if (c === delimiter) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function extractRows(data: string[][]): MemberRow[] {
  if (!data.length) return [];

  const header = data[0].map((h) => String(h || '').toLowerCase().trim());
  const emailIdx = header.findIndex((h) => h.includes('email') || h === 'mail' || h === 'correo');
  const nameIdx = header.findIndex((h) => h.includes('nombre') || h === 'name' || h.includes('apellido'));

  const rows: MemberRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let email = '';
    let name = '';
    if (emailIdx >= 0 && row[emailIdx]) email = String(row[emailIdx]).trim().toLowerCase();
    if (nameIdx >= 0 && row[nameIdx]) name = String(row[nameIdx]).trim();
    if (!email) continue;
    if (!name && emailIdx >= 0) name = email.split('@')[0];
    rows.push({ email, name });
  }
  return rows;
}

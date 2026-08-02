export interface ExportField {
  label: string;
  key: string;
}

export interface ReportExportData {
  title: string;
  description?: string;
  generatedAt: Date | string;
  tenantId: string;
  summary?: Record<string, string | number | boolean | null>;
  headers: ExportField[];
  rows: Record<string, unknown>[];
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return JSON.stringify(val);
}

export class ReportExporter {
  public static exportToCsv(data: ReportExportData): Buffer {
    const lines: string[] = [];

    // Title & Summary Metadata Header
    lines.push(`"# Title: ${this.escapeCsv(data.title)}"`);
    if (data.description) {
      lines.push(`"# Description: ${this.escapeCsv(data.description)}"`);
    }
    lines.push(`"# Generated At: ${new Date(data.generatedAt).toISOString()}"`);
    lines.push(`"# Tenant ID: ${data.tenantId}"`);

    if (data.summary && Object.keys(data.summary).length > 0) {
      lines.push('"# --- Summary ---"');
      for (const [k, v] of Object.entries(data.summary)) {
        lines.push(
          `"# ${this.escapeCsv(k)}: ${this.escapeCsv(v !== null && v !== undefined ? String(v) : "")}"`,
        );
      }
    }
    lines.push("");

    // Table Header
    const headerRow = data.headers.map((h) => this.escapeCsv(h.label)).join(",");
    lines.push(headerRow);

    // Rows
    for (const row of data.rows) {
      const line = data.headers
        .map((h) => {
          const val = row[h.key];
          if (val === null || val === undefined) return '""';
          return this.escapeCsv(formatVal(val));
        })
        .join(",");
      lines.push(line);
    }

    // Add UTF-8 BOM for Excel compatibility
    const csvContent = "\uBFEF" + lines.join("\n");
    return Buffer.from(csvContent, "utf-8");
  }

  public static exportToPdf(data: ReportExportData): Buffer {
    // Generate clean formatted text/layout PDF representation
    const textLines: string[] = [];
    textLines.push(
      `================================================================================`,
    );
    textLines.push(`SUPPORTDESK ENTERPRISE REPORT: ${data.title.toUpperCase()}`);
    textLines.push(
      `================================================================================`,
    );
    textLines.push(`Generated: ${new Date(data.generatedAt).toISOString()}`);
    textLines.push(`Tenant ID: ${data.tenantId}`);
    if (data.description) {
      textLines.push(`Description: ${data.description}`);
    }
    textLines.push(
      `--------------------------------------------------------------------------------`,
    );

    if (data.summary && Object.keys(data.summary).length > 0) {
      textLines.push(`SUMMARY METRICS`);
      textLines.push(
        `--------------------------------------------------------------------------------`,
      );
      for (const [k, v] of Object.entries(data.summary)) {
        textLines.push(`  * ${k}: ${v ?? "N/A"}`);
      }
      textLines.push(
        `--------------------------------------------------------------------------------`,
      );
    }

    textLines.push(``);
    textLines.push(`DETAILED DATA RECORDS (${data.rows.length} rows)`);
    textLines.push(
      `--------------------------------------------------------------------------------`,
    );

    const headersStr = data.headers.map((h) => h.label).join(" | ");
    textLines.push(headersStr);
    textLines.push(`-`.repeat(Math.max(80, headersStr.length)));

    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      if (!row) continue;
      const rowVals = data.headers.map((h) => {
        const val = row[h.key];
        if (val === null || val === undefined) return "-";
        return formatVal(val);
      });
      textLines.push(`${i + 1}. ` + rowVals.join(" | "));
    }

    textLines.push(
      `--------------------------------------------------------------------------------`,
    );
    textLines.push(`END OF REPORT`);

    const pdfText = textLines.join("\n");

    // Construct minimal valid PDF document with text stream
    return this.createSimplePdfBuffer(pdfText);
  }

  public static exportToExcel(data: ReportExportData): Buffer {
    // Excel XML (SpreadsheetML) format for multi-tab/formatted native Excel opening without dependencies
    const xml: string[] = [];
    xml.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    xml.push(`<?mso-application progid="Excel.Sheet"?>`);
    xml.push(`<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"`);
    xml.push(` xmlns:o="urn:schemas-microsoft-com:office:office"`);
    xml.push(` xmlns:x="urn:schemas-microsoft-com:office:excel"`);
    xml.push(` xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"`);
    xml.push(` xmlns:html="http://www.w3.org/TR/REC-html40">`);
    xml.push(` <Styles>`);
    xml.push(`  <Style ss:ID="Default" ss:Name="Normal">`);
    xml.push(`   <Font ss:FontName="Calibri" ss:Size="11"/>`);
    xml.push(`  </Style>`);
    xml.push(`  <Style ss:ID="Header">`);
    xml.push(`   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>`);
    xml.push(`   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>`);
    xml.push(`  </Style>`);
    xml.push(`  <Style ss:ID="Title">`);
    xml.push(`   <Font ss:FontName="Calibri" ss:Size="14" ss:Bold="1" ss:Color="#0F172A"/>`);
    xml.push(`  </Style>`);
    xml.push(` </Styles>`);
    xml.push(` <Worksheet ss:Name="Report Data">`);
    xml.push(`  <Table>`);

    // Title Row
    xml.push(
      `   <Row ss:StyleID="Title"><Cell><Data ss:Type="String">${this.escapeXml(data.title)}</Data></Cell></Row>`,
    );
    xml.push(
      `   <Row><Cell><Data ss:Type="String">Generated: ${new Date(data.generatedAt).toISOString()}</Data></Cell></Row>`,
    );
    xml.push(
      `   <Row><Cell><Data ss:Type="String">Tenant ID: ${data.tenantId}</Data></Cell></Row>`,
    );
    xml.push(`   <Row></Row>`);

    // Summary section if present
    if (data.summary && Object.keys(data.summary).length > 0) {
      xml.push(
        `   <Row ss:StyleID="Header"><Cell><Data ss:Type="String">Metric</Data></Cell><Cell><Data ss:Type="String">Value</Data></Cell></Row>`,
      );
      for (const [k, v] of Object.entries(data.summary)) {
        xml.push(
          `   <Row><Cell><Data ss:Type="String">${this.escapeXml(k)}</Data></Cell><Cell><Data ss:Type="String">${this.escapeXml(v !== null && v !== undefined ? String(v) : "")}</Data></Cell></Row>`,
        );
      }
      xml.push(`   <Row></Row>`);
    }

    // Data Header Row
    xml.push(`   <Row ss:StyleID="Header">`);
    for (const h of data.headers) {
      xml.push(`    <Cell><Data ss:Type="String">${this.escapeXml(h.label)}</Data></Cell>`);
    }
    xml.push(`   </Row>`);

    // Data Rows
    for (const row of data.rows) {
      xml.push(`   <Row>`);
      for (const h of data.headers) {
        const val = row[h.key];
        const valStr = formatVal(val);
        const isNum = typeof val === "number" && !isNaN(val);
        const typeAttr = isNum ? 'ss:Type="Number"' : 'ss:Type="String"';
        xml.push(`    <Cell><Data ${typeAttr}>${this.escapeXml(valStr)}</Data></Cell>`);
      }
      xml.push(`   </Row>`);
    }

    xml.push(`  </Table>`);
    xml.push(` </Worksheet>`);
    xml.push(`</Workbook>`);

    const xmlContent = xml.join("\n");
    return Buffer.from(xmlContent, "utf-8");
  }

  private static escapeCsv(val: string): string {
    const escaped = val.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private static escapeXml(val: string): string {
    return val
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private static createSimplePdfBuffer(textContent: string): Buffer {
    const lines = textContent.split("\n");
    let streamText = "BT /F1 9 Tf 36 750 Td 11 TL\n";
    for (const l of lines.slice(0, 60)) {
      const safeLine = l.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      streamText += `(${safeLine}) '\n`;
    }
    streamText += "ET";

    const streamLen = Buffer.byteLength(streamText, "utf-8");

    const pdfObjects = [
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n`,
      `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n`,
      `5 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream\nendobj\n`,
    ];

    const header = "%PDF-1.4\n";
    let body = "";
    const xrefOffsets = [0];

    for (const obj of pdfObjects) {
      xrefOffsets.push(Buffer.byteLength(header + body, "utf-8"));
      body += obj;
    }

    const xrefStart = Buffer.byteLength(header + body, "utf-8");
    let xref = `xref\n0 ${pdfObjects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= pdfObjects.length; i++) {
      const offset = String(xrefOffsets[i]).padStart(10, "0");
      xref += `${offset} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size ${pdfObjects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

    return Buffer.from(header + body + xref + trailer, "utf-8");
  }
}

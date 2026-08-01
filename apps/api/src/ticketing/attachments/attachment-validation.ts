export const ATTACHMENT_MAX_FILE_SIZE_BYTES = Number(
  process.env.ATTACHMENT_MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024,
);

export const ATTACHMENT_ALLOWED_EXTENSIONS = new Set([
  "csv",
  "doc",
  "docx",
  "gif",
  "jpeg",
  "jpg",
  "pdf",
  "png",
  "txt",
  "xls",
  "xlsx",
  "zip",
]);

export const ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "image/gif",
  "image/jpeg",
  "image/png",
  "text/csv",
  "text/plain",
]);

export function extractExtension(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const parts = base.split(".");
  if (parts.length < 2) {
    return "";
  }
  return (parts.at(-1) ?? "").toLowerCase();
}

export function sanitizeOriginalFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").trim();
  return cleaned.slice(0, 255) || "upload";
}

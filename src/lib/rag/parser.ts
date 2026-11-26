import "server-only";
import mammoth from "mammoth";
import { HttpError } from "@/lib/api";

export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

export async function parseDocument(file: File) {
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) throw new HttpError(413, "Hãy chọn tài liệu nhỏ hơn hoặc bằng 4 MiB.");
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "pdf" && ext !== "docx") throw new HttpError(415, "Chỉ hỗ trợ PDF có văn bản và DOCX.");
  const buffer = Buffer.from(await file.arrayBuffer());
  let content: string;
  try {
    if (ext === "pdf") {
      // Import the parser entry directly to avoid pdf-parse v1's CLI sample-file branch.
      const parse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      content = (await parse(buffer)).text;
    } else {
      content = (await mammoth.extractRawText({ buffer })).value;
    }
  } catch {
    throw new HttpError(422, "Không đọc được tài liệu. Hãy kiểm tra định dạng hoặc mật khẩu của tệp.");
  }
  const words = content.normalize("NFC").replace(/\u0000/g, "").trim().split(/\s+/u).filter(Boolean);
  if (!words.length) throw new HttpError(422, "Tệp không có lớp văn bản. Hãy tải bản PDF có thể chọn chữ hoặc DOCX.");
  if (content.length > 1_000_000) throw new HttpError(413, "Văn bản quá dài. Hãy chia tài liệu thành các phần nhỏ hơn.");
  const text = words.join(" ");
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + 1050);
    if (end < text.length) {
      const wordEnd = text.lastIndexOf(" ", end);
      if (wordEnd > start + 700) end = wordEnd;
    }
    chunks.push(text.slice(start, end).trim());
    if (end === text.length) break;
    start = end - 100;
    const wordStart = text.indexOf(" ", start);
    if (wordStart >= start && wordStart < end) start = wordStart + 1;
  }
  return { chunks, ext };
}

import { z } from "zod";
import { checkDb, HttpError, requireGroup, respond, session } from "@/lib/api";
import { parseDocument, MAX_DOCUMENT_BYTES } from "@/lib/rag/parser";

export const runtime = "nodejs";

export function POST(req: Request) {
  return respond(async () => {
    const ctx = await session("teacher");
    if (Number(req.headers.get("content-length")) > MAX_DOCUMENT_BYTES + 64000) {
      throw new HttpError(413, "Tài liệu vượt quá 4 MiB.");
    }
    const form = await req.formData().catch(() => { throw new HttpError(400, "Biểu mẫu tải tệp không hợp lệ."); });
    const groupId = z.string().uuid().parse(form.get("group_id"));
    await requireGroup(ctx, groupId);
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "Hãy chọn một tài liệu.");
    const title = z.string().trim().min(1).max(255).regex(/^[^\[\]\r\n]+$/u).parse(file.name);
    const { chunks, ext } = await parseDocument(file);
    const key = `${groupId}/${crypto.randomUUID()}.${ext}`;
    const bucket = ctx.db.storage.from("materials");
    const upload = await bucket.upload(key, file, { contentType: ext === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
    if (upload.error) throw new HttpError(502, "Không thể lưu tệp vào kho tài liệu của lớp.");
    const result = await ctx.db.rpc("save_material", { p_group_id: groupId, p_title: title, p_file_url: key, p_file_type: ext, p_chunks: chunks });
    if (result.error) {
      // A transport failure can occur after commit. Only compensate an explicit database rejection.
      if (/^[0-9A-Z]{5}$/.test(result.error.code) && !result.error.code.startsWith("08")) await bucket.remove([key]);
      checkDb(result.error);
    }
    return { id: result.data, chunks: chunks.length };
  });
}

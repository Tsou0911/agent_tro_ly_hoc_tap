import { z } from "zod";
import { checkDb, HttpError, type Session } from "@/lib/api";
import type { Chunk } from "@/lib/rag/retriever";

const sourceAnswer = z.object({
  parts: z.array(z.object({ text: z.string().trim().min(1).max(1400), source_ids: z.array(z.string().uuid()).min(1).max(5) })).min(1).max(4),
});

export const socraticReply = "Bạn thử nêu ý chính hoặc viết câu đầu tiên nhé. Bạn đang vướng ở bước hiểu đề, chọn từ hay sắp xếp ý?";

const directRequests = [
  /(?:viet|lam|giai|tra loi)\s+(?:ho|gium|thay)\b/,
  /(?:cho|gui|dua|lay|xin)\s+(?:toi |minh |em )?(?:dap an|loi giai)/,
  /(?:dap an|loi giai)\s+(?:cua )?(?:cau|bai)\s+(?:nay|\d+).*\bla gi\b/,
  /(?:viet|lam|giai)\s+(?:giup (?:minh |em |toi )?)?(?:mot |ca |toan bo )?(?:bai luan|bai van|bai tap|bai nay|de nay)\b/,
  /(?:write|do|solve|complete)\s+(?:my|this|the whole|the entire|an?)\s+(?:essay|homework|assignment|test|problem)\b/,
  /(?:give|tell|show)\s+(?:me\s+)?(?:the\s+)?(?:correct\s+|direct\s+|final\s+)?answers?\b/,
];

export function requestsFinishedWork(input: string) {
  const normalized = input.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");
  // A request for the method may quote an assignment prompt.
  const request = normalized.replace(/(?:cach|phuong phap|how (?:can|do|should) i|how to)\s+(?:viet|lam|giai|write|do|solve)\b/g, " ");
  return directRequests.some(pattern => pattern.test(request));
}

export async function verifyAnswer(ctx: Session, groupId: string, draft: string, retrieved: Chunk[]) {
  let result;
  try {
    result = sourceAnswer.parse(JSON.parse(draft));
  } catch {
    throw new HttpError(502, "Chưa kiểm chứng được nguồn trích dẫn. Hãy thử diễn đạt lại câu hỏi.");
  }
  const ids = [...new Set(result.parts.flatMap(part => part.source_ids))];
  if (ids.some(id => !retrieved.some(chunk => chunk.id === id)) || result.parts.some(p => /\[\s*(?:nguồn|source)\s*:/iu.test(p.text))) {
    throw new HttpError(422, "Có trích dẫn ngoài các đoạn tài liệu được tìm thấy.");
  }
  const chunks = await ctx.db.from("material_chunks").select("id,material_id,chunk_index,content").eq("group_id", groupId).in("id", ids);
  checkDb(chunks.error);
  const rows = chunks.data ?? [];
  if (rows.length !== ids.length || rows.some(row => row.content !== retrieved.find(c => c.id === row.id)?.content)) {
    throw new HttpError(409, "Tài liệu đã thay đổi. Hãy gửi lại câu hỏi.");
  }
  const materials = await ctx.db.from("materials").select("id,title").eq("group_id", groupId).in("id", [...new Set(rows.map(c => c.material_id))]);
  checkDb(materials.error);
  const refs = new Map(rows.map(c => {
    const title = materials.data?.find(m => m.id === c.material_id)?.title;
    if (!title) throw new HttpError(409, "Không tìm thấy tài liệu của đoạn trích.");
    return [c.id, `[Nguồn: ${title} - Đoạn ${c.chunk_index}]`];
  }));
  return result.parts.map(part => `${part.text} ${[...new Set(part.source_ids)].map(id => refs.get(id)).join(" ")}`).join("\n\n");
}

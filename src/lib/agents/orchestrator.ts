import { HttpError, type Session } from "@/lib/api";
import { complete } from "@/lib/llm/router-client";
import { retrieve } from "@/lib/rag/retriever";
import { requestsFinishedWork, socraticReply, verifyAnswer } from "@/lib/verifier/deterministic";
import { transcriptionPrompt, tutorPrompt } from "./prompts";

type Question = { group_id: string; question: string; image?: string; ocr_text?: string };

export async function tutor(ctx: Session, input: Question) {
  if (requestsFinishedWork(input.question)) return socraticReply;
  let imageText = input.ocr_text ?? "";
  if (input.image) imageText = await complete("VISION", [
    { role: "system", content: transcriptionPrompt },
    { role: "user", content: [{ type: "image_url", image_url: { url: input.image } }] },
  ]);
  const question = [input.question, imageText.slice(0, 5000)].filter(Boolean).join("\n");
  if (requestsFinishedWork(question)) return socraticReply;
  const chunks = await retrieve(ctx, input.group_id, question);
  const insufficient = "Mình chưa tìm thấy đoạn tài liệu đủ phù hợp. Bạn có thể thêm từ khóa trong bài hoặc chuyển câu hỏi cho giáo viên.";
  if (!chunks.length) return insufficient;
  const draft = await complete("SMART", [
    { role: "system", content: tutorPrompt },
    { role: "user", content: JSON.stringify({ question, sources: chunks.map(({ id, content }) => ({ id, content })) }) },
  ], true);
  try {
    const parsed = JSON.parse(draft) as { parts?: unknown };
    if (Array.isArray(parsed?.parts) && parsed.parts.length === 0) return insufficient;
  } catch {
    throw new HttpError(502, "Không đọc được phản hồi của gia sư.");
  }
  return verifyAnswer(ctx, input.group_id, draft, chunks);
}

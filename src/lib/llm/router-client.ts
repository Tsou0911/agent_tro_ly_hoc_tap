import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { HttpError } from "@/lib/api";

type Tier = "FAST" | "SMART" | "VISION";

function modelChain(tier: Tier) {
  const primary = process.env[`MODEL_${tier}`] ?? "";
  const secondary = tier === "SMART" ? process.env.MODEL_FAST ?? "" : "";
  return [...new Set([primary, secondary].flatMap(value => value.split(",")).map(value => value.trim()).filter(Boolean))];
}

export async function complete(tier: Tier, messages: ChatCompletionMessageParam[], json = false) {
  const models = modelChain(tier);
  if (!models.length) {
    if (tier === "VISION") throw new HttpError(422, "Hãy nhận dạng chữ trong ảnh bằng OCR.", "OCR_REQUIRED");
    throw new HttpError(503, "Chưa cấu hình combo model cho 9Router.");
  }
  const client = new OpenAI({
    baseURL: process.env.LLM_BASE_URL || "http://localhost:20128/v1",
    apiKey: process.env.LLM_API_KEY || "local",
    maxRetries: 0,
    timeout: 25000,
  });
  for (const model of models) {
    try {
      const result = await client.chat.completions.create({
        model, messages, temperature: 0.25, max_tokens: 1100,
        ...(json && { response_format: { type: "json_object" as const } }),
      });
      const content = result.choices[0]?.message.content?.trim();
      if (!content) throw new HttpError(502, "Model trả về nội dung rỗng.");
      return content;
    } catch (error) {
      if (error instanceof OpenAI.APIError && (error.status === 429 || error.status === 503)) continue;
      if (error instanceof HttpError) throw error;
      throw new HttpError(502, "Không thể kết nối tới model đã cấu hình trên 9Router.");
    }
  }
  if (tier === "VISION") throw new HttpError(422, "Model ảnh đang hết lượt. Hãy dùng OCR.", "OCR_REQUIRED");
  throw new HttpError(503, "Các model đang bận hoặc đã hết lượt. Vui lòng thử lại sau.");
}

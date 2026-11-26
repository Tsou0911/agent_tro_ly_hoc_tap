import "server-only";
import { checkDb, type Session } from "@/lib/api";

const stopWords = new Set(["của","cho","với","trong","là","và","có","này","như","the","and","what","how","does","can","you","help"]);

export async function retrieve(ctx: Session, groupId: string, query: string) {
  const words = query.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const tokens = [...new Set(words.filter(w => w.length > 1 && !stopWords.has(w)))].slice(0, 24);
  if (!tokens.length) return [];
  const result = await ctx.db.from("material_chunks")
    .select("id,material_id,chunk_index,content").eq("group_id", groupId)
    .textSearch("fts", tokens.join(" | "), { config: "simple" }).limit(40);
  checkDb(result.error);
  const candidates = (result.data ?? []).map(row => {
    const text = row.content.toLowerCase();
    const score = tokens.reduce((sum, term) => sum + Number(text.includes(term)), 0);
    return { ...row, score };
  });
  return candidates.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, 5);
}

export type Chunk = Awaited<ReturnType<typeof retrieve>>[number];

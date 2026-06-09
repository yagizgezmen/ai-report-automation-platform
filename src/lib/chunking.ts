export function chunkText(text: string, size = 1400, overlap = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const sentence = clean.lastIndexOf(". ", end);
      if (sentence > start + size / 2) end = sentence + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(start + 1, end - overlap);
  }
  return chunks;
}

export function rankChunks(query: string, chunks: string[], limit = 5) {
  const terms = new Set(query.toLowerCase().split(/\W+/).filter((term) => term.length > 3));
  return chunks
    .map((content) => ({
      content,
      score: [...terms].reduce((score, term) => score + (content.toLowerCase().includes(term) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.content);
}

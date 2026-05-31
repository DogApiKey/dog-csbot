export interface ChunkOptions {
  /** Maximum tokens per chunk (approximate: 1 token ≈ 4 chars) */
  maxTokens?: number;
  /** Overlap between chunks in tokens */
  overlapTokens?: number;
}

export interface Chunk {
  content: string;
  index: number;
}

/**
 * Recursive character text splitter.
 * Tries to split on paragraph boundaries first, then sentences, then words.
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const maxChars = (options.maxTokens ?? 512) * 4;
  const overlapChars = (options.overlapTokens ?? 64) * 4;

  if (text.length <= maxChars) {
    return [{ content: text, index: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);

    // Try to find a natural break point
    if (end < text.length) {
      const chunk = text.slice(start, end);
      const breakPoint = findBreakPoint(chunk);

      if (breakPoint > 0) {
        end = start + breakPoint;
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({ content, index: index++ });
    }

    // Move start forward, accounting for overlap
    start = end - overlapChars;
    if (start <= chunks[chunks.length - 1]?.content.length + (start - overlapChars)) {
      start = end;
    }
  }

  return chunks;
}

/**
 * Find the best break point in a text chunk.
 * Prefers paragraph breaks > sentence breaks > word breaks.
 */
function findBreakPoint(text: string): number {
  // Try paragraph break (double newline)
  const paragraphBreak = text.lastIndexOf("\n\n");
  if (paragraphBreak > text.length * 0.3) {
    return paragraphBreak;
  }

  // Try sentence break
  const sentenceBreaks = [". ", "! ", "? ", "。", "！", "？"];
  let bestSentence = -1;
  for (const delimiter of sentenceBreaks) {
    const idx = text.lastIndexOf(delimiter);
    if (idx > text.length * 0.3 && idx > bestSentence) {
      bestSentence = idx + delimiter.length;
    }
  }
  if (bestSentence > 0) {
    return bestSentence;
  }

  // Try single newline
  const newlineBreak = text.lastIndexOf("\n");
  if (newlineBreak > text.length * 0.3) {
    return newlineBreak;
  }

  // Try word break (space)
  const wordBreak = text.lastIndexOf(" ");
  if (wordBreak > text.length * 0.3) {
    return wordBreak;
  }

  return -1;
}

/**
 * Chunk a document by sections (Markdown headings or HTML tags).
 * Falls back to recursive character splitting for unstructured content.
 */
export function chunkDocument(text: string, options: ChunkOptions = {}): Chunk[] {
  // Try to split by Markdown headings
  const headingRegex = /^#{1,3}\s+.+$/gm;
  const headings = [...text.matchAll(headingRegex)];

  if (headings.length > 1) {
    const sections: string[] = [];
    for (let i = 0; i < headings.length; i++) {
      const start = headings[i].index!;
      const end = i + 1 < headings.length ? headings[i + 1].index! : text.length;
      sections.push(text.slice(start, end).trim());
    }

    const chunks: Chunk[] = [];
    let index = 0;
    for (const section of sections) {
      if (section.length <= (options.maxTokens ?? 512) * 4) {
        chunks.push({ content: section, index: index++ });
      } else {
        // Section too large, split further
        const subChunks = chunkText(section, options);
        for (const sub of subChunks) {
          chunks.push({ content: sub.content, index: index++ });
        }
      }
    }
    return chunks;
  }

  return chunkText(text, options);
}

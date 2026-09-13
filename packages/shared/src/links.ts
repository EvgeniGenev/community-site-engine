export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

export function splitTrailingPunctuation(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl;
  let trailing = "";

  // Common trailing punctuation that usually belongs to the sentence, not the URL
  const trailingPunctuationRegex = /[.,;:!?'"”’]+$/;

  while (url.length > 0) {
    const punctMatch = url.match(trailingPunctuationRegex);
    if (punctMatch) {
      trailing = punctMatch[0] + trailing;
      url = url.slice(0, -punctMatch[0].length);
      continue;
    }

    // Handle closing parenthesis:
    // If URL ends with ')' and there are not enough opening '(' in the URL to balance it,
    // strip the ')' and add to trailing.
    if (url.endsWith(")")) {
      const openParens = (url.match(/\(/g) || []).length;
      const closeParens = (url.match(/\)/g) || []).length;
      if (closeParens > openParens) {
        trailing = ")" + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }

    break;
  }

  return { url, trailing };
}

export function linkifyHtml(text?: string | null | undefined): string {
  if (!text) return "";

  // Match URLs starting with http:// or https://
  const urlRegex = /https?:\/\/[^\s<>"']+/g;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const rawMatch = match[0];

    // Escape the non-URL text before this match
    result += escapeHtml(text.slice(lastIndex, matchIndex));

    const { url, trailing } = splitTrailingPunctuation(rawMatch);
    if (url) {
      const safeHref = escapeAttribute(url);
      const safeText = escapeHtml(url);
      result += '<a href="' + safeHref + '" target="_blank" rel="noopener noreferrer">' + safeText + '</a>';
    }
    result += escapeHtml(trailing);

    lastIndex = matchIndex + rawMatch.length;
  }

  result += escapeHtml(text.slice(lastIndex));
  return result;
}

/**
 * For markdown / HTML content where <a> tags or markdown links may already exist.
 * Replaces bare http(s) URLs in text outside of <a> tags with clickable <a> links.
 */
export function autolinkMarkdownHtml(html: string): string {
  if (!html) return "";

  // Tokenize by HTML tags: <...>
  // When inside <a ...>...</a>, do NOT autolink.
  const tokenRegex = /(<\/?[a-zA-Z][^>]*>)/g;
  const parts = html.split(tokenRegex);

  let inAnchor = false;
  const output: string[] = [];

  for (const part of parts) {
    if (part.startsWith("<")) {
      const lower = part.toLowerCase();
      if (/^<a[\s>]/.test(lower)) {
        inAnchor = true;
      } else if (lower.startsWith("</a>")) {
        inAnchor = false;
      }
      output.push(part);
    } else {
      if (inAnchor) {
        output.push(part);
      } else {
        // Autolink bare URLs in this text segment
        const urlRegex = /https?:\/\/[^\s<>"']+/g;
        let segResult = "";
        let segLastIdx = 0;
        let m: RegExpExecArray | null;

        while ((m = urlRegex.exec(part)) !== null) {
          segResult += part.slice(segLastIdx, m.index);
          const { url, trailing } = splitTrailingPunctuation(m[0]);
          if (url) {
            const safeHref = url.replaceAll('"', "&quot;");
            segResult += '<a href="' + safeHref + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
          }
          segResult += trailing;
          segLastIdx = m.index + m[0].length;
        }
        segResult += part.slice(segLastIdx);
        output.push(segResult);
      }
    }
  }

  return output.join("");
}

export const DEFAULT_HEADERS: Record<string, string> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'accept-language': 'en-US,en;q=0.9',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};

export class ExtractionError extends Error {
  code: string;
  constructor(message: string, code = 'EXTRACTION_FAILED') {
    super(message);
    this.name = 'ExtractionError';
    this.code = code;
  }
}

export async function fetchHtml(url: string, headers: Record<string, string> = {}): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      headers: { ...DEFAULT_HEADERS, ...headers },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ExtractionError(
        `The server returned ${response.status} for this link. The content may be private or deleted.`,
        `HTTP_${response.status}`,
      );
    }
    return await response.text();
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExtractionError('The request timed out. Please try again.', 'TIMEOUT');
    }
    throw new ExtractionError(
      'Unable to reach the source. Please check your link and try again.',
      'NETWORK_ERROR',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function resolveRedirectTarget(url: string, timeoutMs = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      redirect: 'follow',
      signal: controller.signal,
    });
    return response.url || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractMetaTag(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escaped}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${escaped}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${escaped}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && match[1].length > 0) return htmlDecode(match[1]);
  }
  return null;
}

export function extractJsonLd(html: string): unknown {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!scripts) return null;
  for (const script of scripts) {
    const raw = script.replace(/<script[^>]*>|<\/script>/gi, '').trim();
    if (!raw) continue;
    try {
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  return null;
}

export function jsonUnescape(input: string): string {
  try {
    return input.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  } catch {
    return input;
  }
}

export function htmlDecode(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
}

export function extractScriptJson(html: string, id?: string): unknown | null {
  const pattern = id
    ? new RegExp(`<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, 'i')
    : null;
  const match = pattern ? html.match(pattern) : null;
  const raw = match?.[1]?.trim();
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fall through to inline search
    }
  }
  return null;
}

export function extractInlineJson(html: string, marker: string): unknown | null {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startMatch = html.search(new RegExp(escaped));
  if (startMatch === -1) return null;
  const start = html.indexOf('{', startMatch);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escapedChar = false;
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escapedChar) {
        escapedChar = false;
      } else if (char === '\\') {
        escapedChar = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = html.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export function deepSearch(obj: unknown, keys: string[], depth = 0): unknown {
  if (obj === null || typeof obj !== 'object' || depth > 16) return undefined;
  for (const key of keys) {
    if (typeof obj === 'object' && key in obj) return (obj as Record<string, unknown>)[key];
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = deepSearch(item, keys, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  for (const value of Object.values(obj)) {
    const found = deepSearch(value, keys, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function extractOembedFromHtml(html: string): { title?: string; thumbnail?: string; author?: string } {
  return {
    title: extractMetaTag(html, 'og:title') ?? extractMetaTag(html, 'twitter:title') ?? undefined,
    thumbnail: extractMetaTag(html, 'og:image') ?? extractMetaTag(html, 'twitter:image') ?? undefined,
    author: extractMetaTag(html, 'og:site_name') ?? extractMetaTag(html, 'article:author') ?? undefined,
  };
}

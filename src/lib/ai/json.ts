export function extractJsonBlock(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  throw new Error("Assistant response was not valid JSON.");
}

export function parseJsonText<T>(raw: string): T {
  return JSON.parse(extractJsonBlock(raw)) as T;
}

export function extractStructuredStringField(raw: string, fieldName: string): string | null {
  const match = new RegExp(`"${escapeRegExp(fieldName)}"\\s*:\\s*"`).exec(raw);
  if (!match) return null;

  const startIndex = match.index + match[0].length;
  let encoded = "\"";
  let escaping = false;

  for (let index = startIndex; index < raw.length; index += 1) {
    const character = raw[index];
    if (escaping) {
      encoded += `\\${character}`;
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      continue;
    }
    if (character === '"') {
      try {
        return JSON.parse(`${encoded}"`) as string;
      } catch {
        return decodePartialJsonString(encoded.slice(1));
      }
    }
    encoded += character;
  }

  return decodePartialJsonString(encoded.slice(1));
}

function decodePartialJsonString(value: string) {
  let decoded = "";
  let escaping = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (!escaping) {
      if (character === "\\") {
        escaping = true;
      } else {
        decoded += character;
      }
      continue;
    }

    if (character === "n") decoded += "\n";
    else if (character === "r") decoded += "\r";
    else if (character === "t") decoded += "\t";
    else decoded += character;
    escaping = false;
  }

  return decoded.trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
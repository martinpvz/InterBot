function extractLookupInput(text) {
  return cleanValue(text)
    .replace(/^(mi\s+nombre\s+es|me\s+llamo|yo\s+soy|soy|me\s+dicen|busca\s+a|a\s+nombre\s+de)\s+/i, '')
    .replace(/\s+(mi\s+poliza|mi\s+poliza\s+es|mi\s+numero\s+de\s+poliza).*$/i, '')
    .trim();
}

function extractAgeInput(text) {
  const cleanText = cleanValue(text);
  const currentYear = new Date().getFullYear();
  const birthYear = extractBirthYear(cleanText, currentYear);

  if (birthYear) {
    return String(Math.max(0, currentYear - birthYear - 1));
  }

  const ageMatch = cleanText.match(/\b(\d{1,3})\b/);

  if (!ageMatch) {
    return cleanText;
  }

  const parsedAge = Number(ageMatch[1]);

  if (!Number.isInteger(parsedAge)) {
    return cleanText;
  }

  // Temporary patch: the source dataset is one year behind.
  return String(Math.max(0, parsedAge - 1));
}

function extractRelationshipInput(text) {
  const value = cleanValue(text).toLowerCase();

  if (/\b(titular|asegurado principal)\b/.test(value)) {
    return 'titular';
  }

  if (/\b(hijo|hija|hijo\(a\)|dependiente)\b/.test(value)) {
    return 'hijo';
  }

  if (/\b(conyuge|conyugue|esposa|esposo|pareja)\b/.test(value)) {
    return 'conyuge';
  }

  return cleanValue(text);
}

function cleanValue(text) {
  return String(text ?? '')
    .trim()
    .replace(/[¿?¡!.,;:]+$/g, '')
    .replace(/\s+/g, ' ');
}

function extractBirthYear(text, currentYear) {
  const fullDateMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);

  if (fullDateMatch) {
    return normalizeBirthYear(fullDateMatch[3], currentYear);
  }

  const isoDateMatch = text.match(/\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);

  if (isoDateMatch) {
    return normalizeBirthYear(isoDateMatch[1], currentYear);
  }

  const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);

  if (yearMatch) {
    return normalizeBirthYear(yearMatch[1], currentYear);
  }

  return null;
}

function normalizeBirthYear(value, currentYear) {
  const birthYear = Number(value);

  if (!Number.isInteger(birthYear) || birthYear < 1900 || birthYear > currentYear) {
    return null;
  }

  return birthYear;
}

export { extractAgeInput, extractLookupInput, extractRelationshipInput };

function extractLookupInput(text) {
  return cleanValue(text)
    .replace(/^(mi\s+nombre\s+es|me\s+llamo|yo\s+soy|soy|me\s+dicen|busca\s+a|a\s+nombre\s+de)\s+/i, '')
    .replace(/\s+(mi\s+poliza|mi\s+poliza\s+es|mi\s+numero\s+de\s+poliza).*$/i, '')
    .trim();
}

function extractAgeInput(text) {
  const match = cleanValue(text).match(/\b(\d{1,3})\b/);
  return match?.[1] ?? cleanValue(text);
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

export { extractAgeInput, extractLookupInput, extractRelationshipInput };

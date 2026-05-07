function cleanHtmlEntities(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x1f447;/gi, '')
    .replace(/&#xbe;/g, '3/4')
    .replace(/&#xbd;/g, '1/2')
    .replace(/\r/g, '');
}

function parseServings(text) {
  const match = text.match(/makes\s+(\d+)\s+servings?/i);
  return match ? match[1] : null;
}

function parseIngredientLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^ingredients?$/i.test(trimmed)) return null;
  if (/^directions?$/i.test(trimmed)) return null;
  const numbered = trimmed.match(/^\d+\.\s*(.+)$/);
  if (numbered) return null;

  const spacedSplit = trimmed.match(/^(.+?)\s{2,}(.+)$/);
  if (spacedSplit) {
    return {
      name: spacedSplit[1].trim(),
      quantity: spacedSplit[2].trim()
    };
  }

  const qtyMatch = trimmed.match(/^(.*?)(\d+[\d\s\/.,]*\s*(?:oz|g|kg|lb|cups?|cup|tbsp|tsp|x|cloves?|limes?|minutes?|mins?)\b.*)$/i);
  if (qtyMatch) {
    return {
      name: qtyMatch[1].trim().replace(/[|\-]+$/, '').trim(),
      quantity: qtyMatch[2].trim()
    };
  }

  const pipeParts = trimmed.split('|').map((p) => p.trim()).filter(Boolean);
  if (pipeParts.length >= 2) {
    return { name: pipeParts[0], quantity: pipeParts.slice(1).join(' | ') };
  }

  return { name: trimmed, quantity: '~to taste (estimated)' };
}

export function parseCaptionRecipe(rawCaption) {
  const caption = cleanHtmlEntities(rawCaption || '');
  const lines = caption.split('\n').map((l) => l.trim()).filter(Boolean);
  const lower = lines.map((l) => l.toLowerCase());
  const ingIdx = lower.findIndex((l) => l === 'ingredients');
  const dirIdx = lower.findIndex((l) => l === 'directions');

  const ingredients = [];
  const steps = [];

  if (ingIdx !== -1) {
    const ingEnd = dirIdx > ingIdx ? dirIdx : lines.length;
    for (const line of lines.slice(ingIdx + 1, ingEnd)) {
      const parsed = parseIngredientLine(line);
      if (parsed) ingredients.push(parsed);
    }
  }

  if (dirIdx !== -1) {
    for (const line of lines.slice(dirIdx + 1)) {
      const m = line.match(/^(\d+)\.\s*(.+)$/);
      if (m) {
        steps.push({ stepNumber: Number(m[1]), instruction: m[2].trim() });
      }
    }
  }

  return {
    titleFromCaption: lines[1] || null,
    servings: parseServings(caption),
    ingredients,
    steps,
    hasStructuredRecipe: ingredients.length >= 3 && steps.length >= 2,
    normalizedCaption: caption
  };
}

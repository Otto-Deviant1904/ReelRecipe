function includesAny(text, words) {
  const t = (text || '').toLowerCase();
  return words.some((w) => t.includes(w));
}

export function evaluateConsistency({ caption, ingredients, steps, servings, cookTime }) {
  const issues = [];
  const captionLower = (caption || '').toLowerCase();
  const ingredientNames = ingredients.map((i) => i.name.toLowerCase()).join(' ');
  const stepText = steps.map((s) => s.instruction.toLowerCase()).join(' ');

  const captionChicken = includesAny(captionLower, ['chicken']);
  const modelShrimp = includesAny(ingredientNames + ' ' + stepText, ['shrimp']);
  if (captionChicken && modelShrimp) {
    issues.push('protein_mismatch: caption suggests chicken but extracted recipe references shrimp');
  }

  const captionSlowCooker = includesAny(captionLower, ['slow cooker', 'cook on high', 'cook on low', '3-4 hours', '4-5 hours']);
  const fastCook = /\b\d+\s*min\b/i.test(cookTime || '') || includesAny(stepText, ['saute', '1-2 min', '2-3 min']);
  if (captionSlowCooker && fastCook) {
    issues.push('timing_mismatch: caption indicates slow cooker hours but extracted timings are quick saute style');
  }

  const servingMatch = captionLower.match(/makes\s+(\d+)\s+servings?/i);
  if (servingMatch && servings && servings !== servingMatch[1]) {
    issues.push(`serving_mismatch: caption says ${servingMatch[1]} servings but extracted ${servings}`);
  }

  const contradictionPenalty = Math.min(0.55, issues.length * 0.2);

  return {
    issues,
    contradictionPenalty
  };
}

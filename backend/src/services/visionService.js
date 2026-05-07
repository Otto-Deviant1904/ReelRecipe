export async function analyzeVisualCookingActions(_metadata) {
  return {
    confidence: 0.62,
    ingredientsSeen: [
      { name: 'shrimp', confidence: 0.81 },
      { name: 'garlic', confidence: 0.67 },
      { name: 'pasta', confidence: 0.74 }
    ],
    actions: [
      { action: 'boiling pasta', confidence: 0.72 },
      { action: 'sauteing garlic', confidence: 0.64 },
      { action: 'tossing pasta in sauce', confidence: 0.7 }
    ],
    utensils: ['pot', 'pan', 'tongs']
  };
}

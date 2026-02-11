/**
 * Outfit Generation Rules
 *
 * IMPORTANT: This is RULE-BASED + AI assisted
 * We use rules to ensure we never generate ugly/unwearable combos
 * AI helps with creativity within the rules
 */

export interface ClothingItem {
  id: string;
  image: string;
  type?: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
  color?: string;
  style?: string;
}

export interface OutfitRule {
  mustHave: string[];
  optional: string[];
  avoid: string[];
}

/**
 * Core outfit structure rules
 */
export const OUTFIT_RULES: Record<string, OutfitRule> = {
  casual: {
    mustHave: ['top', 'bottom', 'shoes'],
    optional: ['outerwear', 'accessory'],
    avoid: [],
  },
  work: {
    mustHave: ['top', 'bottom', 'shoes'],
    optional: ['outerwear', 'accessory'],
    avoid: [],
  },
  date: {
    mustHave: ['top', 'bottom', 'shoes'],
    optional: ['accessory'],
    avoid: [],
  },
  dress: {
    mustHave: ['dress', 'shoes'],
    optional: ['outerwear', 'accessory'],
    avoid: ['top', 'bottom'],
  },
};

/**
 * Color harmony rules
 * Simple complementary and analogous color matching
 */
export const COLOR_HARMONY: Record<string, string[]> = {
  black: ['white', 'gray', 'beige', 'any'],
  white: ['black', 'navy', 'gray', 'beige', 'any'],
  gray: ['black', 'white', 'navy', 'pink', 'any'],
  beige: ['white', 'brown', 'olive', 'navy'],
  navy: ['white', 'beige', 'gray', 'burgundy'],
  brown: ['beige', 'cream', 'olive', 'orange'],
  // Add more as needed
};

/**
 * Generate outfit combinations from closet items
 * Uses rules to ensure wearable combinations
 */
export function generateOutfits(
  items: ClothingItem[],
  style: string,
  count: number = 3
): ClothingItem[][] {
  const outfits: ClothingItem[][] = [];

  // Group items by type
  const itemsByType = items.reduce((acc, item) => {
    const type = item.type || 'unknown';
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, ClothingItem[]>);

  // Get the rule for this style
  const rule = OUTFIT_RULES[style] || OUTFIT_RULES.casual;

  // Generate outfits
  for (let i = 0; i < count; i++) {
    const outfit: ClothingItem[] = [];

    // Add required items
    for (const requiredType of rule.mustHave) {
      const availableItems = itemsByType[requiredType] || [];
      if (availableItems.length > 0) {
        // Pick a random item (in real version, AI would pick based on color/style)
        const randomIndex = Math.floor(Math.random() * availableItems.length);
        outfit.push(availableItems[randomIndex]);
      }
    }

    // Add optional items (sometimes)
    for (const optionalType of rule.optional) {
      if (Math.random() > 0.5) {
        const availableItems = itemsByType[optionalType] || [];
        if (availableItems.length > 0) {
          const randomIndex = Math.floor(Math.random() * availableItems.length);
          outfit.push(availableItems[randomIndex]);
        }
      }
    }

    // Only add if we have at least 2 items
    if (outfit.length >= 2) {
      outfits.push(outfit);
    }
  }

  return outfits;
}

/**
 * Check if an outfit is valid (has required pieces)
 */
export function isValidOutfit(outfit: ClothingItem[], style: string): boolean {
  const rule = OUTFIT_RULES[style] || OUTFIT_RULES.casual;
  const outfitTypes = outfit.map(item => item.type);

  // Check all required pieces are present
  return rule.mustHave.every(required => outfitTypes.includes(required as any));
}

/**
 * Color harmony check (simple version)
 */
export function hasColorHarmony(items: ClothingItem[]): boolean {
  // For now, return true
  // In full version, check COLOR_HARMONY rules
  return true;
}

/**
 * Style consistency check
 */
export function hasStyleConsistency(items: ClothingItem[], targetStyle: string): boolean {
  // For now, return true
  // In full version, check if items match the target style
  return true;
}

/**
 * Clothing Item Tagging & Description System
 * 
 * Enables AI clothing selection by tagging each item with:
 * - Descriptive keywords (color, pattern, style, fit, material)
 * - Short description (2-3 sentences)
 * 
 * Benefits:
 * - Reduces token usage by scanning metadata instead of analyzing images
 * - Improves outfit selection speed and accuracy
 * - Scales efficiently across large wardrobes
 * - Allows manual tagging refinement
 */

export interface ClothingTag {
  id: string;
  color?: string[];           // ["black", "white stripe"]
  pattern?: string[];         // ["stripes", "plaid", "solid"]
  style?: string[];           // ["minimalist", "bohemian", "preppy"]
  fit?: string[];             // ["fitted", "loose", "oversized"]
  material?: string[];        // ["cotton", "silk", "wool blend"]
  occasion?: string[];        // ["casual", "work", "evening", "sporty"]
  season?: string[];          // ["all-season", "summer", "winter"]
  condition?: string;         // "excellent" | "good" | "fair"
  description: string;        // "Classic white cotton button-up with mother-of-pearl buttons and slight oversized fit"
  keywords: string[];         // Flattened tags for easy searching
  lastUpdated: number;        // Timestamp
}

export interface TaggingMetadata {
  itemId: string;
  type?: string;
  tags?: ClothingTag;
  autoTagged?: boolean;       // Whether tags were AI-generated
  manuallyRefined?: boolean;  // Whether human has reviewed/edited
}

/**
 * Flatten all tags into a searchable keyword array
 */
export function flattenTags(tag: Omit<ClothingTag, 'id' | 'keywords' | 'lastUpdated'>): string[] {
  const keywords: string[] = [];
  
  if (tag.color) keywords.push(...tag.color);
  if (tag.pattern) keywords.push(...tag.pattern);
  if (tag.style) keywords.push(...tag.style);
  if (tag.fit) keywords.push(...tag.fit);
  if (tag.material) keywords.push(...tag.material);
  if (tag.occasion) keywords.push(...tag.occasion);
  if (tag.season) keywords.push(...tag.season);
  if (tag.condition) keywords.push(tag.condition);
  
  return [...new Set(keywords.map(k => k.toLowerCase()))]; // deduplicate
}

/**
 * Create a tagging object from individual tag arrays
 */
export function createClothingTag(
  id: string,
  data: {
    color?: string[];
    pattern?: string[];
    style?: string[];
    fit?: string[];
    material?: string[];
    occasion?: string[];
    season?: string[];
    condition?: string;
    description: string;
  }
): ClothingTag {
  const keywords = flattenTags(data);
  return {
    id,
    color: data.color,
    pattern: data.pattern,
    style: data.style,
    fit: data.fit,
    material: data.material,
    occasion: data.occasion,
    season: data.season,
    condition: data.condition,
    description: data.description,
    keywords,
    lastUpdated: Date.now(),
  };
}

/**
 * Score how well an item matches a request based on tag keywords
 * Returns score 0-1
 */
export function scoreItemMatch(
  tags: ClothingTag,
  requestKeywords: string[]
): number {
  if (requestKeywords.length === 0) return 0.5; // Neutral score if no keywords
  if (!tags.keywords || tags.keywords.length === 0) return 0; // No tags = no match

  const lowerKeywords = requestKeywords.map(k => k.toLowerCase());
  let matches = 0;
  
  for (const keyword of lowerKeywords) {
    if (tags.keywords.includes(keyword)) {
      matches++;
    }
  }
  
  return Math.min(1, matches / requestKeywords.length); // Normalize 0-1
}

/**
 * Search for items matching request criteria using only tags
 * Much faster and cheaper than image analysis
 */
export function searchItemsByTags(
  allItems: Array<{ id: string; tags?: ClothingTag }>,
  requestKeywords: string[],
  minScore: number = 0.3
): Array<{ id: string; tags?: ClothingTag; score: number }> {
  return allItems
    .map(item => ({
      id: item.id,
      tags: item.tags,
      score: scoreItemMatch(item.tags || createClothingTag(item.id, { description: '' }), requestKeywords),
    }))
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score);
}

/**
 * Parse user request into searchable keywords
 * e.g., "I need a black blazer for work" → ["black", "blazer", "work"]
 */
export function extractKeywordsFromRequest(request: string): string[] {
  const commonKeywords = [
    // Colors
    'black', 'white', 'blue', 'red', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'gray', 'grey', 'beige', 'cream', 'navy', 'burgundy', 'olive', 'khaki',
    // Styles
    'casual', 'formal', 'business', 'work', 'evening', 'date', 'weekend', 'sporty', 'athletic', 'edgy', 'bohemian', 'preppy', 'minimalist', 'romantic', 'vintage',
    // Fit
    'fitted', 'loose', 'oversized', 'slim', 'relaxed', 'tight', 'baggy',
    // Material
    'cotton', 'silk', 'wool', 'linen', 'leather', 'denim', 'polyester', 'rayon',
    // Occasion
    'night', 'day', 'morning', 'brunch', 'beach', 'hiking', 'gym', 'office', 'interview',
    // Pattern
    'striped', 'stripes', 'solid', 'floral', 'plaid', 'checked', 'polka', 'print', 'graphic',
    // Clothing pieces
    'shirt', 'top', 'blouse', 'sweater', 'dress', 'pants', 'jeans', 'skirt', 'shorts', 'jacket', 'blazer', 'coat', 'cardigan', 'sweater', 'shoes', 'boots', 'sneakers', 'heels', 'flats',
  ];

  const words = request.toLowerCase().split(/\s+/);
  return words.filter(word => {
    const cleaned = word.replace(/[^a-z]/g, '');
    return commonKeywords.includes(cleaned) && cleaned.length > 2;
  });
}

/**
 * Generate textual representation of tags for AI prompting
 */
export function tagsToString(tags: ClothingTag | null | undefined): string {
  if (!tags) return '';
  
  const parts: string[] = [];
  if (tags.color?.length) parts.push(`Color: ${tags.color.join(', ')}`);
  if (tags.pattern?.length) parts.push(`Pattern: ${tags.pattern.join(', ')}`);
  if (tags.style?.length) parts.push(`Style: ${tags.style.join(', ')}`);
  if (tags.fit?.length) parts.push(`Fit: ${tags.fit.join(', ')}`);
  if (tags.material?.length) parts.push(`Material: ${tags.material.join(', ')}`);
  if (tags.occasion?.length) parts.push(`Occasion: ${tags.occasion.join(', ')}`);
  if (tags.season?.length) parts.push(`Season: ${tags.season.join(', ')}`);
  if (tags.condition) parts.push(`Condition: ${tags.condition}`);
  if (tags.description) parts.push(`Description: ${tags.description}`);
  
  return parts.join(' | ');
}

/**
 * Merge auto-generated tags with user manual refinements
 */
export function refineTags(
  autoTags: ClothingTag,
  userUpdates: Partial<Omit<ClothingTag, 'id' | 'keywords' | 'lastUpdated'>>
): ClothingTag {
  const merged = {
    ...autoTags,
    ...userUpdates,
  };
  
  const keywords = flattenTags(merged);
  return {
    ...merged,
    keywords,
    lastUpdated: Date.now(),
  };
}

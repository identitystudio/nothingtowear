/**
 * AI Helper Utilities
 *
 * Functions to interact with AI APIs for:
 * - Item detection (GPT-4 Vision / Claude Vision)
 * - Virtual try-on (Fal.ai / Replicate)
 */

export interface DetectedItem {
  type: 'top' | 'bottom' | 'dress' | 'outerwear' | 'shoes' | 'accessory';
  color: string;
  style: string;
  description: string;
}

/**
 * Detect clothing item type using AI vision
 * Uses GPT-4 Vision or Claude Vision
 */
export async function detectClothingItem(imageDataUrl: string): Promise<DetectedItem> {
  try {
    const response = await fetch('/api/detect-item', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageDataUrl }),
    });

    if (!response.ok) {
      throw new Error('Failed to detect item');
    }

    const data = await response.json();
    return data.item;
  } catch (error) {
    console.error('Error detecting item:', error);
    // Return default if detection fails
    return {
      type: 'top',
      color: 'unknown',
      style: 'casual',
      description: 'Clothing item',
    };
  }
}

/**
 * Generate virtual try-on image
 * Uses Replicate IDM-VTON or Fal.ai
 */
export async function generateVirtualTryOn(
  bodyPhoto: string,
  clothingItems: string[]
): Promise<string> {
  try {
    const response = await fetch('/api/generate-outfit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bodyPhoto,
        clothingItem: clothingItems[0], // For now, try one item at a time
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate outfit');
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error('Error generating outfit:', error);
    // Return body photo if generation fails
    return bodyPhoto;
  }
}

/**
 * Batch detect multiple clothing items
 * Optimized for uploading entire closet
 */
export async function detectMultipleItems(
  images: string[]
): Promise<DetectedItem[]> {
  const results = await Promise.all(
    images.map(image => detectClothingItem(image))
  );
  return results;
}

/**
 * Cost estimation for AI operations
 */
export function estimateCost(operations: {
  itemDetections?: number;
  outfitGenerations?: number;
}): number {
  const COST_PER_DETECTION = 0.01; // ~$0.01 per image
  const COST_PER_GENERATION = 0.05; // ~$0.05 per outfit

  const detectionCost = (operations.itemDetections || 0) * COST_PER_DETECTION;
  const generationCost = (operations.outfitGenerations || 0) * COST_PER_GENERATION;

  return detectionCost + generationCost;
}

/**
 * Check if AI API keys are configured
 */
export function hasAIKeysConfigured(): boolean {
  // This would check if environment variables are set
  // For now, return false as a placeholder
  return false;
}

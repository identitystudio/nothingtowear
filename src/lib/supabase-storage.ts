/**
 * Supabase Storage for closet images.
 * Uploads images to Supabase Storage bucket and stores metadata in database.
 */

import { supabase } from "./supabase-client";

const BUCKET_NAME = "closet-images";

/**
 * Convert data URL to File object for upload
 */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Save image to Supabase Storage
 */
export async function saveImageToSupabase(
  id: string,
  dataUrl: string
): Promise<string> {
  try {
    // Convert data URL to file
    const file = dataUrlToFile(dataUrl, `${id}.jpg`);
    const filePath = `${id}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true, // Replace if exists
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error("Error saving image to Supabase:", error);
    throw error;
  }
}

/**
 * Get image URL from Supabase Storage
 */
export async function getImageFromSupabase(id: string): Promise<string | null> {
  try {
    const filePath = `${id}`;

    // Check if file exists
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", {
        search: id,
      });

    if (error || !data || data.length === 0) {
      return null;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error("Error getting image from Supabase:", error);
    return null;
  }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImageFromSupabase(id: string): Promise<void> {
  try {
    const filePath = `${id}`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Error deleting image from Supabase:", error);
    throw error;
  }
}

/**
 * Get all images from Supabase Storage
 */
export async function getAllImagesFromSupabase(): Promise<Map<string, string>> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", {
        limit: 1000,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      throw error;
    }

    const images = new Map<string, string>();

    if (data) {
      for (const file of data) {
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET_NAME).getPublicUrl(file.name);
        // Remove file extension from name to get id
        const id = file.name.replace(/\.(jpg|jpeg|png|webp)$/i, "");
        images.set(id, publicUrl);
      }
    }

    return images;
  } catch (error) {
    console.error("Error getting all images from Supabase:", error);
    return new Map();
  }
}

/**
 * Clear all images from Supabase Storage
 */
export async function clearAllImagesFromSupabase(): Promise<void> {
  try {
    const { data, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list("", {
        limit: 1000,
      });

    if (listError) {
      throw listError;
    }

    if (data && data.length > 0) {
      const filePaths = data.map((file) => file.name);
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) {
        throw deleteError;
      }
    }
  } catch (error) {
    console.error("Error clearing images from Supabase:", error);
    throw error;
  }
}

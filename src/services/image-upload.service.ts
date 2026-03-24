export interface UploadedImage {
  url: string;
  path: string;
  position: number;
}

/**
 * Uploads a single image via the server-side API route (/api/upload).
 * The API route uses the Supabase service_role key to bypass RLS.
 */
export async function uploadProductImage(
  blob: Blob,
  userId: string,
  productId: string,
  index: number,
  fileType: string = 'image/jpeg'
): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append('file', new File([blob], `image_${index}.${fileType.split('/')[1] || 'jpg'}`, { type: fileType }));
  formData.append('userId', userId);
  formData.append('productId', productId);
  formData.append('index', index.toString());

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

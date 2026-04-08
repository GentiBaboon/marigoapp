import { getAuth } from 'firebase/auth';

export interface UploadedImage {
  url: string;
  path: string;
  position: number;
}

/**
 * Uploads a single image via the server-side API route (/api/upload).
 * Sends the current user's Firebase ID token for authentication.
 * The API route verifies the token and uses the Supabase service_role key for the upload.
 */
export async function uploadProductImage(
  blob: Blob,
  userId: string,
  productId: string,
  index: number,
  fileType: string = 'image/jpeg'
): Promise<UploadedImage> {
  // Get the current user's ID token for server-side verification
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to upload images.');
  }
  const idToken = await currentUser.getIdToken();

  const formData = new FormData();
  formData.append('file', new File([blob], `image_${index}.${fileType.split('/')[1] || 'jpg'}`, { type: fileType }));
  formData.append('userId', userId);
  formData.append('productId', productId);
  formData.append('index', index.toString());

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

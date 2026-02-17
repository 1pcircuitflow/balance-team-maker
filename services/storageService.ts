
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

const storage = getStorage();

/**
 * 이미지를 canvas로 리사이징 (800x600, JPEG 80%)
 */
const resizeImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const MAX_W = 800;
      const MAX_H = 600;
      let { width, height } = img;

      // 비율 유지하면서 리사이징
      if (width > MAX_W || height > MAX_H) {
        const ratio = Math.min(MAX_W / width, MAX_H / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * 프로필 사진용 정방형 중앙 크롭 리사이징 (400x400, JPEG 80%)
 */
const resizeProfileImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 400;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

/**
 * 썸네일용 리사이징 (200x150, JPEG 50%)
 */
const resizeThumbnail = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const MAX_W = 200;
      const MAX_H = 150;
      let { width, height } = img;

      if (width > MAX_W || height > MAX_H) {
        const ratio = Math.min(MAX_W / width, MAX_H / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob'));
        },
        'image/jpeg',
        0.5
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
};

const CACHE_METADATA = { contentType: 'image/jpeg', customMetadata: {}, cacheControl: 'public, max-age=31536000' };

/**
 * 장소 사진 업로드 (원본 + 썸네일)
 * - venues/{placeId}/photo.jpg (800x600)
 * - venues/{placeId}/thumb.jpg (200x150)
 */
export const uploadVenuePhoto = async (placeId: string, file: File): Promise<{ photoUrl: string; thumbnailUrl: string }> => {
  const [resized, thumb] = await Promise.all([resizeImage(file), resizeThumbnail(file)]);

  const photoRef = ref(storage, `venues/${placeId}/photo.jpg`);
  const thumbRef = ref(storage, `venues/${placeId}/thumb.jpg`);

  await Promise.all([
    uploadBytes(photoRef, resized, CACHE_METADATA),
    uploadBytes(thumbRef, thumb, CACHE_METADATA),
  ]);

  const [photoUrl, thumbnailUrl] = await Promise.all([
    getDownloadURL(photoRef),
    getDownloadURL(thumbRef),
  ]);

  return { photoUrl, thumbnailUrl };
};

/**
 * 프로필 사진 업로드 (profiles/{userId}/photo.jpg)
 * 기존 사진 덮어쓰기 방식
 */
export const uploadProfilePhoto = async (userId: string, file: File): Promise<string> => {
  const resized = await resizeProfileImage(file);
  const storageRef = ref(storage, `profiles/${userId}/photo.jpg`);
  await uploadBytes(storageRef, resized, CACHE_METADATA);
  return getDownloadURL(storageRef);
};

/**
 * 프로필 사진 삭제 (profiles/{userId}/photo.jpg)
 */
export const deleteProfilePhoto = async (userId: string): Promise<void> => {
  const storageRef = ref(storage, `profiles/${userId}/photo.jpg`);
  try {
    await deleteObject(storageRef);
  } catch (e: any) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
};

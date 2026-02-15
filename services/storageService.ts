
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
 * 장소 사진 업로드 (venues/{placeId}/photo.jpg)
 * 기존 사진 덮어쓰기 방식
 */
export const uploadVenuePhoto = async (placeId: string, file: File): Promise<string> => {
  const resized = await resizeImage(file);
  const storageRef = ref(storage, `venues/${placeId}/photo.jpg`);
  await uploadBytes(storageRef, resized, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
};

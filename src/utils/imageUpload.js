// Utility for uploading images to Firebase Storage with fallback to base64 if upload fails
import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Always use base64 for chat images (no Firebase Storage)
export async function uploadImageOrBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({ url: reader.result, isBase64: true });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

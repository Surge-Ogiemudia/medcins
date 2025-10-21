import { db } from "../firebase";
import { getDocs, collection, query, where } from "firebase/firestore";

export async function validateCoupon(code) {
  if (!code) return null;
  const q = query(collection(db, "coupons"), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

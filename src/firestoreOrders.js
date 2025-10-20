// src/firestoreOrders.js
import { db } from "./firebase"; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export async function addOrder(userId, items) {
  try {
    const docRef = await addDoc(collection(db, "orders"), {
      userId,
      items,
      date: serverTimestamp(), // stores current timestamp
    });
    console.log("✅ Order added with ID:", docRef.id);
  } catch (error) {
    console.error("❌ Error adding order:", error);
  }
}

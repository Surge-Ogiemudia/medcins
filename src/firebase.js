import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA2u0hxxVQufvInffw5PXhImFsmBRJ2YQQ",
  authDomain: "medcins.firebaseapp.com",
  projectId: "medcins",
  storageBucket: "medcins.firebasestorage.app",
  messagingSenderId: "474421452339",
  appId: "1:474421452339:web:22e693522ab3410bea0d46",
  measurementId: "G-V63YY2N057"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };

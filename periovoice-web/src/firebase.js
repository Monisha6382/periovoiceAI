import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCWlStNKoTW3cEyH6j6p7KDOXsK0q9pOfQ",
  authDomain: "periovoiceai.firebaseapp.com",
  projectId: "periovoiceai",
  storageBucket: "periovoiceai.firebasestorage.app",
  messagingSenderId: "579559413174",
  appId: "1:579559413174:web:7d54d18b3e597a7d259d17",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDqJc2zFiWtrFxFn79kEZAasJ0cckjk7Vc",
  authDomain: "dataflowai-a4c21.firebaseapp.com",
  projectId: "dataflowai-a4c21",
  storageBucket: "dataflowai-a4c21.firebasestorage.app",
  messagingSenderId: "428093129609",
  appId: "1:428093129609:web:4a3383ea72ceb5af945758",
  measurementId: "G-9FK3NF3Q3Y",
};

// Prevent re-initializing on hot reloads
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);

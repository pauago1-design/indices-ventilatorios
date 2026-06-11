import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAj4Ld6eHovDWfFmGqckUfNhTaOC8MtxyE",
  authDomain: "indices-ventilatorios.firebaseapp.com",
  projectId: "indices-ventilatorios",
  storageBucket: "indices-ventilatorios.firebasestorage.app",
  messagingSenderId: "613087672619",
  appId: "1:613087672619:web:ce9237db81d173e7342d6e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

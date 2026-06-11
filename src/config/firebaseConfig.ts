import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
// 1. Import the Auth module
import { getAuth } from 'firebase/auth'; 

const firebaseConfig = {
  apiKey: "AIzaSyCUDI_38dkP2UNzgkFhETzFO4-C7H9RG6Y",
  authDomain: "enso-12ab9.firebaseapp.com",
  projectId: "enso-12ab9",
  storageBucket: "enso-12ab9.firebasestorage.app",
  messagingSenderId: "24855192924",
  appId: "1:24855192924:web:7e114c8cf1262d2b2a4d99"
};
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// 2. Initialize and export Auth
export const auth = getAuth(app);


















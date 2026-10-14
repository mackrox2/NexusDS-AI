
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDKQmQD2R85nHWMxPGgZ-jEZjWpE0RASIc",
  authDomain: "nexusds-ai.firebaseapp.com",
  projectId: "nexusds-ai",
  storageBucket: "nexusds-ai.firebasestorage.app",
  messagingSenderId: "856691306588",
  appId: "1:856691306588:web:97e772d942f53d8615b699",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

export default app;

// Firebase app init + Realtime Database handle.
// Web config is not a secret (it identifies the project; DB rules protect data).
// Callers feature-detect via FIREBASE_READY so the app still runs if unconfigured.

import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDbcyRLBdQULeAPI4huDc0Ut-Oe8rHu6Cw",
  authDomain: "bg3-sheet.firebaseapp.com",
  databaseURL: "https://bg3-sheet-default-rtdb.firebaseio.com",
  projectId: "bg3-sheet",
  storageBucket: "bg3-sheet.firebasestorage.app",
  messagingSenderId: "997308430303",
  appId: "1:997308430303:web:ffd6017bf05f63a145f66a",
  measurementId: "G-DB6HK1XYQT",
};

export const FIREBASE_READY = Boolean(firebaseConfig.databaseURL);

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);

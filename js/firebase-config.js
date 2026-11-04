
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { getFunctions } from
  "https://www.gstatic.com/firebasejs/12.0.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_5LbiU2qiGEiEX6wf3uzFQBpQUzDplqQ",
  authDomain: "homesarthee.firebaseapp.com",
  projectId: "homesarthee",
  storageBucket: "homesarthee.firebasestorage.app",
  messagingSenderId: "617989013928",
  appId: "1:617989013928:web:9a23178072ad4d92841d9d",
  measurementId: "G-WB1SNQLRT2"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Firebase Cloud Functions - Mumbai region
export const functions = getFunctions(app, "asia-south1");

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDODXJhnwdRzyAXMppsDO-RtF3SwohSMhQ",
  authDomain: "adv-final-project-5e063.firebaseapp.com",
  projectId: "adv-final-project-5e063",
  storageBucket: "adv-final-project-5e063.firebasestorage.app",
  messagingSenderId: "982829504262",
  appId: "1:982829504262:web:9b1ad994548225a44eb087",
  measurementId: "G-C95ND2G4LL",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, analytics };
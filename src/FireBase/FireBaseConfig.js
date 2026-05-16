import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { Platform } from "react-native";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDODXJhnwdRzyAXMppsDO-RtF3SwohSMhQ",
  authDomain: "adv-final-project-5e063.firebaseapp.com",
  projectId: "adv-final-project-5e063",
  storageBucket: "adv-final-project-5e063.appspot.com",
  messagingSenderId: "982829504262",
  appId: "1:982829504262:web:9b1ad994548225a44eb087",
  measurementId: "G-C95ND2G4LL",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

if (Platform.OS === "web") {
  setPersistence(auth, browserSessionPersistence).catch((err) => {
    console.warn("Failed to set web auth persistence:", err);
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

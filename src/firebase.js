import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC4VwveAxCWdnrcQe593nlMZLdn7uxweOA",
  authDomain: "finbalanza.firebaseapp.com",
  projectId: "finbalanza",
  storageBucket: "finbalanza.firebasestorage.app",
  messagingSenderId: "96348362073",
  appId: "1:96348362073:ios:7ebc4c5860e5e95faa6848",
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export default app;

// Import the functions you need from the SDKs you need
import {initializeApp} from 'firebase/app';
import {getFirestore} from 'firebase/firestore';
import {getAuth} from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBptmLosuoD6k1jQFduYc_eQET3DCjPQFA",
  authDomain: "caseclarity-hij0x.firebaseapp.com",
  projectId: "caseclarity-hij0x",
  storageBucket: "caseclarity-hij0x.appspot.com",
  messagingSenderId: "911388046994",
  appId: "1:911388046994:web:1918aa59a91a004365984b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyB0pTN-F_NI3rRRff8oS3PN4nDkaOayy2Q",
    authDomain: "biometric-attendance-sys-23ee8.firebaseapp.com",
    projectId: "biometric-attendance-sys-23ee8",
    storageBucket: "biometric-attendance-sys-23ee8.firebasestorage.app",
    messagingSenderId: "924607817369",
    appId: "1:924607817369:web:450b64ac7c37213ea7ba08",
    measurementId: "G-4G960JJ3YY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

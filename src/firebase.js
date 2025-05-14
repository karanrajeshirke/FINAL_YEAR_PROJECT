import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import 'firebase/compat/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAKUtaugdOaJuUNlqkjCmRUupOwWihPblU",
    authDomain: "finalyearproject-7f87a.firebaseapp.com",
    projectId: "finalyearproject-7f87a",
    storageBucket: "finalyearproject-7f87a.firebasestorage.app",
    messagingSenderId: "956997671534",
    appId: "1:956997671534:web:a820e0ce5553fdf414647f",
    measurementId: "G-B7F5EKK8M4"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

export { firebase, auth, db};
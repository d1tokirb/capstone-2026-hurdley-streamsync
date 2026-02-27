// StreamSync Firebase Configuration

const firebaseConfig = {
    apiKey: "AIzaSyCAggQKFUT-XjT-WW06rjU5Eh-71M5rPso",
    authDomain: "streamsync-960c6.firebaseapp.com",
    projectId: "streamsync-960c6",
    storageBucket: "streamsync-960c6.firebasestorage.app",
    messagingSenderId: "760882609948",
    appId: "1:760882609948:web:0f30e341daf9c1ca9644d9",
    measurementId: "G-WYRNM1XRSZ"
};

// Initialize Firebase using the Compat SDK
if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    firebase.initializeApp(firebaseConfig);
} else {
    console.warn("⚠️ StreamSync: Firebase is NOT configured. Please update firebase-config.js.");
}

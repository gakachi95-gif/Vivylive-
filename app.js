// VIVYLIVE CORE APP ENGINE
const firebaseConfig = {
  apiKey: "AIzaSyDjcjJf7dIyYLbxYrX5r2oXwpgSUr7gkLA",
  authDomain: "vivylive-62c7d.firebaseapp.com",
  projectId: "vivylive-62c7d",
  storageBucket: "vivylive-62c7d.firebasestorage.app",
  messagingSenderId: "279820446345",
  appId: "1:279820446345:web:a2244177c50f45cb463458"
};


// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const { createApp, ref, onMounted } = Vue;

createApp({
    setup() {
        const view = ref('explore');
        const appLoaded = ref(false);
        const userBalance = ref(0);
        const hosts = ref([
            { id: 1, name: 'Luna 🌙', avatar: 'https://i.pravatar.cc/150?u=1' },
            { id: 2, name: 'Kira 🌟', avatar: 'https://i.pravatar.cc/150?u=2' },
            { id: 3, name: 'Zoe 🦋', avatar: 'https://i.pravatar.cc/150?u=3' },
        ]);
        const coinPackages = ref([
            { amount: 100, price: 1.99 },
            { amount: 1000, price: 14.99 },
            { amount: 5000, price: 59.99 },
        ]);
        const currentUser = ref({ name: 'Guest User', role: 'User', photo: 'https://i.pravatar.cc/150?u=guest' });

        // Splash Screen Logic
        const initApp = () => {
            setTimeout(() => {
                document.getElementById('splash-screen').classList.add('fade-out');
                appLoaded.value = true;
                lucide.create();
            }, 2500);
        };

        // Coin Purchase Logic (Paystack Integration Hook)
        const buyCoins = async (pack) => {
            console.log("Redirecting to Paystack for amount:", pack.price);
            // Implementation of Paystack popup goes here
        };

        // Revenue Split Logic (Backend/Firestore function)
        const processGift = async (giftId, amount) => {
            const hostShare = amount * 0.65;
            const agencyShare = amount * 0.15;
            const platformShare = amount * 0.20;
            
            await db.collection('transactions').add({
                hostShare, agencyShare, platformShare, 
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        };

        onMounted(() => {
            initApp();
        });

        return { 
            view, appLoaded, userBalance, hosts, coinPackages, currentUser, 
            buyCoins 
        };
    }
}).mount('#app');
```

---

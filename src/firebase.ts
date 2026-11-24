import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

const env = import.meta.env;

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const useEmulators = env.VITE_USE_EMULATORS === 'true';

/** The player still works without Firebase (demo songs only); the admin needs it. Spark (free) plan is enough. */
export const firebaseEnabled = Boolean(config.projectId && (config.apiKey || useEmulators));

export interface FirebaseServices {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
}

let services: FirebaseServices | null = null;

export function firebase(): FirebaseServices {
  if (!firebaseEnabled) throw new Error('Firebase is not configured — copy .env.example to .env.local.');
  if (services) return services;

  const app = initializeApp({ ...config, apiKey: config.apiKey || 'emulator-demo-key' });
  const db = getFirestore(app);
  const auth = getAuth(app);
  if (useEmulators) {
    connectFirestoreEmulator(db, '127.0.0.1', 8085);
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  }
  services = { app, db, auth };
  return services;
}

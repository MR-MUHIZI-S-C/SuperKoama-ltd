/* Shared, lazy Firebase loader (modular SDK from Google's CDN). */
import { FIREBASE_CONFIG, CLOUDINARY } from './firebase-config.js';

const CDN = 'https://www.gstatic.com/firebasejs/10.12.2/';
const isPlaceholder = v => !v || /^YOUR_/i.test(String(v));

export const firebaseReady = !isPlaceholder(FIREBASE_CONFIG.apiKey) && !isPlaceholder(FIREBASE_CONFIG.projectId);
export const cloudinaryReady = !isPlaceholder(CLOUDINARY.cloudName) && !isPlaceholder(CLOUDINARY.uploadPreset);

let _core, _auth;

/** Firestore: { app, fs (module), db } */
export function core() {
    if (!firebaseReady) return Promise.reject(new Error('Firebase is not configured'));
    return (_core ||= (async () => {
        const [{ initializeApp }, fs] = await Promise.all([
            import(CDN + 'firebase-app.js'),
            import(CDN + 'firebase-firestore.js')
        ]);
        const app = initializeApp(FIREBASE_CONFIG);
        return { app, fs, db: fs.getFirestore(app) };
    })());
}

/** Authentication (admin only): { a (module), auth } */
export function authMod() {
    return (_auth ||= (async () => {
        const { app } = await core();
        const a = await import(CDN + 'firebase-auth.js');
        return { a, auth: a.getAuth(app) };
    })());
}

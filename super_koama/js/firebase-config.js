/* ============================================================
   SUPER KOAMA - CONNECTION SETTINGS  (edit this file only)
   ------------------------------------------------------------
   1) Firebase: Console > Project settings > Your apps > Web app
      > copy the firebaseConfig values below.
   2) Cloudinary: Dashboard > Cloud name, and
      Settings > Upload > Upload presets > Add preset
      (Signing mode = "Unsigned") > copy the preset name.
   Until these are filled in, the website keeps working with its
   built-in default content and the forms fall back to WhatsApp.
   ============================================================ */
export const FIREBASE_CONFIG = {
     apiKey: "AIzaSyBoHR5jL6YQlwil5V_YobxgxamRj2o0NrI",
  authDomain: "super-koama.firebaseapp.com",
  projectId: "super-koama",
  storageBucket: "super-koama.firebasestorage.app",
  messagingSenderId: "808594725220",
  appId: "1:808594725220:web:a59474cc8fbfd505ed0271"
};

export const CLOUDINARY = {
    cloudName: "dkkdzutbs",
    uploadPreset: "super-koama",
    folder: "super-koama"
};

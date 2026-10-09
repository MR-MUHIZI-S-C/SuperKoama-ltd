# Super Koama Company Limited - Website + Live Admin Panel

Tanzanian supplier of construction and industrial raw materials. Plain HTML/CSS/JS front end,
**Firebase** (Auth + Firestore) for real-time content and **Cloudinary** for images.

- Public site: `index.html` and `super_koama/*.html`
- Admin panel: `admin/index.html` (not linked from the site, `noindex`)

Everything on the site (hero slides, services, products, team, values, highlights, contact details,
About text, social links) is edited in the admin panel and appears on the live site instantly.
Quote and contact forms are saved to the admin **Messages** inbox (WhatsApp is the fallback).

## Setup (about 15 minutes)

### 1. Firebase
1. https://console.firebase.google.com > **Add project**.
2. **Project settings > Your apps > Web (</>)**: register an app, copy the config.
3. Paste the values into `super_koama/js/firebase-config.js` (`FIREBASE_CONFIG`).
4. **Build > Authentication > Sign-in method**: enable **Email/Password**. Under *Users*, **Add user** (your admin email + password).
5. **Build > Firestore Database > Create database** (production mode, region `europe-west` or nearest).
6. Firestore > **Rules**: paste the contents of `firestore.rules` and **Publish**.
7. **Authentication > Settings > Authorized domains**: add the domain where you host the site (e.g. `yourname.github.io`).

### 2. Make yourself admin
1. Open `/admin/` and sign in. You will see "not an administrator yet" with your **User ID** (also under Authentication > Users > User UID).
2. Firestore > **Start collection** `admins` > Document ID = your **User UID** > add any field (e.g. `role` = `owner`) > Save.
3. Reload `/admin/`. Repeat for each extra admin; delete the document to remove one.

### 3. Cloudinary (images)
1. https://cloudinary.com > free account. Copy your **Cloud name** (Dashboard).
2. **Settings > Upload > Upload presets > Add upload preset**: **Signing mode = Unsigned**, folder `super-koama`.
3. Put `cloudName` and `uploadPreset` into `super_koama/js/firebase-config.js` (`CLOUDINARY`).

### 4. First run
Admin > **Dashboard > Import default content** (copies the current website content into Firestore once), then edit anything.

## Notes
- If Firebase is unreachable the site shows its last saved content (browser cache) or the built-in defaults.
- Deleting an image in the Media Library removes it from the library only. Delete the file in Cloudinary to erase it completely (needs a server-side key, so it is not done from the browser).
- Hidden items (unticked "Show on the website") stay in admin but disappear from the site.
- Section headings and button labels are fixed in the HTML; all business content is editable in admin.
- Host as static files anywhere (GitHub Pages, Netlify, cPanel). Keep the folder structure.

Built by Christopher Silas Muhizi (Mr VIBE CODER) for Super Koama Company Limited.

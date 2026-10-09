/* Super Koama - Admin panel (Firebase Auth + Firestore + Cloudinary uploads) */
import { firebaseReady, cloudinaryReady, core, authMod } from '../super_koama/js/firebase.js';
import { CLOUDINARY } from '../super_koama/js/firebase-config.js';
import { DEFAULTS } from '../super_koama/js/defaults.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('#app');
let FB, AU, user = null, unsubs = [], badgeUnsub = null;

function toast(msg, type = '') { const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4500); }
const slugify = s => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const isUrl = v => /^https?:\/\/\S+$/i.test(v);
const fmtDate = ts => { try { return ts && ts.toDate ? ts.toDate().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'just now'; } catch (e) { return ''; } };
const thumb = (u, w = 300) => /res\.cloudinary\.com/.test(u || '') ? u.replace('/upload/', `/upload/c_fill,w_${w},q_auto,f_auto/`) : (/images\.unsplash\.com/.test(u || '') ? u.replace(/([?&])w=\d+/, `$1w=${w}`) : u || '');
const stopSubs = () => { unsubs.forEach(u => { try { u(); } catch (e) { /* noop */ } }); unsubs = []; };
const permHelp = e => (e && e.code === 'permission-denied') ? 'Permission denied. Publish firestore.rules and make sure your user is in the "admins" collection.' : (e && e.message) || 'Something went wrong';

/* ================= CONFIGURATION OF EVERY MANAGED SECTION ================= */
const ICONS = ['shield-halved', 'handshake', 'users', 'scale-balanced', 'chart-line', 'award', 'truck', 'check', 'star', 'hammer', 'industry', 'warehouse', 'helmet-safety', 'certificate', 'clock', 'location-dot'];
const ORDER = { k: 'order', t: 'number', l: 'Order (lower shows first)' };
const ACTIVE = { k: 'active', t: 'bool', l: 'Visibility', cl: 'Show on the website' };
const SECT = {
    hero: { col: 'hero', label: 'Hero Slides', icon: 'fa-images', one: 'slide', img: 'image', title: r => r.alt || 'Slide', sub: () => '',
        fields: [{ k: 'image', t: 'image', l: 'Slide image', req: 1, hint: 'Wide landscape photo, at least 1600px wide.' }, { k: 'alt', t: 'text', l: 'Short description' }, ORDER, ACTIVE] },
    services: { col: 'services', label: 'Services', icon: 'fa-screwdriver-wrench', one: 'service', img: 'image', title: r => r.title, sub: r => r.summary,
        fields: [{ k: 'title', t: 'text', l: 'Service name', req: 1 }, { k: 'slug', t: 'text', l: 'Link name (slug)', hint: 'Leave empty to create automatically. Letters, numbers and dashes only.' }, { k: 'image', t: 'image', l: 'Image', req: 1 },
            { k: 'summary', t: 'textarea', l: 'Short summary (shown on cards)', req: 1, rows: 3 }, { k: 'details', t: 'textarea', l: 'Full description', hint: 'One paragraph per line.', rows: 6 },
            { k: 'features', t: 'textarea', l: 'What is included', hint: 'One item per line.', rows: 6 }, { k: 'buttonLabel', t: 'text', l: 'Button text', ph: 'Request a Quote' }, ORDER, ACTIVE] },
    products: { col: 'products', label: 'Products', icon: 'fa-boxes-stacked', one: 'product', img: 'image', title: r => r.name, sub: r => (r.category === 'industrial' ? 'Industrial Raw Materials' : 'Construction Materials') + (r.swahili ? ' · ' + r.swahili : ''),
        fields: [{ k: 'name', t: 'text', l: 'Product name', req: 1 }, { k: 'swahili', t: 'text', l: 'Swahili name (optional)', ph: 'e.g. Saruji' },
            { k: 'category', t: 'select', l: 'Category', req: 1, options: [{ v: 'construction', l: 'Construction Materials' }, { v: 'industrial', l: 'Industrial Raw Materials' }] }, { k: 'image', t: 'image', l: 'Product image', req: 1 }, ORDER, ACTIVE] },
    team: { col: 'team', label: 'Team', icon: 'fa-user-tie', one: 'team member', img: 'photo', title: r => r.name, sub: r => r.role,
        fields: [{ k: 'name', t: 'text', l: 'Full name', req: 1 }, { k: 'role', t: 'text', l: 'Role / title', req: 1 }, { k: 'photo', t: 'image', l: 'Photo (optional)', hint: 'If empty, initials are shown.' }, ORDER] },
    values: { col: 'values', label: 'Core Values', icon: 'fa-gem', one: 'value', title: r => r.title, sub: r => r.text,
        fields: [{ k: 'title', t: 'text', l: 'Title', req: 1 }, { k: 'text', t: 'textarea', l: 'Description', req: 1, rows: 3 }, { k: 'icon', t: 'select', l: 'Icon', options: ICONS }, ORDER] },
    stats: { col: 'stats', label: 'Homepage Highlights', icon: 'fa-chart-simple', one: 'highlight', title: r => r.value, sub: r => r.label,
        fields: [{ k: 'value', t: 'text', l: 'Number or text', req: 1, hint: 'e.g. 24h, 50+, BRELA. Numbers count up on the website.' }, { k: 'label', t: 'text', l: 'Label', req: 1 }, ORDER] }
};
const SINGLE = {
    settings: { doc: ['settings', 'site'], label: 'Site Settings', icon: 'fa-gear',
        fields: [{ k: 'tagline', t: 'text', l: 'Homepage tagline' }, { k: 'phone', t: 'text', l: 'Phone number', req: 1, ph: '+255 684 400 000' }, { k: 'whatsapp', t: 'text', l: 'WhatsApp number', req: 1, hint: 'Digits only with country code, e.g. 255684400000.', digits: 1 },
            { k: 'email', t: 'email', l: 'Email address', req: 1 }, { k: 'region', t: 'text', l: 'Region / location' }, { k: 'poBox', t: 'text', l: 'P.O. Box' }, { k: 'hours', t: 'textarea', l: 'Working hours', hint: 'One line per row.', rows: 3 },
            { k: 'footerAbout', t: 'textarea', l: 'Footer description', rows: 3 }, { k: 'logo', t: 'image', l: 'Logo (optional)', hint: 'Leave empty to keep the built-in logo.' },
            { k: 'facebook', t: 'url', l: 'Facebook link' }, { k: 'instagram', t: 'url', l: 'Instagram link' }, { k: 'linkedin', t: 'url', l: 'LinkedIn link' }, { k: 'twitter', t: 'url', l: 'X (Twitter) link' }] },
    about: { doc: ['about', 'main'], label: 'About & Home Text', icon: 'fa-file-lines',
        fields: [{ k: 'homeAbout', t: 'textarea', l: 'Homepage welcome text', hint: 'One paragraph per line.', rows: 5 }, { k: 'overview', t: 'textarea', l: 'Company overview (About page)', hint: 'One paragraph per line.', rows: 8 },
            { k: 'mission', t: 'textarea', l: 'Mission', rows: 4 }, { k: 'vision', t: 'textarea', l: 'Vision', rows: 4 }, { k: 'commitment', t: 'textarea', l: 'Commitment to quality', rows: 4 }, { k: 'aboutImage', t: 'image', l: 'About page image' }] }
};

/* ================= FORM BUILDING ================= */
function imageField(f, val) {
    return `<div class="img-field"><div class="img-prev" ${val ? `style="background-image:url('${esc(thumb(val, 240))}')"` : ''}>${val ? '' : '<i class="fas fa-image"></i>'}</div>
    <div class="img-ctl"><input type="url" id="f-${f.k}" name="${f.k}" value="${esc(val)}" placeholder="Paste an image link, or upload / choose below">
    <div class="btns"><button type="button" class="btn sm" data-img="upload"><i class="fas fa-upload"></i> Upload</button><button type="button" class="btn sm ghost" data-img="pick"><i class="fas fa-photo-film"></i> Library</button><button type="button" class="btn sm ghost" data-img="clear">Clear</button></div>
    <div class="bar"><i></i></div></div></div>`;
}
function fieldHTML(f, v) {
    const id = 'f-' + f.k; let val = v ?? (f.t === 'bool' ? true : ''); let inp;
    switch (f.t) {
        case 'textarea': inp = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 4}">${esc(val)}</textarea>`; break;
        case 'number': inp = `<input type="number" id="${id}" name="${f.k}" value="${esc(val)}" step="1">`; break;
        case 'select': { const o = f.options.map(x => typeof x === 'string' ? { v: x, l: x } : x); if (val && !o.some(x => x.v === val)) o.push({ v: val, l: val }); inp = `<select id="${id}" name="${f.k}">${o.map(x => `<option value="${esc(x.v)}"${x.v === val ? ' selected' : ''}>${esc(x.l)}</option>`).join('')}</select>`; break; }
        case 'bool': inp = `<label class="check"><input type="checkbox" id="${id}" name="${f.k}"${val ? ' checked' : ''}> ${esc(f.cl || 'Yes')}</label>`; break;
        case 'image': inp = imageField(f, val); break;
        default: inp = `<input type="${f.t || 'text'}" id="${id}" name="${f.k}" value="${esc(val)}"${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}>`;
    }
    return `<div class="fg" data-k="${f.k}"><label for="${id}">${esc(f.l)}${f.req ? ' *' : ''}</label>${inp}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}<span class="err"></span></div>`;
}
function readForm(form, fields) {
    const d = {};
    for (const f of fields) {
        const el = form.elements[f.k]; if (!el) continue;
        if (f.t === 'bool') d[f.k] = el.checked;
        else if (f.t === 'number') d[f.k] = parseInt(el.value, 10) || 0;
        else { let v = String(el.value).trim(); if (f.digits) v = v.replace(/\D/g, ''); d[f.k] = v; }
    }
    return d;
}
function validate(form, fields, d, rows = [], editId = null) {
    let ok = true;
    $$('.fg', form).forEach(g => g.classList.remove('bad'));
    const bad = (k, m) => { ok = false; const g = $(`.fg[data-k="${k}"]`, form); if (g) { g.classList.add('bad'); $('.err', g).textContent = m; } };
    for (const f of fields) {
        const v = d[f.k]; if (f.t === 'bool' || f.t === 'number') continue;
        if (f.req && !v) { bad(f.k, 'This field is required'); continue; }
        if (v && (f.t === 'image' || f.t === 'url') && !isUrl(v)) bad(f.k, 'Enter a valid link starting with http:// or https://');
        if (v && f.t === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) bad(f.k, 'Enter a valid email address');
        if (v && f.k === 'slug' && !/^[a-z0-9-]+$/.test(v)) bad(f.k, 'Use lowercase letters, numbers and dashes only');
        if (v && f.k === 'slug' && rows.some(r => r.slug === v && r.id !== editId)) bad(f.k, 'Another service already uses this link name');
    }
    const first = $('.fg.bad', form); if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return ok;
}

/* ================= MODAL ================= */
function modal(title, bodyHTML, { onSubmit, submitLabel = 'Save', wide = false, noFooter = false } = {}) {
    const el = document.createElement('div'); el.className = 'mb';
    el.innerHTML = `<div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true"><header><h3>${esc(title)}</h3><button type="button" data-close aria-label="Close">&times;</button></header>
    <form novalidate><div class="bd">${bodyHTML}</div>${noFooter ? '' : `<footer><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn">${esc(submitLabel)}</button></footer>`}</form></div>`;
    document.body.appendChild(el);
    const close = () => { el.remove(); document.removeEventListener('keydown', esc_); };
    const esc_ = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc_);
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) close(); });
    const form = $('form', el);
    form.addEventListener('submit', async e => {
        e.preventDefault(); if (!onSubmit) return;
        const btn = $('button[type=submit]', form); btn.disabled = true;
        try { const r = await onSubmit(form); if (r !== false) close(); } catch (err) { console.error(err); toast(permHelp(err), 'bad'); }
        btn.disabled = false;
    });
    bindImageControls(form);
    return { el, close, form };
}

/* ================= CLOUDINARY UPLOADS ================= */
async function prepareImage(file) {
    if (!/^image\//.test(file.type)) throw new Error(`"${file.name}" is not an image`);
    if (file.size > 15 * 1024 * 1024) throw new Error(`"${file.name}" is larger than 15 MB`);
    if (/gif|svg/.test(file.type)) return file;
    let bmp; try { bmp = await createImageBitmap(file); } catch (e) { return file; }
    const sc = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    if (sc === 1 && file.size < 500 * 1024) return file;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    const ctx = c.getContext('2d'), png = file.type === 'image/png';
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), png ? 'image/png' : 'image/jpeg', 0.85));
}
function cloudPost(blob, name, onp) {
    return new Promise((res, rej) => {
        const x = new XMLHttpRequest(); x.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`);
        x.upload.onprogress = e => e.lengthComputable && onp(e.loaded / e.total);
        x.onload = () => { try { const j = JSON.parse(x.responseText); (x.status < 300 && j.secure_url) ? res(j) : rej(new Error((j.error && j.error.message) || 'Upload failed')); } catch (e) { rej(new Error('Upload failed')); } };
        x.onerror = () => rej(new Error('Network error. Check your internet connection.'));
        const f = new FormData(); f.append('file', blob, name); f.append('upload_preset', CLOUDINARY.uploadPreset); if (CLOUDINARY.folder) f.append('folder', CLOUDINARY.folder);
        x.send(f);
    });
}
/** Upload one image to Cloudinary and register it in the media library. Returns its URL. */
async function uploadImage(file, onp = () => { }) {
    if (!cloudinaryReady) throw new Error('Cloudinary is not connected yet. Fill in cloudName and uploadPreset in super_koama/js/firebase-config.js, or paste an image link instead.');
    const blob = await prepareImage(file), j = await cloudPost(blob, file.name, onp), { fs, db } = FB;
    await fs.addDoc(fs.collection(db, 'media'), { url: j.secure_url, publicId: j.public_id || '', name: file.name, width: j.width || 0, height: j.height || 0, bytes: j.bytes || 0, createdAt: fs.serverTimestamp() });
    return j.secure_url;
}
function pickFiles(multiple) {
    return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = !!multiple; i.onchange = () => res(Array.from(i.files)); i.click(); });
}
function bindImageControls(root) {
    root.addEventListener('click', async e => {
        const b = e.target.closest('[data-img]'); if (!b) return;
        const wrap = b.closest('.img-field'), input = $('input[type=url]', wrap), bar = $('.bar', wrap), fill = $('.bar i', wrap);
        const set = v => { input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); };
        if (b.dataset.img === 'clear') return set('');
        if (b.dataset.img === 'pick') return openPicker(set);
        if (b.dataset.img === 'upload') {
            const [file] = await pickFiles(false); if (!file) return;
            b.disabled = true; bar.style.display = 'block'; fill.style.width = '0';
            try { set(await uploadImage(file, p => fill.style.width = Math.round(p * 100) + '%')); toast('Image uploaded', 'ok'); }
            catch (err) { toast(err.message, 'bad'); }
            b.disabled = false; setTimeout(() => bar.style.display = 'none', 400);
        }
    });
    root.addEventListener('input', e => {
        const inp = e.target; if (inp.type !== 'url') return; const prev = $('.img-prev', inp.closest('.img-field') || document.createElement('i')); if (!prev) return;
        prev.style.backgroundImage = isUrl(inp.value) ? `url('${thumb(inp.value, 240)}')` : ''; prev.innerHTML = isUrl(inp.value) ? '' : '<i class="fas fa-image"></i>';
    });
}
async function openPicker(onPick) {
    const m = modal('Choose from media library', '<div class="pick"><div class="mgrid" id="pg"><p class="empty">Loading&hellip;</p></div></div>', { noFooter: true, wide: true });
    const { fs, db } = FB;
    try {
        const snap = await fs.getDocs(fs.query(fs.collection(db, 'media'), fs.orderBy('createdAt', 'desc'), fs.limit(80)));
        const g = $('#pg', m.el); const rows = snap.docs.map(d => d.data());
        g.innerHTML = rows.length ? rows.map((r, i) => `<div class="mi" data-i="${i}"><div class="im" style="background-image:url('${esc(thumb(r.url, 300))}')"></div><div class="in"><b>${esc(r.name)}</b></div></div>`).join('') : '<p class="empty" style="grid-column:1/-1">No uploads yet. Use Upload on the image field first.</p>';
        g.addEventListener('click', e => { const it = e.target.closest('.mi'); if (it) { onPick(rows[+it.dataset.i].url); m.close(); } });
    } catch (e) { $('#pg', m.el).innerHTML = `<p class="empty" style="grid-column:1/-1">${esc(permHelp(e))}</p>`; }
}

/* ================= GENERIC COLLECTION CRUD VIEW ================= */
function viewCollection(key, main) {
    const S = SECT[key], { fs, db } = FB; let rows = [], seeded = true;
    main.innerHTML = `<div class="vh"><h2><i class="fas ${S.icon}"></i> ${esc(S.label)}</h2><span class="sp"></span><button class="btn" id="add"><i class="fas fa-plus"></i> Add ${esc(S.one)}</button></div><div id="banner"></div><div class="rows" id="list"><p class="empty">Loading&hellip;</p></div>`;
    const list = $('#list', main);
    const draw = () => {
        list.innerHTML = rows.length ? rows.map((r, i) => `<div class="row" data-id="${r.id}"><div class="th" ${S.img && r[S.img] ? `style="background-image:url('${esc(thumb(r[S.img], 200))}')"` : ''}>${S.img && r[S.img] ? '' : `<i class="fas ${S.icon}"></i>`}</div>
        <div class="tx"><b>${esc(S.title(r))}${r.active === false ? '<span class="tag off">Hidden</span>' : ''}</b><span>${esc(S.sub(r))}</span></div>
        <div class="ac"><button class="btn sm ghost" data-a="up" ${i === 0 ? 'disabled' : ''} title="Move up"><i class="fas fa-arrow-up"></i></button><button class="btn sm ghost" data-a="down" ${i === rows.length - 1 ? 'disabled' : ''} title="Move down"><i class="fas fa-arrow-down"></i></button>
        <button class="btn sm ghost" data-a="edit"><i class="fas fa-pen"></i> Edit</button><button class="btn sm danger" data-a="del"><i class="fas fa-trash"></i></button></div></div>`).join('') : `<div class="empty card">Nothing here yet. Click <b>Add ${esc(S.one)}</b> to create the first one.</div>`;
        $('#banner', main).innerHTML = seeded ? '' : '<div class="notice">The website is still showing its built-in default content. Go to the <a href="#/dashboard"><b>Dashboard</b></a> and click <b>Import default content</b> first, so you edit the existing items instead of starting from empty.</div>';
    };
    unsubs.push(fs.onSnapshot(fs.collection(db, S.col), s => { rows = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); draw(); }, e => { list.innerHTML = `<div class="notice err">${esc(permHelp(e))}</div>`; }));
    unsubs.push(fs.onSnapshot(fs.doc(db, 'settings', 'site'), d => { seeded = !!(d.exists() && d.data().seeded); draw(); }, () => { }));

    const form = (rec) => {
        const isNew = !rec, data = rec || { order: rows.length ? Math.max(...rows.map(r => r.order ?? 0)) + 10 : 0, active: true, category: 'construction', icon: 'check' };
        modal(isNew ? `Add ${S.one}` : `Edit ${S.one}`, S.fields.map(f => fieldHTML(f, data[f.k])).join(''), {
            onSubmit: async f => {
                const d = readForm(f, S.fields);
                if (S.fields.some(x => x.k === 'slug') && !d.slug) d.slug = slugify(d.title || '') || ('item-' + Date.now());
                if (!validate(f, S.fields, d, rows, rec && rec.id)) return false;
                d.updatedAt = fs.serverTimestamp();
                if (isNew) await fs.addDoc(fs.collection(db, S.col), d); else await fs.setDoc(fs.doc(db, S.col, rec.id), d, { merge: true });
                toast('Saved. The website has been updated.', 'ok');
            }
        });
    };
    $('#add', main).onclick = () => form(null);
    list.addEventListener('click', async e => {
        const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('.row').dataset.id, i = rows.findIndex(r => r.id === id), rec = rows[i];
        if (b.dataset.a === 'edit') return form(rec);
        if (b.dataset.a === 'del') { if (!confirm(`Delete "${S.title(rec)}"? This removes it from the website immediately and cannot be undone.`)) return; try { await fs.deleteDoc(fs.doc(db, S.col, id)); toast('Deleted', 'ok'); } catch (err) { toast(permHelp(err), 'bad'); } return; }
        const j = i + (b.dataset.a === 'up' ? -1 : 1); if (j < 0 || j >= rows.length) return;
        const a = rows.slice(); [a[i], a[j]] = [a[j], a[i]]; const batch = fs.writeBatch(db);
        a.forEach((r, n) => { if (r.order !== n * 10) batch.update(fs.doc(db, S.col, r.id), { order: n * 10 }); });
        try { await batch.commit(); } catch (err) { toast(permHelp(err), 'bad'); }
    });
}

/* ================= SINGLE DOCUMENT FORMS (settings, about) ================= */
async function viewSingle(key, main) {
    const S = SINGLE[key], { fs, db } = FB, ref = fs.doc(db, ...S.doc);
    main.innerHTML = `<div class="vh"><h2><i class="fas ${S.icon}"></i> ${esc(S.label)}</h2></div><div class="card"><p class="empty">Loading&hellip;</p></div>`;
    let data = {};
    try { const s = await fs.getDoc(ref); data = s.exists() ? s.data() : (DEFAULTS[key] ? { ...DEFAULTS[key], seeded: undefined } : {}); } catch (e) { $('.card', main).innerHTML = `<div class="notice err">${esc(permHelp(e))}</div>`; return; }
    $('.card', main).innerHTML = `<form novalidate>${S.fields.map(f => fieldHTML(f, data[f.k])).join('')}<button class="btn" type="submit"><i class="fas fa-floppy-disk"></i> Save changes</button></form>`;
    const form = $('form', main); bindImageControls(form);
    form.addEventListener('submit', async e => {
        e.preventDefault(); const d = readForm(form, S.fields); if (!validate(form, S.fields, d)) return;
        const btn = $('button[type=submit]', form); btn.disabled = true; d.updatedAt = fs.serverTimestamp();
        try { await fs.setDoc(ref, d, { merge: true }); toast('Saved. The website has been updated.', 'ok'); } catch (err) { toast(permHelp(err), 'bad'); }
        btn.disabled = false;
    });
}

/* ================= MESSAGES (quote + contact inbox) ================= */
const waPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '255' + d.slice(1); return d; };
function viewMessages(main) {
    const { fs, db } = FB; let rows = [], tab = 'all';
    main.innerHTML = `<div class="vh"><h2><i class="fas fa-inbox"></i> Messages & Quote Requests</h2></div><div class="tabs" id="tabs"></div><div id="ml"><p class="empty">Loading&hellip;</p></div>`;
    const draw = () => {
        const cnt = s => rows.filter(r => s === 'all' || (r.status || 'new') === s).length;
        $('#tabs', main).innerHTML = [['all', 'All'], ['new', 'New'], ['contacted', 'Contacted'], ['closed', 'Closed']].map(([k, l]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${l} (${cnt(k)})</button>`).join('');
        const show = rows.filter(r => tab === 'all' || (r.status || 'new') === tab);
        $('#ml', main).innerHTML = show.length ? show.map(r => {
            const st = r.status || 'new', det = [['Phone', r.phone], ['Email', r.email], ['Company', r.company], ['Service', r.service], ['Location', r.location], ['Budget', r.budget], ['Timeline', r.timeline], ['Subject', r.subject]].filter(x => x[1]);
            return `<div class="msg ${st === 'new' ? 'isnew' : ''}" data-id="${r.id}"><h4>${esc(r.name)} <span class="tag">${r.type === 'quote' ? 'Quote request' : 'Contact message'}</span><span class="tag ${st === 'new' ? 'new' : st === 'closed' ? 'ok' : ''}">${st}</span></h4><div class="meta">${esc(fmtDate(r.createdAt))}</div>
            <dl>${det.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl><div class="body">${esc(r.message)}</div>
            <div class="ac" style="display:flex;gap:8px;flex-wrap:wrap">${r.phone ? `<a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/${waPhone(r.phone)}"><i class="fab fa-whatsapp"></i> WhatsApp</a><a class="btn sm ghost" href="tel:${esc(String(r.phone).replace(/[^\d+]/g, ''))}"><i class="fas fa-phone"></i> Call</a>` : ''}${r.email ? `<a class="btn sm ghost" href="mailto:${esc(r.email)}"><i class="fas fa-envelope"></i> Email</a>` : ''}
            ${st !== 'contacted' ? '<button class="btn sm ghost" data-s="contacted">Mark contacted</button>' : ''}${st !== 'closed' ? '<button class="btn sm ghost" data-s="closed">Close</button>' : ''}${st !== 'new' ? '<button class="btn sm ghost" data-s="new">Mark new</button>' : ''}<button class="btn sm danger" data-s="del"><i class="fas fa-trash"></i></button></div></div>`;
        }).join('') : '<div class="empty card">No messages here.</div>';
    };
    unsubs.push(fs.onSnapshot(fs.query(fs.collection(db, 'messages'), fs.orderBy('createdAt', 'desc'), fs.limit(200)), s => { rows = s.docs.map(d => ({ id: d.id, ...d.data() })); draw(); }, e => { $('#ml', main).innerHTML = `<div class="notice err">${esc(permHelp(e))}</div>`; }));
    main.addEventListener('click', async e => {
        const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; return draw(); }
        const b = e.target.closest('[data-s]'); if (!b) return; const id = b.closest('.msg').dataset.id;
        try { if (b.dataset.s === 'del') { if (confirm('Delete this message permanently?')) await fs.deleteDoc(fs.doc(db, 'messages', id)); } else await fs.updateDoc(fs.doc(db, 'messages', id), { status: b.dataset.s }); } catch (err) { toast(permHelp(err), 'bad'); }
    });
}

/* ================= MEDIA LIBRARY ================= */
function viewMedia(main) {
    const { fs, db } = FB; let rows = [];
    main.innerHTML = `<div class="vh"><h2><i class="fas fa-photo-film"></i> Media Library</h2><span class="sp"></span><button class="btn" id="up"><i class="fas fa-upload"></i> Upload images</button></div>
    ${cloudinaryReady ? '' : '<div class="notice">Cloudinary is not connected yet. Add your <b>cloudName</b> and <b>uploadPreset</b> in <code>super_koama/js/firebase-config.js</code> to enable uploads.</div>'}<div id="prog"></div><div class="mgrid" id="mg"><p class="empty">Loading&hellip;</p></div>`;
    const draw = () => { $('#mg', main).innerHTML = rows.length ? rows.map(r => `<div class="mi" data-id="${r.id}"><div class="im" style="background-image:url('${esc(thumb(r.url, 300))}')"></div><div class="in"><b title="${esc(r.name)}">${esc(r.name)}</b>${r.width ? r.width + '×' + r.height : ''}</div><div class="bt"><button class="btn sm ghost" data-c="copy">Copy link</button><button class="btn sm danger" data-c="del"><i class="fas fa-trash"></i></button></div></div>`).join('') : '<p class="empty" style="grid-column:1/-1">No images uploaded yet.</p>'; };
    unsubs.push(fs.onSnapshot(fs.query(fs.collection(db, 'media'), fs.orderBy('createdAt', 'desc'), fs.limit(200)), s => { rows = s.docs.map(d => ({ id: d.id, ...d.data() })); draw(); }, e => { $('#mg', main).innerHTML = `<div class="notice err" style="grid-column:1/-1">${esc(permHelp(e))}</div>`; }));
    $('#up', main).onclick = async () => {
        const files = await pickFiles(true); if (!files.length) return;
        for (const f of files) {
            const p = document.createElement('div'); p.className = 'notice'; p.textContent = `Uploading ${f.name}…`; $('#prog', main).appendChild(p);
            try { await uploadImage(f, x => p.textContent = `Uploading ${f.name}… ${Math.round(x * 100)}%`); p.className = 'notice ok'; p.textContent = `${f.name} uploaded`; } catch (err) { p.className = 'notice err'; p.textContent = `${f.name}: ${err.message}`; }
            setTimeout(() => p.remove(), 6000);
        }
    };
    $('#mg', main).addEventListener('click', async e => {
        const b = e.target.closest('[data-c]'); if (!b) return; const id = b.closest('.mi').dataset.id, r = rows.find(x => x.id === id);
        if (b.dataset.c === 'copy') { try { await navigator.clipboard.writeText(r.url); toast('Link copied', 'ok'); } catch (err) { prompt('Copy this link:', r.url); } return; }
        if (!confirm('Remove this image from the library?\nPages already using it keep showing it. To erase the file completely, also delete it in your Cloudinary dashboard.')) return;
        try { await fs.deleteDoc(fs.doc(db, 'media', id)); toast('Removed from library', 'ok'); } catch (err) { toast(permHelp(err), 'bad'); }
    });
}

/* ================= DASHBOARD + IMPORT DEFAULTS ================= */
async function importDefaults() {
    const { fs, db } = FB; const done = [];
    for (const [key, S] of Object.entries(SECT)) {
        const snap = await fs.getDocs(fs.collection(db, S.col));
        if (!snap.empty) continue;
        const batch = fs.writeBatch(db);
        DEFAULTS[key].forEach(item => batch.set(fs.doc(fs.collection(db, S.col)), { ...item, updatedAt: fs.serverTimestamp() }));
        await batch.commit(); done.push(S.label);
    }
    const aRef = fs.doc(db, 'about', 'main'), aSnap = await fs.getDoc(aRef);
    await fs.setDoc(aRef, { ...DEFAULTS.about, ...(aSnap.exists() ? aSnap.data() : {}), updatedAt: fs.serverTimestamp() });
    const sRef = fs.doc(db, 'settings', 'site'), sSnap = await fs.getDoc(sRef);   /* last: flips the website into "managed" mode */
    await fs.setDoc(sRef, { ...DEFAULTS.settings, ...(sSnap.exists() ? sSnap.data() : {}), seeded: true, updatedAt: fs.serverTimestamp() });
    return done;
}
async function viewDashboard(main) {
    const { fs, db } = FB;
    main.innerHTML = '<div class="vh"><h2><i class="fas fa-gauge"></i> Dashboard</h2><span class="sp"></span><a class="btn ghost" href="../index.html" target="_blank" rel="noopener"><i class="fas fa-up-right-from-square"></i> View website</a></div><div id="dash"><p class="empty">Loading&hellip;</p></div>';
    try {
        const counts = {}; for (const [k, S] of Object.entries(SECT)) counts[k] = (await fs.getDocs(fs.collection(db, S.col))).size;
        const msgs = await fs.getDocs(fs.collection(db, 'messages')), newCount = msgs.docs.filter(d => (d.data().status || 'new') === 'new').length;
        const set = await fs.getDoc(fs.doc(db, 'settings', 'site')), seeded = !!(set.exists() && set.data().seeded);
        $('#dash', main).innerHTML = `${seeded ? '' : '<div class="notice"><b>First step:</b> import the website\'s current content so you can edit it here. <button class="btn sm" id="imp" style="margin-left:10px">Import default content</button></div>'}
        <div class="grid4"><a class="stat" href="#/messages"><b>${newCount}</b><span>New messages</span></a>${Object.entries(SECT).map(([k, S]) => `<a class="stat" href="#/${k}"><b>${counts[k]}</b><span>${esc(S.label)}</span></a>`).join('')}</div>
        <div class="card"><h3 style="margin-bottom:10px">System status</h3><ul class="checks"><li><i class="fas fa-circle-check y"></i> Firebase connected: login and database are working</li>
        <li><i class="fas ${cloudinaryReady ? 'fa-circle-check y' : 'fa-circle-xmark n'}"></i> Cloudinary image uploads ${cloudinaryReady ? 'connected' : 'not connected yet (add cloudName and uploadPreset in firebase-config.js)'}</li>
        <li><i class="fas ${seeded ? 'fa-circle-check y' : 'fa-circle-xmark n'}"></i> Website content ${seeded ? 'is managed from this admin panel' : 'not imported yet'}</li></ul></div>`;
        const imp = $('#imp', main);
        if (imp) imp.onclick = async () => { imp.disabled = true; imp.textContent = 'Importing…'; try { await importDefaults(); toast('Default content imported', 'ok'); viewDashboard(main); } catch (e) { toast(permHelp(e), 'bad'); imp.disabled = false; imp.textContent = 'Import default content'; } };
    } catch (e) { $('#dash', main).innerHTML = `<div class="notice err">${esc(permHelp(e))}</div>`; }
}

/* ================= SHELL, ROUTER, AUTH ================= */
const NAV = [['dashboard', 'Dashboard', 'fa-gauge'], ['messages', 'Messages', 'fa-inbox', 1], ['sep', 'Website content'], ['settings', 'Site Settings', 'fa-gear'], ['about', 'About & Home Text', 'fa-file-lines'],
    ...Object.entries(SECT).map(([k, S]) => [k, S.label, S.icon]), ['sep', 'Files'], ['media', 'Media Library', 'fa-photo-film']];
function shell() {
    app.innerHTML = `<div class="shell"><aside class="side" id="side"><div class="brand">SUPER <span>KOAMA</span> ADMIN</div>${NAV.map(n => n[0] === 'sep' ? `<div class="sep">${n[1]}</div>` : `<a href="#/${n[0]}" data-r="${n[0]}"><i class="fas ${n[2]}"></i> ${n[1]}${n[3] ? '<span class="badge" id="nb" hidden>0</span>' : ''}</a>`).join('')}
    <a href="../index.html" target="_blank" rel="noopener" style="margin-top:14px"><i class="fas fa-up-right-from-square"></i> View website</a></aside>
    <div class="main"><div class="top"><button class="burger" id="bg" aria-label="Menu"><i class="fas fa-bars"></i></button><span class="who">${esc(user.email)}</span><button class="btn sm ghost" id="out"><i class="fas fa-right-from-bracket"></i> Sign out</button></div><div class="view" id="view"></div></div></div>`;
    $('#bg').onclick = () => $('#side').classList.toggle('open');
    $('#out').onclick = () => AU.a.signOut(AU.auth);
    $('#side').addEventListener('click', e => { if (e.target.closest('a[data-r]')) $('#side').classList.remove('open'); });
}
function route() {
    if (!user || !$('#view')) return; stopSubs();
    const key = (location.hash.replace(/^#\/?/, '') || 'dashboard'), main = $('#view');
    $$('#side a[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === key));
    main.replaceWith(main.cloneNode(false)); const v = $('#view');    /* drop old listeners */
    if (SECT[key]) viewCollection(key, v); else if (SINGLE[key]) viewSingle(key, v); else if (key === 'messages') viewMessages(v); else if (key === 'media') viewMedia(v); else viewDashboard(v);
    window.scrollTo(0, 0);
}
function watchBadge() {
    const { fs, db } = FB; let first = true; if (badgeUnsub) badgeUnsub();
    badgeUnsub = fs.onSnapshot(fs.query(fs.collection(db, 'messages'), fs.where('status', '==', 'new')), s => {
        const b = $('#nb'); if (b) { b.textContent = s.size; b.hidden = !s.size; }
        if (!first) s.docChanges().forEach(c => { if (c.type === 'added' && !c.doc.metadata.hasPendingWrites) toast(`New ${c.doc.data().type === 'quote' ? 'quote request' : 'message'} from ${c.doc.data().name}`); });
        first = false;
    }, () => { });
}

function renderSetup() {
    app.innerHTML = `<div class="auth"><div class="auth-card setup"><h1>SUPER <span>KOAMA</span> Admin</h1><p class="sub">Connect Firebase to start.</p><div class="notice">Firebase is not configured yet.</div>
    <ol><li>Create a project at <b>console.firebase.google.com</b> and add a <b>Web app</b>.</li><li>Copy the config values into <code>super_koama/js/firebase-config.js</code>.</li><li>Enable <b>Authentication &rarr; Email/Password</b> and create <b>Firestore Database</b>.</li><li>Paste <code>firestore.rules</code> into Firestore &rarr; Rules and publish.</li><li>Reload this page. Full guide: <code>README.md</code>.</li></ol></div></div>`;
}
function renderLogin(msg = '') {
    stopSubs(); if (badgeUnsub) { badgeUnsub(); badgeUnsub = null; }
    app.innerHTML = `<div class="auth"><form class="auth-card" id="lf" novalidate><h1>SUPER <span>KOAMA</span> Admin</h1><p class="sub">Sign in to manage the website.</p>${msg ? `<div class="notice err">${esc(msg)}</div>` : ''}
    <div class="fg"><label for="em">Email</label><input type="email" id="em" autocomplete="username" required></div><div class="fg"><label for="pw">Password</label><input type="password" id="pw" autocomplete="current-password" required></div>
    <button class="btn" type="submit">Sign in</button><div style="text-align:center"><button type="button" class="link" id="fp">Forgot password?</button></div></form></div>`;
    const em = $('#em');
    $('#fp').onclick = async () => { if (!em.value.trim()) return toast('Enter your email first', 'bad'); try { await AU.a.sendPasswordResetEmail(AU.auth, em.value.trim()); toast('Password reset email sent', 'ok'); } catch (e) { toast('Could not send reset email', 'bad'); } };
    $('#lf').addEventListener('submit', async e => {
        e.preventDefault(); const btn = $('button[type=submit]', e.target); btn.disabled = true; btn.textContent = 'Signing in…';
        try { await AU.a.signInWithEmailAndPassword(AU.auth, em.value.trim(), $('#pw').value); }
        catch (err) { renderLogin(/network/.test(err.code || '') ? 'Network error. Check your connection.' : 'Wrong email or password.'); }
    });
}
function renderDenied(u) {
    app.innerHTML = `<div class="auth"><div class="auth-card"><h1>SUPER <span>KOAMA</span> Admin</h1><div class="notice err" style="margin-top:14px">You are signed in as <b>${esc(u.email)}</b> but this account is not an administrator yet.</div>
    <p class="sub" style="margin-bottom:8px">Ask the site owner to add this user ID to the Firestore <code>admins</code> collection (document ID = this ID):</p><p><code id="uid">${esc(u.uid)}</code></p><button class="btn" id="cp" style="margin-top:14px">Copy user ID</button><button class="btn ghost" id="so" style="margin-top:8px">Sign out</button></div></div>`;
    $('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(u.uid); toast('Copied', 'ok'); }; $('#so').onclick = () => AU.a.signOut(AU.auth);
}

async function boot() {
    if (!firebaseReady) return renderSetup();
    try { FB = await core(); AU = await authMod(); } catch (e) { app.innerHTML = `<div class="auth"><div class="auth-card"><div class="notice err">Could not load Firebase. Check your internet connection and reload.<br><small>${esc(e.message)}</small></div></div></div>`; return; }
    window.addEventListener('hashchange', route);
    AU.a.onAuthStateChanged(AU.auth, async u => {
        user = u; if (!u) return renderLogin();
        let ok = false; try { ok = (await FB.fs.getDoc(FB.fs.doc(FB.db, 'admins', u.uid))).exists(); } catch (e) { ok = false; }
        if (!ok) return renderDenied(u);
        shell(); watchBadge(); route();
    });
}
boot();

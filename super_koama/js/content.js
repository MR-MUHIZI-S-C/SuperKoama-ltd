/* Super Koama - live content renderer.
   Static HTML is the default/fallback. When Firebase is connected, content is streamed
   in real time (onSnapshot) and rendered over it. Last data is cached for instant paint. */
import { firebaseReady, core } from './firebase.js';

const CACHE_KEY = 'sk_cache_v1';
const COLS = ['hero', 'services', 'products', 'team', 'values', 'stats'];
const BASE = document.body.dataset.base || '';
let state = { settings: null, about: null, hero: [], services: [], products: [], team: [], values: [], stats: [] };
try { Object.assign(state, JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')); } catch (e) { /* ignore */ }

/* ---------- helpers ---------- */
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lines = v => String(v || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
const paras = v => lines(v).map(x => `<p>${esc(x)}</p>`).join('');
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';
const managed = () => state.settings && state.settings.seeded === true;
const act = a => (a || []).filter(x => x.active !== false).sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
const sortOnly = a => (a || []).slice().sort((x, y) => (x.order ?? 0) - (y.order ?? 0));

/* Cloudinary / Unsplash image sizing */
function cl(url, w) {
    url = safeUrl(url); if (!url) return '';
    if (/res\.cloudinary\.com/.test(url) && /\/upload\/(?!.*(?:f_auto|q_auto))/.test(url)) return url.replace('/upload/', `/upload/f_auto,q_auto,w_${w}/`);
    if (/images\.unsplash\.com/.test(url)) return url.replace(/([?&])w=\d+/, `$1w=${w}`);
    return url;
}
const initials = n => { const p = String(n || '').trim().split(/\s+/); return ((p[0] || '')[0] || '') + (p.length > 1 ? p[p.length - 1][0] : ''); };
const catLabel = p => (p.category === 'industrial' ? 'Industrial Raw Materials' : 'Construction Materials') + (p.swahili ? ` · ${p.swahili}` : '');

/* returns the list to render, or null to keep the static default */
function list(name, onlyActive = true) {
    const l = onlyActive ? act(state[name]) : sortOnly(state[name]);
    return (l.length || managed()) ? l : null;
}

/* ---------- renderers (each only re-renders when its data changed) ---------- */
const R = {
    hero: { deps: ['hero'], fn(el) {
        const l = list('hero'); if (!l) return;
        el.innerHTML = l.map((s, i) => `<div class="hero-slide${i ? '' : ' active'}"><img src="${esc(cl(s.image, 1920))}" alt="${esc(s.alt || '')}"${i ? ' loading="lazy"' : ''}></div>`).join('');
    } },
    'service-cards': { deps: ['services'], fn(el) {
        const l = list('services'); if (!l) return; const links = el.dataset.links !== 'off';
        el.innerHTML = l.map(s => `<div class="service-card"><div class="service-card-image"><img src="${esc(cl(s.image, 600))}" alt="${esc(s.title)}" loading="lazy"></div><div class="service-card-content"><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p>${links ? `<a href="${BASE}service-details.html#${esc(s.slug)}">Learn More <i class="fas fa-arrow-right"></i></a>` : ''}</div></div>`).join('');
    } },
    'service-list': { deps: ['services'], fn(el) {
        const l = list('services'); if (!l) return;
        el.innerHTML = l.map(s => `<div id="${esc(s.slug)}" class="service-list-item"><div class="service-list-image"><img src="${esc(cl(s.image, 600))}" alt="${esc(s.title)}" loading="lazy"></div><div class="service-list-content"><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><a href="service-details.html#${esc(s.slug)}" class="btn btn-primary">View Details</a></div></div>`).join('');
    } },
    'service-details': { deps: ['services'], fn(el) {
        const l = list('services'); if (!l) return;
        el.innerHTML = l.map((s, i) => {
            const others = l.filter(o => o.slug !== s.slug).map(o => `<li><a href="#${esc(o.slug)}">${esc(o.title)} <i class="fas fa-chevron-right"></i></a></li>`).join('');
            const feats = lines(s.features);
            return `<section id="${esc(s.slug)}" class="section service-details"${i % 2 ? ' style="background: var(--light-gray);"' : ''}><div class="container"><div class="service-details-main"><div class="service-details-image"><img src="${esc(cl(s.image, 1200))}" alt="${esc(s.title)}" loading="lazy"></div><div class="service-sidebar"><h3>Other Services</h3><ul>${others}</ul><div style="margin-top: 30px; padding: 20px; background: var(--primary); border-radius: 5px; color: var(--white); text-align: center;"><h4 style="margin-bottom: 10px;">Need This Service?</h4><p style="font-size: 14px; margin-bottom: 15px; color: rgba(255,255,255,0.9);">Contact us today for a free quotation</p><a href="quote.html" class="btn btn-primary" style="background: var(--white); color: var(--primary);">Get Quote</a></div></div></div><div class="service-details-content"><h2>${esc(s.title)}</h2>${paras(s.details || s.summary)}${feats.length ? `<p>This service includes:</p><ul style="margin-left: 20px; margin-bottom: 20px; color: #666; list-style: disc;">${feats.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}<a href="quote.html" class="btn btn-primary" style="margin-top: 20px;">${esc(s.buttonLabel || 'Request a Quote')}</a></div></div></section>`;
        }).join('');
    } },
    'service-links': { deps: ['services'], fn(el) {
        const l = list('services'); if (!l) return;
        el.innerHTML = l.map(s => `<li><a href="${BASE}services.html#${esc(s.slug)}">${esc(s.title)}</a></li>`).join('');
    } },
    'service-options': { deps: ['services'], fn(el) {
        const l = list('services'); if (!l) return; const cur = el.value;
        el.innerHTML = '<option value="">Select a service</option>' + l.map(s => `<option value="${esc(s.slug)}">${esc(s.title)}</option>`).join('') + '<option value="other">Other</option>';
        if (cur) el.value = cur;
    } },
    'products-home': { deps: ['products'], fn(el) {
        const l = list('products'); if (!l) return;
        el.innerHTML = l.slice(0, 6).map(p => productCard(p)).join('');
    } },
    'products-page': { deps: ['products'], fn(el) {
        const l = list('products'); if (!l) return;
        el.innerHTML = l.map(p => `<div class="project-item show" data-category="${esc(p.category)}">${productCard(p)}</div>`).join('');
    } },
    team: { deps: ['team'], fn(el) {
        const l = list('team', false); if (!l) return;
        el.innerHTML = l.map(t => `<div class="team-member"><div class="team-member-image">${safeUrl(t.photo) ? `<img src="${esc(cl(t.photo, 500))}" alt="${esc(t.name)}" loading="lazy">` : `<div class="team-initials" aria-hidden="true">${esc(initials(t.name))}</div>`}</div><div class="team-member-info"><h4>${esc(t.name)}</h4><p>${esc(t.role)}</p></div></div>`).join('');
    } },
    values: { deps: ['values'], fn(el) {
        const l = list('values', false); if (!l) return;
        el.innerHTML = l.map(v => `<div class="value-card"><div class="value-card-icon"><i class="fas fa-${/^[a-z0-9-]+$/.test(v.icon || '') ? v.icon : 'check'}" aria-hidden="true"></i></div><h3>${esc(v.title)}</h3><p>${esc(v.text)}</p></div>`).join('');
    } },
    stats: { deps: ['stats'], fn(el) {
        const l = list('stats', false); if (!l) return;
        el.innerHTML = l.map(s => { const m = /^(\d+)(\D*)$/.exec(String(s.value).trim()); return `<div class="stat-item"><div class="stat-number"${m ? ` data-target="${m[1]}" data-suffix="${esc(m[2])}"` : ''}>${esc(s.value)}</div><div class="stat-label">${esc(s.label)}</div></div>`; }).join('');
    } },
    social: { deps: ['settings'], fn(el) {
        const s = state.settings || {}; const defs = [['facebook', 'fab fa-facebook-f'], ['instagram', 'fab fa-instagram'], ['linkedin', 'fab fa-linkedin-in'], ['twitter', 'fab fa-x-twitter']];
        el.innerHTML = defs.filter(([k]) => safeUrl(s[k])).map(([k, ic]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener noreferrer" aria-label="${k}"><i class="${ic}"></i></a>`).join('');
    } }
};
function productCard(p) {
    return `<div class="project-card"><img src="${esc(cl(p.image, 600))}" alt="${esc(p.name)}" loading="lazy"><div class="project-overlay"><h3>${esc(p.name)}</h3><p>${esc(catLabel(p))}</p><a href="${BASE}quote.html?product=${encodeURIComponent(p.name)}" class="project-link" aria-label="Request a quote for ${esc(p.name)}"></a></div></div>`;
}

/* ---------- simple bindings (settings + about text) ---------- */
function bind() {
    const s = Object.assign({}, state.settings || {}, state.about || {});
    window.SK_SETTINGS = state.settings || {};
    $$('[data-bind-text]').forEach(el => { const v = s[el.dataset.bindText]; if (v) el.textContent = v; });
    $$('[data-bind-lines]').forEach(el => { const v = lines(s[el.dataset.bindLines]); if (v.length) el.innerHTML = v.map(esc).join('<br>'); });
    $$('[data-bind-paras]').forEach(el => { const v = s[el.dataset.bindParas]; if (lines(v).length) el.innerHTML = paras(v); });
    $$('[data-bind-href]').forEach(el => {
        if (el.dataset.bindHref === 'tel' && s.phone) el.href = 'tel:' + String(s.phone).replace(/[^\d+]/g, '');
        if (el.dataset.bindHref === 'mailto' && s.email) el.href = 'mailto:' + s.email;
    });
    $$('[data-bind-address]').forEach(el => { if (s.region || s.poBox) el.innerHTML = [s.region, s.poBox].filter(Boolean).map(esc).join('<br>'); });
    $$('[data-bind-src]').forEach(el => { const u = safeUrl(s[el.dataset.bindSrc]); if (u) { el.style.display = ''; el.src = cl(u, 900); } });
    $$('[data-bind-wa]').forEach(el => { const n = String(s.whatsapp || '').replace(/\D/g, ''); if (n) el.href = `https://wa.me/${n}?text=Hello%20Super%20Koama%2C%20I%20need%20a%20quotation.`; });
}

let queued = false, hashDone = false;
function render() {
    if (queued) return; queued = true;
    setTimeout(() => {   /* timer (not rAF) so background tabs still update */
        queued = false; let changed = false;
        $$('[data-render]').forEach(el => {
            const r = R[el.dataset.render]; if (!r) return;
            const sig = JSON.stringify(r.deps.map(d => state[d])) + (managed() ? 'm' : '');
            if (el._sig === sig) return;
            try { r.fn(el); el._sig = sig; changed = true; } catch (e) { console.warn('render', el.dataset.render, e); }
        });
        bind();
        if (!hashDone && location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) { hashDone = true; t.scrollIntoView(); } }
        if (changed) document.dispatchEvent(new Event('sk:rendered'));
    }, 30);
}
const save = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ } };

/* ---------- contact / quote submissions ---------- */
const LIMITS = { name: 120, email: 200, phone: 40, company: 200, service: 200, location: 200, budget: 200, timeline: 200, subject: 200, message: 3000 };
window.SK = {
    enabled: firebaseReady,
    async submit(data) {
        const { fs, db } = await core();
        const doc = { type: data.type === 'quote' ? 'quote' : 'contact' };
        for (const k of Object.keys(LIMITS)) { const v = String(data[k] ?? '').trim().slice(0, LIMITS[k]); if (v) doc[k] = v; }
        doc.status = 'new'; doc.createdAt = fs.serverTimestamp();
        await Promise.race([fs.addDoc(fs.collection(db, 'messages'), doc), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]);
    }
};

/* ---------- start ---------- */
render();
if (firebaseReady) {
    core().then(({ fs, db }) => {
        const sub = (ref, cb) => fs.onSnapshot(ref, cb, e => console.warn('Live update error:', e.code || e.message));
        sub(fs.doc(db, 'settings', 'site'), d => { state.settings = d.exists() ? d.data() : null; save(); render(); });
        sub(fs.doc(db, 'about', 'main'), d => { state.about = d.exists() ? d.data() : null; save(); render(); });
        COLS.forEach(c => sub(fs.collection(db, c), s => { state[c] = s.docs.map(d => ({ id: d.id, ...d.data() })); save(); render(); }));
    }).catch(e => console.warn('Firebase unavailable, using saved/default content:', e.message));
}

/* Super Koama Company Limited - site behaviour */
const DEFAULT_WHATSAPP = '255684400000';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
const waNumber = () => String((window.SK_SETTINGS && window.SK_SETTINGS.whatsapp) || DEFAULT_WHATSAPP).replace(/\D/g, '');

document.addEventListener('DOMContentLoaded', () => {
    initNavbar(); initHeroSlider(); initMobileMenu(); initScrollAnimations();
    initCounters(); initProductFilters(); initForms(); initQuotePrefill();
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
});
/* content.js re-renders sections in real time; refresh the behaviours that depend on them */
document.addEventListener('sk:rendered', () => { initCounters(); const a = $('.filter-btn.active'); if (a) applyFilter(a.dataset.filter); initQuotePrefill(); });

function initNavbar() {
    const nav = $('.navbar'); if (!nav) return;
    const onScroll = () => { const s = window.scrollY > 50; nav.classList.toggle('scrolled', s); nav.classList.toggle('transparent', !s); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
}

function initHeroSlider() {
    setInterval(() => {
        const s = $$('.hero-slide'); if (s.length < 2) return;
        const i = s.findIndex(x => x.classList.contains('active'));
        s[i < 0 ? 0 : i].classList.remove('active');
        s[(i + 1) % s.length].classList.add('active');
    }, 4000);
}

function initMobileMenu() {
    const hb = $('.hamburger'), menu = $('.nav-menu'); if (!hb || !menu) return;
    const close = () => { hb.classList.remove('active'); menu.classList.remove('active'); document.body.style.overflow = ''; hb.setAttribute('aria-expanded', 'false'); $$('li.open', menu).forEach(x => x.classList.remove('open')); };
    const toggle = () => { const o = menu.classList.toggle('active'); hb.classList.toggle('active', o); document.body.style.overflow = o ? 'hidden' : ''; hb.setAttribute('aria-expanded', String(o)); };
    hb.addEventListener('click', toggle);
    hb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    /* delegated, so links re-rendered by content.js keep working */
    menu.addEventListener('click', e => {
        const a = e.target.closest('a'); if (!a || !isMobile()) return;
        const li = a.parentElement, dd = li.querySelector(':scope > .dropdown');
        if (dd && a.parentElement.parentElement === menu && !li.classList.contains('open')) {   /* first tap opens the sub-menu, second opens the page */
            e.preventDefault(); $$('li.open', menu).forEach(x => x.classList.remove('open')); li.classList.add('open');
        } else close();
    });
    window.addEventListener('resize', () => { if (!isMobile()) close(); });
}

function initScrollAnimations() {
    const els = $$('.fade-in'); if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('visible')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
    }), { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    els.forEach(e => io.observe(e));
}

function initCounters() {
    const items = $$('.stat-number[data-target]:not([data-obs])'); if (!items.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target, target = parseInt(el.dataset.target, 10), suffix = el.dataset.suffix || '';
        io.unobserve(el);
        if (isNaN(target)) return;
        let cur = 0; const step = Math.max(target / 50, 0.1);
        const t = setInterval(() => {
            cur += step;
            if (cur >= target) { cur = target; clearInterval(t); }
            el.textContent = Math.floor(cur) + suffix;
        }, 40);
    }), { threshold: 0.5 });
    items.forEach(el => { el.dataset.obs = '1'; io.observe(el); });
}

function applyFilter(f) {
    $$('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    $$('.project-item').forEach(it => it.classList.toggle('show', f === 'all' || it.dataset.category === f));
}
function initProductFilters() {
    if (!$('.filter-btn')) return;
    document.addEventListener('click', e => { const b = e.target.closest('.filter-btn'); if (b) applyFilter(b.dataset.filter); });
    const h = location.hash.replace('#', '');
    if ($$('.filter-btn').some(b => b.dataset.filter === h)) applyFilter(h);
}

/* ---------- Forms: validate -> save to Firestore (admin inbox); WhatsApp as fallback ---------- */
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validTzPhone = v => /^(\+?255|0)\d{9}$/.test(v.replace(/[\s\-()]/g, ''));
const fieldsOf = form => $$('input, textarea, select', form).filter(f => !f.classList.contains('hp'));

function showMsg(box, text, link, linkText, isError) {
    if (!box) return;
    box.textContent = text + ' ';
    box.classList.toggle('error', !!isError);
    if (link) { const a = document.createElement('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener'; a.textContent = linkText; a.className = 'msg-link'; box.appendChild(a); }
    box.classList.add('show');
    clearTimeout(box._t); if (!isError) box._t = setTimeout(() => box.classList.remove('show'), 12000);
}

function initForms() {
    $$('form').forEach(form => {
        form.addEventListener('submit', async e => {
            e.preventDefault();
            const hp = $('.hp', form); if (hp && hp.value) { form.reset(); return; }   /* bot trap */
            let ok = true;
            $$('.form-group', form).forEach(g => g.classList.remove('error'));
            fieldsOf(form).forEach(f => {
                const v = f.value.trim(), g = f.closest('.form-group');
                let bad = f.required && !v;
                if (!bad && v && f.type === 'email' && !validEmail(v)) bad = true;
                if (!bad && v && f.type === 'tel' && !validTzPhone(v)) bad = true;
                if (bad) { ok = false; if (g) g.classList.add('error'); }
            });
            if (!ok) { const first = $('.form-group.error', form); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

            const isQuote = form.id === 'quoteForm';
            const data = { type: isQuote ? 'quote' : 'contact' }, wa = [isQuote ? 'Hello Super Koama, I would like a quotation:' : 'Hello Super Koama, I have a question:', ''];
            fieldsOf(form).forEach(f => {
                const v = f.tagName === 'SELECT' ? (f.value ? f.options[f.selectedIndex].text : '') : f.value.trim();
                if (!v) return;
                data[f.name] = v;
                const lab = $(`label[for="${f.id}"]`, form);
                wa.push(`${lab ? lab.textContent.replace('*', '').trim() : f.name}: ${v}`);
            });
            const waUrl = `https://wa.me/${waNumber()}?text=${encodeURIComponent(wa.join('\n'))}`;
            const box = form.parentElement.querySelector('.success-message'), btn = $('button[type="submit"]', form);

            if (window.SK && window.SK.enabled) {
                if (btn) btn.disabled = true;
                try {
                    await window.SK.submit(data);
                    showMsg(box, 'Thank you! Your message has been received. We will respond within 24 hours.', waUrl, 'Message us on WhatsApp too');
                    form.reset();
                } catch (err) {
                    console.warn('Submit failed:', err);
                    showMsg(box, 'Sorry, we could not send this online right now.', waUrl, 'Send it on WhatsApp instead', true);
                } finally { if (btn) btn.disabled = false; }
            } else {
                window.open(waUrl, '_blank', 'noopener');
                showMsg(box, 'WhatsApp is opening with your message. If it does not open, please call us.', waUrl, 'Open WhatsApp');
                form.reset();
            }
        });
        fieldsOf(form).forEach(f => {
            const clear = () => f.closest('.form-group')?.classList.remove('error');
            f.addEventListener('input', clear); f.addEventListener('change', clear);
        });
    });
}

/* Pre-fill the quote form when arriving from a product card (quote.html?product=Cement) */
function initQuotePrefill() {
    const ta = $('#quoteForm #message'); if (!ta || ta.dataset.prefilled) return;
    const p = new URLSearchParams(location.search).get('product'); if (!p) return;
    ta.dataset.prefilled = '1';
    ta.value = `Product: ${p}\nQuantity: \nSpecification / brand: `;
    const sel = $('#quoteForm #service');
    if (sel) sel.value = /raw materials|infrastructure/i.test(p) ? 'industrial-raw-materials' : 'construction-materials';
}

/* Smooth scroll for same-page anchors */
document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const h = a.getAttribute('href'); if (h === '#') return;
    const t = document.querySelector(h);
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', h); }
});

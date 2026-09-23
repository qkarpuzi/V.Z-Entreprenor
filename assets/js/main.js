/* ==========================================================================
   V.Z Entreprenør – interaksjon
   Lastes med «defer». Siden fungerer uten JS (vanlige lenker, native
   <details>, skjemaet poster til FormSubmit og sender til takk.html).
   JS legger på: mobilmeny, aktiv menylenke, case-galleri og lysboks,
   myk inntoning og AJAX-innsending av skjemaet med validering.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header: skygge når siden er scrollet ---------- */
  const header = $('[data-header]');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobilmeny ----------
     - aria-expanded og etikett oppdateres
     - Esc lukker, fokus holdes inne i menyen (Tab-løkke) og returneres til knappen
     - Lukkes ved klikk på lenke/bakgrunn og når skjermen blir desktop-bred */
  const toggle = $('[data-nav-toggle]');
  const toggleLabel = $('[data-nav-toggle-label]');
  const nav = $('[data-nav]');
  const backdrop = $('[data-nav-backdrop]');
  const desktop = window.matchMedia('(min-width: 1024px)');

  const focusables = () => [toggle, ...$$('a[href], button:not([disabled])', nav)];

  function setMenu(open, { restoreFocus = true } = {}) {
    nav.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    document.body.classList.toggle('is-locked', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggleLabel.textContent = open ? 'Lukk meny' : 'Åpne meny';
    $('use', toggle).setAttribute('href', open ? '#i-close' : '#i-menu');
    if (open) {
      $('a', nav).focus();
    } else if (restoreFocus) {
      toggle.focus();
    }
  }

  const isOpen = () => nav.classList.contains('is-open');

  toggle.addEventListener('click', () => setMenu(!isOpen()));
  backdrop.addEventListener('click', () => setMenu(false));
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a') && isOpen()) setMenu(false, { restoreFocus: false });
  });

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') {
      setMenu(false);
      return;
    }
    if (e.key === 'Tab') {
      const items = focusables();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  desktop.addEventListener('change', (e) => {
    if (e.matches && isOpen()) setMenu(false, { restoreFocus: false });
  });

  /* ---------- Aktiv menylenke etter hvilken seksjon som er synlig ---------- */
  const navLinks = $$('.site-nav__list a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const inView = new Set();
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) inView.add(entry.target.id);
        else inView.delete(entry.target.id);
      });
      // Ingen seksjon midt i skjermen (f.eks. i hero) → ingen aktiv lenke
      const current = sections.find((s) => inView.has(s.id))?.id;
      navLinks.forEach((a) => {
        const active = a.getAttribute('href') === `#${current}`;
        a.classList.toggle('is-active', active);
        if (active) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  }

  /* ---------- Tjenestekort: forhåndsvelg tjeneste i skjemaet ---------- */
  const serviceSelect = $('#f-service');
  $$('[data-service]').forEach((link) => {
    link.addEventListener('click', () => {
      serviceSelect.value = link.dataset.service;
    });
  });

  /* ---------- Case-galleri: bytt hovedbilde fra miniatyrer ---------- */
  const imgPath = (name, w, ext) => `assets/img/${name}-${w}.${ext}`;

  $$('[data-case]').forEach((caseEl) => {
    const source = $('[data-case-source]', caseEl);
    const img = $('[data-case-img]', caseEl);
    const caption = $('[data-case-caption]', caseEl);
    const thumbs = $$('.case__thumb', caseEl);

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => {
        if (thumb.getAttribute('aria-pressed') === 'true') return;
        thumbs.forEach((t) => t.setAttribute('aria-pressed', String(t === thumb)));

        const { src, w, h, alt } = thumb.dataset;
        const swap = () => {
          source.srcset = `${imgPath(src, 800, 'webp')} 800w, ${imgPath(src, 1200, 'webp')} 1200w`;
          img.src = imgPath(src, 800, 'jpg');
          img.width = Number(w);
          img.height = Number(h);
          img.alt = alt;
          caption.textContent = thumb.dataset.caption;
          img.classList.remove('is-swapping');
        };

        if (reduceMotion) {
          swap();
        } else {
          img.classList.add('is-swapping');
          setTimeout(swap, 180);
        }
      });
    });
  });

  /* ---------- Lysboks (native <dialog>) ---------- */
  const lightbox = $('[data-lightbox]');
  const lbImg = $('[data-lightbox-img]');
  const lbCaption = $('[data-lightbox-caption]');

  if (lightbox && typeof lightbox.showModal === 'function') {
    $$('[data-case-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const caseEl = btn.closest('[data-case]');
        const active = $('.case__thumb[aria-pressed="true"]', caseEl);
        const img = $('[data-case-img]', caseEl);
        lbImg.src = imgPath(active.dataset.src, 1200, 'webp');
        lbImg.alt = img.alt;
        lbCaption.textContent = $('[data-case-caption]', caseEl).textContent;
        lightbox.showModal();
      });
    });
    // Klikk utenfor bildet (på bakgrunnen) lukker
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) lightbox.close();
    });
  } else {
    // Eldre nettlesere uten <dialog>: hovedbildet er bare et bilde
    $$('[data-case-open]').forEach((btn) => btn.removeAttribute('aria-label'));
  }

  /* ---------- Myk inntoning av innhold under bretten ---------- */
  if ('IntersectionObserver' in window && !reduceMotion) {
    const targets = $$('.section-head, .service-card, .process__step, .case, .values__item, .review, .faq__list, .form');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    targets.forEach((el) => {
      // Bare elementer som starter under skjermkanten, så ingenting «blinker»
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('reveal');
        io.observe(el);
      }
    });
  }

  /* ---------- Årstall i footer ---------- */
  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Kontaktskjema ----------
     Klientvalidering med norske feilmeldinger, deretter innsending til
     FormSubmit sitt AJAX-endepunkt. Viser lastetilstand og kvittering. */
  const form = $('[data-contact-form]');
  if (!form) return;

  const ENDPOINT = 'https://formsubmit.co/ajax/vz.zenuni@hotmail.com';
  const submitBtn = $('[data-submit]', form);
  const submitLabel = $('.btn__label', submitBtn);
  const status = $('[data-form-status]', form);

  const messages = {
    'f-name': { valueMissing: 'Skriv inn navnet ditt.', tooShort: 'Navnet må ha minst 2 tegn.' },
    'f-phone': { valueMissing: 'Skriv inn telefonnummeret ditt.', patternMismatch: 'Skriv inn et gyldig telefonnummer, f.eks. 968 28 588.' },
    'f-email': { valueMissing: 'Skriv inn e-postadressen din.', typeMismatch: 'Sjekk at e-postadressen er riktig, f.eks. navn@domene.no.' },
    'f-message': { valueMissing: 'Fortell kort hva du ønsker hjelp med.', tooShort: 'Skriv litt mer, minst 10 tegn.' },
  };

  function errorFor(input) {
    // Trim før sjekk, så «   » ikke regnes som utfylt
    if (input.required && !input.value.trim()) return messages[input.id]?.valueMissing;
    const v = input.validity;
    const m = messages[input.id] || {};
    if (v.tooShort || (input.minLength > 0 && input.value.trim().length < input.minLength)) return m.tooShort;
    if (v.typeMismatch) return m.typeMismatch;
    if (v.patternMismatch) return m.patternMismatch;
    return '';
  }

  function showError(input, msg) {
    const field = input.closest('.field');
    const out = $(`[data-error-for="${input.id}"]`, form);
    field.classList.toggle('has-error', Boolean(msg));
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (out) out.textContent = msg || '';
  }

  const validated = $$('input[required], textarea[required]', form);

  validated.forEach((input) => {
    // Valider når brukeren forlater feltet, og fjern feilen straks den er rettet
    input.addEventListener('blur', () => {
      if (input.value) showError(input, errorFor(input));
    });
    input.addEventListener('input', () => {
      if (input.closest('.field').classList.contains('has-error')) showError(input, errorFor(input));
    });
  });

  function setStatus(type, html) {
    status.hidden = false;
    status.className = `form__status is-${type}`;
    status.setAttribute('role', type === 'error' ? 'alert' : 'status');
    status.innerHTML = html;
  }

  function setLoading(loading) {
    submitBtn.classList.toggle('is-loading', loading);
    submitBtn.disabled = loading;
    form.setAttribute('aria-busy', String(loading));
    submitLabel.textContent = loading ? 'Sender …' : 'Send forespørsel';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.hidden = true;

    let firstInvalid = null;
    validated.forEach((input) => {
      const msg = errorFor(input);
      showError(input, msg);
      if (msg && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    // Honningkrukke fylt ut = bot. Lat som alt gikk bra.
    if (form.elements._honey.value) {
      setStatus('success', 'Takk! Vi tar kontakt snart.');
      form.reset();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    // Trimmer verdier og legger inn svaradresse, så «Svar» i e-posten går til kunden
    Object.keys(data).forEach((k) => { data[k] = String(data[k]).trim(); });
    data._replyto = data.email;
    delete data._next;

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      // FormSubmit returnerer { success: "true" | "false", message }
      if (!res.ok || String(json.success) !== 'true') throw new Error(json.message || `HTTP ${res.status}`);

      form.reset();
      validated.forEach((input) => showError(input, ''));
      setStatus('success', `<strong>Takk, ${escapeHtml(data.navn.split(' ')[0])}!</strong> Forespørselen er sendt. Vi tar kontakt innen én virkedag.`);
    } catch (err) {
      console.warn('Skjemainnsending feilet:', err);
      setStatus('error', 'Beklager, meldingen ble ikke sendt. Prøv igjen, eller ring oss direkte på <a href="tel:+4796828588">968 28 588</a>.');
    } finally {
      clearTimeout(timer);
      setLoading(false);
      status.focus();
    }
  });

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
})();

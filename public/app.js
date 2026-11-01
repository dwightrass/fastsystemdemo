const PRODUCT_ID = 'sheaboter';
const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function getJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
  return data;
}

// ---------- Kopen ----------
async function startCheckout(productId, quantity, button) {
  const label = button.querySelector('span') || button;
  const text = label.textContent;
  button.disabled = true;
  button.classList.add('loading');
  label.textContent = 'Even geduld…';
  try {
    const { checkoutUrl } = await getJSON('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity }),
    });
    window.location.href = checkoutUrl;
  } catch (err) {
    alert(err.message);
    button.disabled = false;
    button.classList.remove('loading');
    label.textContent = text;
  }
}

async function initShop() {
  document.getElementById('year').textContent = new Date().getFullYear();

  // Prijs en tekst altijd van de server, zodat er één bron van waarheid is.
  try {
    const p = await getJSON(`/api/products/${PRODUCT_ID}`);
    document.querySelectorAll('[data-price]').forEach((el) => (el.textContent = euro.format(p.price)));
    document.querySelectorAll('[data-size]').forEach((el) => (el.textContent = p.size));
    document.querySelectorAll('[data-description]').forEach((el) => (el.textContent = p.description));
  } catch (err) {
    console.error(err);
  }

  document.querySelectorAll('.buy-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      startCheckout(PRODUCT_ID, Number(form.quantity.value) || 1, form.querySelector('button[type=submit]'));
    });
  });

  document.querySelectorAll('.qty').forEach((qty) => {
    const input = qty.querySelector('input');
    qty.addEventListener('click', (e) => {
      const step = Number(e.target.dataset.step);
      if (!step) return;
      input.value = Math.min(20, Math.max(1, (Number(input.value) || 1) + step));
    });
  });

  initMotion();
}

// ---------- Motion ----------
function initMotion() {
  const header = document.querySelector('.site-header');
  const sticky = document.getElementById('stickyBuy');
  const hero = document.querySelector('.hero');

  // Elementen zacht laten verschijnen bij scrollen.
  const revealObserver = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    }),
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

  // Tellers in de herkomst-sectie.
  const countObserver = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    countObserver.unobserve(e.target);
    const target = Number(e.target.dataset.count);
    if (reduceMotion || target === 0) return void (e.target.textContent = target);
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1400);
      e.target.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => countObserver.observe(el));

  // Header en sticky koopbalk bij scrollen.
  const parallax = reduceMotion ? [] : [...document.querySelectorAll('[data-speed]')];
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 20);
    const pastHero = y > hero.offsetHeight * 0.75;
    sticky.classList.toggle('show', pastHero);
    sticky.setAttribute('aria-hidden', String(!pastHero));
    sticky.querySelector('button').tabIndex = pastHero ? 0 : -1;
    // Parallax ten opzichte van het midden van het scherm, per sectie.
    parallax.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      const offset = r.top + r.height / 2 - window.innerHeight / 2;
      el.style.translate = `0 ${(-offset * Number(el.dataset.speed)).toFixed(1)}px`;
    });
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // Pot kantelt subtiel mee met de muis.
  const jar = document.getElementById('jar');
  if (!reduceMotion && jar && window.matchMedia('(hover: hover)').matches) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      jar.style.transform = `perspective(900px) rotateY(${x * 10}deg) rotateX(${-y * 6}deg) translate(${x * 14}px, ${y * 10}px)`;
    });
    hero.addEventListener('pointerleave', () => (jar.style.transform = ''));
  }
}

// ---------- Bedankpagina ----------
const STATUS_TEXT = {
  paid: ['Dank je wel!', 'Je betaling is gelukt. We pakken je sheaboter met zorg in en versturen hem zo snel mogelijk.', 'ok'],
  authorized: ['Dank je wel!', 'Je betaling is geautoriseerd. We gaan je bestelling klaarmaken.', 'ok'],
  open: ['Betaling nog niet afgerond', 'We hebben je betaling nog niet ontvangen. Dit kan even duren.', 'wait'],
  pending: ['Betaling wordt verwerkt', 'Je betaling wordt nog verwerkt. Je ontvangt bericht zodra deze binnen is.', 'wait'],
  canceled: ['Betaling geannuleerd', 'Je hebt de betaling geannuleerd. Er is niets afgeschreven.', 'fail'],
  expired: ['Betaling verlopen', 'De betaling is verlopen. Probeer het gerust opnieuw.', 'fail'],
  failed: ['Betaling mislukt', 'Er ging iets mis met je betaling. Probeer het opnieuw.', 'fail'],
};

async function renderOrderStatus(el, attempt = 0) {
  const id = new URLSearchParams(location.search).get('order');
  try {
    const order = await getJSON(`/api/orders/${encodeURIComponent(id)}`);
    const [title, text, kind] = STATUS_TEXT[order.status] || STATUS_TEXT.pending;
    el.className = `status-card ${kind} in`;
    el.innerHTML = `
      <div class="status-icon">${kind === 'ok' ? '✓' : kind === 'fail' ? '×' : '…'}</div>
      <h1>${title}</h1>
      <p>${text}</p>
      <p class="muted">${order.quantity}× ${esc(order.productName)} · ${euro.format(Number(order.amount))}</p>
      <a class="btn" href="/"><span>${kind === 'fail' ? 'Opnieuw proberen' : 'Terug naar de winkel'}</span></a>`;
    if (kind === 'wait' && attempt < 10) setTimeout(() => renderOrderStatus(el, attempt + 1), 3000);
  } catch (err) {
    el.innerHTML = `<p class="error">${esc(err.message)}</p><a class="btn" href="/"><span>Terug naar de winkel</span></a>`;
  }
}

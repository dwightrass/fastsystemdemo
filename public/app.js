const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function getJSON(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
  return data;
}

async function startCheckout(productId, quantity, button) {
  button.disabled = true;
  const label = button.textContent;
  button.textContent = 'Doorsturen naar betalen…';
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
    button.textContent = label;
  }
}

async function renderProductGrid(el) {
  try {
    const products = await getJSON('/api/products');
    el.innerHTML = products
      .map(
        (p) => `
      <article class="card">
        <a href="/product.html?id=${encodeURIComponent(p.id)}" class="card-link">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy">
          <h2>${esc(p.name)}</h2>
          <p class="muted">${esc(p.short)}</p>
        </a>
        <div class="card-footer">
          <span class="price">${euro.format(p.price)}</span>
          <button class="btn" data-id="${esc(p.id)}">Koop nu</button>
        </div>
      </article>`
      )
      .join('');
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-id]');
      if (btn) startCheckout(btn.dataset.id, 1, btn);
    });
  } catch (err) {
    el.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

async function renderProductDetail(el) {
  const id = new URLSearchParams(location.search).get('id');
  try {
    const p = await getJSON(`/api/products/${encodeURIComponent(id)}`);
    document.title = `${p.name} – Natural Pure`;
    el.innerHTML = `
      <img src="${esc(p.image)}" alt="${esc(p.name)}">
      <div class="info">
        <h1>${esc(p.name)}</h1>
        <p class="muted">${esc(p.size)}</p>
        <p class="price big">${euro.format(p.price)}</p>
        <p>${esc(p.description)}</p>
        <form class="buy">
          <label>Aantal
            <input type="number" name="quantity" value="1" min="1" max="20" required>
          </label>
          <button class="btn btn-large" type="submit">Koop nu</button>
        </form>
        <ul class="perks">
          <li>✓ 100% natuurlijk</li>
          <li>✓ Veilig betalen via Mollie (iDEAL, creditcard, …)</li>
          <li>✓ Binnen 2 werkdagen in huis</li>
        </ul>
      </div>`;
    el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const qty = Number(e.target.quantity.value);
      startCheckout(p.id, qty, e.target.querySelector('button'));
    });
  } catch (err) {
    el.innerHTML = `<p class="error">${esc(err.message)}</p>`;
  }
}

const STATUS_TEXT = {
  paid: ['Bedankt voor je bestelling!', 'Je betaling is gelukt. We gaan je bestelling zo snel mogelijk versturen.', 'ok'],
  authorized: ['Bedankt voor je bestelling!', 'Je betaling is geautoriseerd. We gaan je bestelling klaarmaken.', 'ok'],
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
    el.className = `status-card ${kind}`;
    el.innerHTML = `
      <h1>${title}</h1>
      <p>${text}</p>
      <p class="muted">${order.quantity}× ${esc(order.productName)} · ${euro.format(Number(order.amount))}</p>
      <a class="btn" href="/">${kind === 'fail' ? 'Terug naar de winkel' : 'Verder winkelen'}</a>`;
    // Even opnieuw controleren als de betaling nog onderweg is.
    if (kind === 'wait' && attempt < 10) setTimeout(() => renderOrderStatus(el, attempt + 1), 3000);
  } catch (err) {
    el.innerHTML = `<p class="error">${esc(err.message)}</p><a class="btn" href="/">Terug naar de winkel</a>`;
  }
}

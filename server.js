import express from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const MOLLIE_API_KEY = process.env.MOLLIE_API_KEY;
const MOLLIE_API = process.env.MOLLIE_API_URL || 'https://api.mollie.com/v2';
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');

const products = JSON.parse(await readFile(path.join(__dirname, 'data', 'products.json'), 'utf8'));
const findProduct = (id) => products.find((p) => p.id === id);

// ---------- Eenvoudige order-opslag (JSON-bestand) ----------
async function loadOrders() {
  try {
    return JSON.parse(await readFile(ORDERS_FILE, 'utf8'));
  } catch {
    return {};
  }
}
let writeQueue = Promise.resolve();
function saveOrder(order) {
  writeQueue = writeQueue.then(async () => {
    const orders = await loadOrders();
    orders[order.id] = order;
    await writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
  });
  return writeQueue;
}

// ---------- Mollie ----------
async function mollie(method, endpoint, body) {
  if (!MOLLIE_API_KEY) throw new Error('MOLLIE_API_KEY ontbreekt. Zet deze in je .env-bestand.');
  const res = await fetch(`${MOLLIE_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${MOLLIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Mollie-fout (${res.status})`);
  return data;
}

// Mollie kan localhost niet bereiken, dus alleen een webhook meesturen bij een publieke URL.
const isPublicUrl = !/\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(BASE_URL);

async function syncOrderWithMollie(order) {
  if (!order?.paymentId) return order;
  const payment = await mollie('GET', `/payments/${order.paymentId}`);
  if (payment.status !== order.status) {
    order.status = payment.status;
    order.updatedAt = new Date().toISOString();
    await saveOrder(order);
  }
  return order;
}

// ---------- App ----------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/products', (req, res) => res.json(products));

app.get('/api/products/:id', (req, res) => {
  const product = findProduct(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product niet gevonden' });
  res.json(product);
});

// Start een betaling voor één product. De prijs komt altijd van de server.
app.post('/api/checkout', async (req, res) => {
  const product = findProduct(req.body.productId);
  const quantity = Math.floor(Number(req.body.quantity));
  if (!product) return res.status(400).json({ error: 'Onbekend product' });
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
    return res.status(400).json({ error: 'Kies een aantal tussen 1 en 20' });
  }

  const order = {
    id: randomUUID(),
    productId: product.id,
    productName: product.name,
    quantity,
    amount: (Math.round(product.price * 100) * quantity / 100).toFixed(2),
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  try {
    const payment = await mollie('POST', '/payments', {
      amount: { currency: 'EUR', value: order.amount },
      description: `Natural Pure – ${quantity}x ${product.name}`,
      redirectUrl: `${BASE_URL}/bedankt.html?order=${order.id}`,
      ...(isPublicUrl && { webhookUrl: `${BASE_URL}/api/mollie/webhook` }),
      locale: 'nl_NL',
      metadata: { orderId: order.id },
    });
    order.paymentId = payment.id;
    await saveOrder(order);
    res.json({ checkoutUrl: payment._links.checkout.href });
  } catch (err) {
    console.error('Betaling aanmaken mislukt:', err.message);
    res.status(502).json({ error: 'Betaling kon niet worden gestart. Probeer het later opnieuw.' });
  }
});

// Mollie roept deze webhook aan bij elke statuswijziging (body: id=tr_xxx).
app.post('/api/mollie/webhook', async (req, res) => {
  try {
    const payment = await mollie('GET', `/payments/${req.body.id}`);
    const orders = await loadOrders();
    const order = orders[payment.metadata?.orderId];
    if (order && order.paymentId === payment.id) {
      order.status = payment.status;
      order.updatedAt = new Date().toISOString();
      await saveOrder(order);
      console.log(`Order ${order.id}: ${payment.status}`);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook-fout:', err.message);
    res.sendStatus(500);
  }
});

// Status van een bestelling voor de bedankpagina.
app.get('/api/orders/:id', async (req, res) => {
  const orders = await loadOrders();
  let order = orders[req.params.id];
  if (!order) return res.status(404).json({ error: 'Bestelling niet gevonden' });
  try {
    order = await syncOrderWithMollie(order);
  } catch (err) {
    console.error('Status ophalen mislukt:', err.message);
  }
  const { id, productName, quantity, amount, status } = order;
  res.json({ id, productName, quantity, amount, status });
});

app.listen(PORT, () => {
  console.log(`Natural Pure draait op ${BASE_URL}`);
  if (!MOLLIE_API_KEY) console.warn('⚠ Let op: MOLLIE_API_KEY is niet ingesteld.');
});

# Natural Pure 🌿

Een elegante one-product webshop voor **Pure Sheaboter**, met betalingen via [Mollie](https://www.mollie.com).
De **Koop nu**-knop stuurt de klant meteen naar de Mollie-betaalpagina (iDEAL, creditcard, Bancontact, enz.).

Het ontwerp heeft een natuurlijke, rustige uitstraling (Cormorant Garamond + Jost, crème/olijf/hout-tinten)
met subtiele motion: zwevende productpot die meebeweegt met de muis, parallax-blaadjes, zacht
verschijnende secties bij het scrollen, tellers, een doorlopende marquee en een sticky koopbalk op mobiel.
Bezoekers met "verminder beweging" ingeschakeld krijgen een statische versie.

## Starten

Benodigd: Node.js 22 of nieuwer.

```bash
npm install
cp .env.example .env     # vul hier je Mollie API-key in
npm start
```

Open daarna http://localhost:3000.

## Mollie instellen

1. Maak een account aan op [mollie.com](https://www.mollie.com) en ga naar **Developers → API keys**.
2. Zet je **test**-key (`test_...`) in `.env` als `MOLLIE_API_KEY`. Hiermee kun je proefbetalingen doen zonder echt geld.
3. Zodra je account is goedgekeurd, vervang je die door de **live**-key (`live_...`).
4. Zet `BASE_URL` op het publieke adres van je webshop (bijv. `https://www.naturalpure.nl`).
   Mollie stuurt klanten daarheen terug na betalen en meldt statuswijzigingen via de webhook
   `BASE_URL/api/mollie/webhook`. Op `localhost` wordt geen webhook meegestuurd (Mollie kan je
   computer niet bereiken); de status wordt dan opgehaald zodra de klant terugkomt op de bedankpagina.

## Hoe het werkt

1. Klant klikt op **Koop nu** → `POST /api/checkout` met product en aantal.
2. De server berekent de prijs (nooit vanuit de browser), maakt een bestelling aan en een Mollie-betaling.
3. Klant betaalt bij Mollie en komt terug op `/bedankt.html`, die de betaalstatus toont.
4. Mollie roept de webhook aan; de status van de bestelling wordt bijgewerkt in `data/orders.json`.

## Producten aanpassen

Prijs, inhoud en beschrijving staan in [`data/products.json`](data/products.json); de pagina haalt
deze automatisch op. De overige teksten staan in `public/index.html`. De productafbeeldingen staan in
`public/img/` – vervang `sheaboter.svg` gerust door een echte productfoto (bijv. een `.png` of `.webp`
met transparante achtergrond) en pas de `src` in `index.html` aan.

## Structuur

```
server.js            Express-server + Mollie-koppeling
data/products.json   Productcatalogus
data/orders.json     Bestellingen (wordt automatisch aangemaakt)
public/              Website: index (productpagina), bedankt, app.js, style.css
```

> **Let op:** bestellingen worden voor de eenvoud in een JSON-bestand opgeslagen. Voor een
> drukbezochte shop is een echte database aan te raden, en je wilt waarschijnlijk nog
> verzendgegevens (naam/adres) en een bevestigingsmail toevoegen.

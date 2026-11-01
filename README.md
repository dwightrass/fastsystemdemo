# Natural Pure 🌿

Een eenvoudige webshop voor natuurlijke producten, met betalingen via [Mollie](https://www.mollie.com).
Elk product heeft een **Koop nu**-knop die de klant meteen naar de Mollie-betaalpagina stuurt
(iDEAL, creditcard, Bancontact, enz.).

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

Alle producten staan in [`data/products.json`](data/products.json). Pas naam, prijs, beschrijving
of afbeelding aan en herstart de server. Afbeeldingen staan in `public/img/` (vervang de
voorbeeld-SVG's gerust door echte productfoto's).

## Structuur

```
server.js            Express-server + Mollie-koppeling
data/products.json   Productcatalogus
data/orders.json     Bestellingen (wordt automatisch aangemaakt)
public/              Website: index (overzicht), product, bedankt
```

> **Let op:** bestellingen worden voor de eenvoud in een JSON-bestand opgeslagen. Voor een
> drukbezochte shop is een echte database aan te raden, en je wilt waarschijnlijk nog
> verzendgegevens (naam/adres) en een bevestigingsmail toevoegen.

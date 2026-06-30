# TCG Scanner

Vanilla Webapp fuer Pokemon-TCG Scans, Cardmarket-Links, Sammlung und Cloud-Sync auf Vercel.

## Funktionen

- KI-Scan ueber serverseitige OpenAI API Route (`/api/scan`)
- Karten-Treffersuche ueber serverseitige Pokemon-TCG API Route (`/api/card-search`)
- Account-Login und Cloud-Sync ueber Neon (`/api/auth`, `/api/collection`)
- Serverseitige Preisabfrage (`/api/prices`) mit Provider-Schicht
- Cardmarket-URL- und Variantenhelfer im Frontend

## Preisabfrage

Die Preisabfrage laeuft ausschliesslich serverseitig. Der Browser ruft nur `/api/prices` auf und sendet Kartendaten wie Name, SetCode, Kartennummer, Sprache und Zustand. API-Schluessel bleiben in Vercel Environment Variables.

Aktuell nutzt der produktive Provider die Cardmarket-Preisfelder aus der Pokemon-TCG-API. Es wird kein Cardmarket-Scraping verwendet und keine vollstaendige Cardmarket-Datenbank gespeichert. Direkte Cardmarket-Credentials sind in `.env.example` vorbereitet, sollten aber nur mit einer offiziell erlaubten Backend-Integration genutzt werden.

Antwortfelder enthalten nach Moeglichkeit:

- Kartenname
- Set und SetCode
- Kartennummer
- Preis und Waehrung
- Zustand und Sprache aus der Anfrage
- Quelle und Abrufzeitpunkt
- optional eine Quell-URL

Wenn kein Preis gefunden wird, zeigt die App: `Aktuell kein Preis verfuegbar.`

## Environment Variables

Siehe `.env.example`.

Pflicht fuer KI-Scan:

```bash
OPENAI_API_KEY=
```

Pflicht fuer Cloud-Sync/Login:

```bash
DATABASE_URL=
APP_ACCESS_TOKEN=
```

Optional fuer bessere Pokemon-TCG API Limits und Preisabfrage:

```bash
POKEMON_TCG_API_KEY=
```

Optional vorbereitet fuer eine offizielle direkte Cardmarket-Backend-Integration:

```bash
CARDMARKET_API_KEY=
CARDMARKET_API_SECRET=
CARDMARKET_API_TOKEN=
```

## Datenschutz und Sicherheit

- Kein API-Schluessel liegt im Frontend.
- Login verwendet HttpOnly Session-Cookies.
- Cloud-Sync entfernt Base64-Bilddaten vor dem Upload.
- Preisabfragen sind rate-limitiert, gecacht und laufen mit Timeout.
- Kein Scraping und keine Umgehung fremder Schutzmechanismen.

## Entwicklung

```bash
npm install
npm test
```

Die Tests pruefen Provider-Validierung, Nummern-Normalisierung und die Preisantwort ohne echte Netzwerkaufrufe.

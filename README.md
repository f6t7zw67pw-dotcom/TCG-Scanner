# TCG Scanner

Vanilla Webapp fuer Pokemon-TCG Scans, Cardmarket-Links, Sammlung und Cloud-Sync auf Vercel.

## Funktionen

- KI-Scan ueber serverseitige OpenAI API Route (`/api/scan`)
- Erkennung fuer Pokemon, Trainer, Item, Supporter, Stadium, Tool, Energy und alte Kartenlayouts
- Eigene Neon-Setdatenbank mit Aliasen fuer Pokemon-TCG-Codes, alte Setnamen und Cardmarket-taugliche Setnamen
- Katalogbasierte Karten-Treffersuche ueber Neon mit Pokemon-TCG-Fallback (`/api/card-search`, `/api/cards/search`)
- Scan-Bestaetigungsflow mit 3-5 Katalogtreffern und direkter Uebernahme in die Sammlung
- Account-Login und Cloud-Sync ueber Neon (`/api/auth`, `/api/collection`)
- Passwort-Reset ueber Einrichtungscode (`/api/auth`, Aktion `reset-password`)
- Serverseitige Preisabfrage (`/api/prices`) mit Provider-Schicht und Preis-Snapshots
- Scan-Historie pro Konto (`/api/scans`)
- Cardmarket-URL- und Variantenhelfer im Frontend
- Visuelles MVP-Zielbild im Hilfe-Bereich (`mvp-vision-helper.js`)

## Set-Datenbank

Die App fuehrt jetzt eine eigene Set-Alias-Tabelle in Neon: `cw_set_aliases`.

Gespeichert werden pro Set mehrere Schreibweisen:

- Pokemon-TCG API Set-ID
- PTCGO-/Set-Code
- offizieller Setname aus der Pokemon-TCG-API
- Cardmarket-tauglicher Slug-Name
- bekannte alte Set-Aliase wie Base Set, Jungle, Fossil, Gym Heroes, Neo, EX, Diamond & Pearl, Black & White, XY, Sun & Moon, Sword & Shield und Scarlet & Violet

Die Alias-Daten werden beim Katalogaufbau automatisch gespeichert, sobald Karten aus der Pokemon-TCG-API in Neon uebernommen werden. Wegen des Vercel-Hobby-Limits wird dafuer kein zusaetzlicher `/api/sets`-Endpunkt angelegt; die Logik sitzt in der bestehenden Katalogsuche.

Wichtig: Eine exakt offizielle Cardmarket-Setdatenbank kann nur mit einer erlaubten Cardmarket-API/Export-Quelle synchronisiert werden. Die App nutzt deshalb aktuell Pokemon-TCG-Daten plus Cardmarket-kompatible Aliase und Slugs, ohne Cardmarket zu scrapen.

## Scan-Erkennung

Der Scanner behandelt jetzt nicht nur Pokemon-Karten als gueltige Treffer. Trainer, Item, Supporter, Stadium, Tool, Energy und Special Energy werden als normale Karten erkannt und an die Katalogsuche weitergegeben.

Fuer alte Kartenlayouts ist die Set-Erkennung toleranter:

- Kartennummern koennen links, rechts, mittig unten oder nah am Rand stehen.
- SetCode wird bei Unsicherheit lieber leer gelassen, statt hart geraten zu werden.
- Die Katalogsuche versucht zuerst Name + Nummer + Set, danach automatisch ohne SetCode, nur mit Nummer oder nur mit Name.
- Dadurch blockiert ein falsch gelesenes altes Set nicht mehr direkt alle Treffer.

## Scan bestaetigen

Nach einem KI-Scan erscheint im Scanner der Bereich `Scan bestaetigen`. Dort sucht die App passende Treffer im eigenen Neon-Katalog. Wenn Neon noch zu wenig weiss, wird die Pokemon-TCG-API abgefragt und der Treffer danach in Neon gespeichert.

Du kannst dann:

1. `Nur uebernehmen` klicken, um die Formularfelder mit dem Treffer zu fuellen.
2. `Bestaetigen & speichern` klicken, um den Treffer in die Sammlung zu uebernehmen, in der Cloud zu synchronisieren und den Scan als bestaetigt zu markieren.

Der Server-Endpunkt `POST /api/scans/confirm` verknuepft den gespeicherten Scan mit dem bestaetigten Katalogtreffer.

## MVP-Zielbild

Im Hilfe-Bereich zeigt die App eine visualisierte Architektur fuer den naechsten grossen Scanner-Ausbau:

- Upload-first Scan-Ablauf
- OCR und Bildvorbereitung
- eigener normalisierter Kartenkatalog als zentrale Quelle
- Kandidatenliste mit Confidence-Scoring
- getrennte Marketplace-Preisprovider
- Scan-Historie, Preis-Snapshots und Cloud-Sammlung
- spaetere Erweiterung auf Magic, Yu-Gi-Oh! und weitere TCGs

Der erste technische Schritt davon ist umgesetzt: Neon legt bei Nutzung automatisch Tabellen fuer `cw_card_sets`, `cw_set_aliases`, `cw_cards`, `cw_card_variants`, `cw_price_snapshots` und `cw_scans` an. Die bestehende Kartensuche nutzt jetzt diese Katalogbasis und fuellt sie bei Bedarf aus der Pokemon-TCG-API nach.

## Katalog und Scan-Historie

Die App speichert keine grossen Base64-Bilder in der Scan-Historie. Gespeichert werden Scan-Modus, erkannte Felder, Confidence, Warnungen und der beste Katalogtreffer, soweit vorhanden.

Neue Endpunkte:

```text
POST /api/cards/search   Katalogsuche mit Pokemon-TCG-Fallback und Set-Alias-Aufloesung
GET  /api/scans          letzte Cloud-Scans des angemeldeten Kontos
POST /api/scans          Scan-Ergebnis manuell speichern
POST /api/scans/confirm  Scan mit bestaetigter Karte verknuepfen
DELETE /api/scans        Scan-Historie des Kontos loeschen
```

`/api/card-search` bleibt als alter kompatibler Endpunkt erhalten und zeigt intern auf die neue Katalogsuche.

## Account und Passwort-Reset

Die App nutzt Benutzername + Passwort und speichert Sessions als HttpOnly Cookie. Der Einrichtungscode aus `APP_ACCESS_TOKEN` wird nur fuer Konto-Erstellung, weitere Konten und Passwort-Reset verwendet.

Passwort vergessen:

1. In der App zur Sammlung gehen.
2. Im Bereich `Account & Cloud` Benutzername eintragen.
3. Im Passwortfeld das neue Passwort eintragen.
4. Den Einrichtungscode eintragen.
5. `Passwort zuruecksetzen` klicken.

Beim Reset wird das Passwort serverseitig neu gehasht, alte Sessions dieses Users werden geloescht und das aktuelle Geraet wird direkt neu angemeldet.

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

Pflicht fuer Cloud-Sync/Login/Katalog:

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
- Scan-Historie speichert nur kompakte Ergebnisdaten, keine hochgeladenen Bilddaten.
- Passwort-Reset braucht den Einrichtungscode und loescht alte Sessions des Users.
- Preisabfragen sind rate-limitiert, gecacht und laufen mit Timeout.
- Kein Scraping und keine Umgehung fremder Schutzmechanismen.

## Entwicklung

```bash
npm install
npm test
```

Die Tests pruefen Provider-Validierung, Nummern-Normalisierung und die Preisantwort ohne echte Netzwerkaufrufe.

# Phase 1: Bestandsaufnahme und Security Hardening

Stand: 2026-07-30

## Systemueberblick

- Frontend: statische Vanilla-Webapp in `index.html`; Funktionen werden durch zahlreiche Helper-Skripte erweitert.
- API: Vercel Functions unter `api/`.
- Auth: Benutzername/Passwort, PBKDF2-SHA256 und zufaellige, nur gehasht gespeicherte Session-Tokens in Neon. Der Browser erhaelt ein `HttpOnly`, `Secure`, `SameSite=Lax` Cookie.
- Cloud-Sync: `api/collection.js` speichert Karten als JSONB in `cw_collection_cards`.
- Katalog: Tabellen fuer Sets, Aliase, Karten, Varianten, Preise und Scans werden derzeit bei API-Nutzung angelegt.
- Scan: `/api/scan` sendet verkleinerte Bilder serverseitig an OpenAI; Bilder werden nicht in der Scan-Historie gespeichert.
- Preise: serverseitige Provider-Schicht und Preis-Snapshots; keine Provider-Secrets im Frontend.
- Tests: Node-Test fuer Preisnormalisierung/Provider sowie neue Security-Regressionstests.

## Umgesetzte Entscheidungen

1. Geschuetzte APIs sind fail-closed. Fehlen `APP_ACCESS_TOKEN` oder Datenbankkonfiguration, akzeptiert `hasSessionOrAdmin` keine anonyme Anfrage.
2. Browserdaten werden vor HTML-Ausgabe escaped. Externe Links und Bilder durchlaufen eine zentrale Protokollpruefung; `javascript:`, HTML-Daten-URLs und URLs mit eingebetteten Zugangsdaten werden verworfen.
3. Neue Fenster werden ausschliesslich mit `noopener,noreferrer` geoeffnet.
4. Vercel liefert CSP, HSTS, Clickjacking-, MIME-, Referrer-, Permissions- und Cross-Origin-Header aus. Wegen des bestehenden Inline-Skripts und der dynamischen Inline-Styles benoetigt die CSP vorerst `unsafe-inline`; diese Ausnahme wird in Phase 3 entfernt.
5. Interne Backend-Fehler werden nicht mehr an Clients durchgereicht. Logs enthalten nur Ereignis, Fehlerklasse und optional einen kurzen Fehlercode, niemals Request-Bodies, Tokens oder Stacktraces.
6. Collection-Sync weist ungueltige Karten, mehr als 5.000 Karten und Payloads ueber 5 MiB ab, statt sie stillschweigend zu kuerzen.

## Verbleibende Risiken und Folgeschritte

- Kritisch fuer Phase 2: Ein kompletter `PUT` loescht die Sammlung vor dem Neuaufbau. `id` ist weiterhin globaler Primaerschluessel. Transaktion, `(user_id, id)`, UUIDs, Versionierung und Batch-Upserts fehlen noch.
- Hoch fuer Phase 3: `cloud-sync.js`, `card-search-helper.js`, `scan-confirm-helper.js` und `scan-language-helper.js` patchen `window.fetch`; `cloud-sync.js` patcht ausserdem `Storage.prototype.setItem`. Die Helper registrieren teils wiederholt Timer/Event-Handler. Das wird bei der Modularisierung durch explizite Services und einen zentralen State ersetzt.
- Hoch: Die Rate-Limits in Scan, Suche, Preisen und Historie liegen in Prozess-Maps. In Serverless-Instanzen sind sie weder global noch dauerhaft. Eine persistente, atomare Begrenzung ist noetig; dafuer soll die vorhandene Datenbank genutzt werden, ohne einen neuen kostenpflichtigen Dienst einzufuehren.
- Mittel: Die aktuelle CSP erlaubt Inline-Skripte/-Styles. Nach der Extraktion des Inline-Codes in gebaute Assets kann `script-src 'unsafe-inline'` entfernt und die Policy weiter eingeschraenkt werden.
- Mittel: `api/loader-base.js` laedt zur Laufzeit JavaScript von einem gepinnten GitHub-Commit. Der Commit ist unveraenderlich, aber der Laufzeit-Download bleibt eine externe Verfuegbarkeits- und Supply-Chain-Grenze. Das Skript soll in Phase 3 lokal gebundelt werden.
- Mittel: Auth-Login besitzt noch keine persistente Brute-Force-Begrenzung.
- Tests gegen Neon, Browser-End-to-End-Tests und Deployment-Header-Verifikation stehen noch aus. Es wurde keine Preview- oder Produktionsbereitstellung durchgefuehrt.

## Checkout-Hinweis

Der bereitgestellte Workspace war nicht das Repository `f6t7zw67pw-dotcom/TCG-Scanner`. Weil der gebuendelte Git-Client keinen HTTPS-Remote-Helper enthaelt, wurde der oeffentliche `main`-Snapshot als GitHub-Archiv importiert und lokal als Baseline committed. Der Arbeitsbranch ist `codex/phase-1-security-hardening`; Remote und Produktion wurden nicht veraendert.

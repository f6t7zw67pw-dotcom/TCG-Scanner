# Phase 3: Frontend-Modularisierung

Stand: 2026-08-06

## Architektur

Die produktive Einstiegseite ist jetzt eine mit Vite reproduzierbar gebaute React-/TypeScript-Anwendung. Der neue Anwendungscode liegt unter `src/` und trennt UI-Komponenten, typisierte API-Aufrufe, Bildverarbeitung, URL-Erzeugung, lokalen Speicher und globalen Anwendungszustand.

Explizite Bereiche:

- Scanner und Scan-Ergebnis
- Katalogkandidaten und Nutzerbestaetigung
- Multi-Lot mit auf drei Requests begrenzter Parallelitaet und einzeln wiederholbaren Teilfehlern
- Sammlung und Preisanzeige
- Account und inkrementeller Cloud-Sync
- Scan-Historie
- lokale Sprach-/Set-Datenbanken
- Hilfe und Datenschutzhinweis

Die Anwendung patcht weder `window.fetch` noch `Storage.prototype`. Sie verwendet keine globalen Installations-Timer und keinen seitenweiten `MutationObserver`. React registriert die Event-Handler deklarativ an den verantwortlichen Komponenten.

## Datenkompatibilitaet

Bestehende Karten werden weiter aus `cw_collection` gelesen. Bestehende IDs, Versionen und `updatedAt`-Werte bleiben erhalten; fehlende Metadaten werden beim Lesen ergaenzt. Der Cloud-Cursor bleibt unter `cw_cloud_cursor` kompatibel. Eine separate Liste geaenderter IDs verhindert Voll-Uploads nach jeder lokalen Aenderung.

Die vorherige Oberflaeche wurde als `legacy.html` erhalten und wird nicht automatisch geladen. Sie dient waehrend der schrittweisen Migration als manueller Fallback. Der Vite-Build erzeugt sowohl die neue Einstiegseite als auch diesen Fallback und kopiert nur fuer den Fallback die benoetigten klassischen Root-Skripte in das Build-Artefakt.

## Sicherheits- und Produktentscheidungen

- React rendert externe Texte standardmaessig als Text statt ungefiltertes HTML.
- Externe Links werden weiterhin auf HTTP(S), fehlende eingebettete Zugangsdaten und `noopener noreferrer` begrenzt.
- Preise koennen automatisch nur fuer einen zuvor bestaetigten Katalogtreffer angefragt werden.
- Vollstaendige Bilder werden nicht in der Scan-Historie angezeigt oder protokolliert.
- Ein KI-Scan weist in der Oberflaeche vor der Uebertragung auf den externen Dienst hin.
- Es wurden keine Produktionsaenderungen, Deployments oder Produktionsmigrationen ausgefuehrt.

## Verbleibende Risiken

- Einige Spezialfunktionen der alten Helper (erweiterte Alias-Autofixes und einzelne Katalog-Adminaktionen) sind vorlaeufig nur im manuellen Legacy-Fallback vorhanden und muessen vor dessen Entfernung als typisierte Module nachgezogen werden.
- Die CSP erlaubt wegen `legacy.html` weiterhin Inline-Code. Nach Entfernung des Fallbacks kann `unsafe-inline` fuer Skripte entfallen.
- API-Rate-Limits sind weiterhin pro Serverless-Prozess gespeichert und werden in einer spaeteren Phase persistent umgesetzt.
- Browser-End-to-End-Tests mit echten Testkonten und Testbildern gehoeren zu Phase 7.

## Validierung

- TypeScript-Projektpruefung mit `tsc -b`
- reproduzierbarer Vite-Produktions-Build
- 15 bestehende Security-, Preis- und Sync-Tests
- 5 neue Architektur-Regressionstests

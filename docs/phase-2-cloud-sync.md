# Phase 2: Cloud-Sync und Datenintegritaet

Stand: 2026-07-30

## Datenmodell und Migration

`cw_collection_cards` verwendet nun `(user_id, id)` als Primaerschluessel. Bestehende IDs und Payloads bleiben unveraendert erhalten. Neue Eintraege erhalten im Browser oder spaetestens am API-Rand eine UUID. Zusaetzliche Metadaten:

- `version`: monotone Version eines Eintrags
- `client_updated_at`: Zeitstempel der lokalen Aenderung
- `updated_at`: serverseitiger Sync-Zeitstempel und Cursor-Basis
- `deleted_at`: Tombstone statt physischem Loeschen

Die idempotente Migration liegt in `migrations/001_collection_sync_v2.sql`. Sie enthaelt kein `DELETE` oder `TRUNCATE`. Sie wurde nicht gegen die Produktionsdatenbank ausgefuehrt. Vor einer spaeteren Freigabe sollte sie zuerst auf einem isolierten Neon-Branch getestet werden.

## Sync-Protokoll

- `GET /api/collection`: aktiver Vollstand ohne Tombstones.
- `GET /api/collection?since=<cursor>`: nur seit dem Cursor geaenderte Eintraege inklusive Tombstones.
- `POST` oder kompatibles `PUT /api/collection`: atomarer Batch-Upsert ueber ein JSONB-Recordset. Es gibt kein vorheriges Loeschen mehr.
- `DELETE /api/collection` mit `{ "ids": [...] }`: markiert ausschliesslich diese IDs als geloescht. Ein leeres DELETE wird abgewiesen.

Ein Upsert wird nur angenommen, wenn seine Version groesser ist oder bei gleicher Version sein Client-Zeitstempel neuer ist. Wiederholte Requests sind damit idempotent; ein abgebrochener Request kann keinen vorgelagerten Komplett-Delete hinterlassen. Konflikte werden gezaehlt und als `conflicts` gemeldet.

Der Browser speichert den letzten `syncCursor` getrennt unter `cw_cloud_cursor`. Ein normaler Upload ist inkrementell. Ein Pull nach dem ersten Vollstand fuehrt nur Aenderungen zusammen; neuere lokale Eintraege werden nicht von aelteren Cloud-Daten ueberschrieben.

## Bekannte Grenzen

- Das Legacy-Frontend hat keine allgemeine Bearbeitungsoberflaeche fuer gespeicherte Karten. Beim spaeteren Edit-Flow muss jede lokale Mutation `version` erhoehen und `updatedAt` aktualisieren.
- Serverseitige Zeit und Client-Zeit koennen abweichen. Die Version hat deshalb Vorrang; der Zeitstempel entscheidet nur bei gleicher Version.
- Tombstones benoetigen spaeter eine dokumentierte Aufbewahrungs- und Bereinigungsfrist.
- Die API selbst wurde noch nicht als deployte Vercel Function gegen den Testbranch aufgerufen. Migration und SQL-Invarianten wurden jedoch direkt auf dem isolierten Neon-Branch validiert.

## Neon-Validierung am 2026-08-04

- Projekt: `tcg-scanner` (`floral-mountain-34098371`)
- Isolierter Testbranch: `codex-phase2-sync-validation-20260804` (`br-odd-bar-atzla2o0`)
- Parent blieb unveraendert: `br-fancy-resonance-atka9j4z`
- Vor Migration: 4 Sammlungseintraege, 2 Benutzer, Primaerschluessel nur auf `id`
- Nach Migration: weiterhin 4 Sammlungseintraege und 2 Benutzer; Primaerschluessel `(user_id, id)`; alle Bestandszeilen besitzen `version = 1` und `client_updated_at`
- Zwei Testbenutzer konnten dieselbe lokale ID unabhaengig speichern.
- Ein neuerer Versionsstand wurde akzeptiert; ein spaeter gesendeter, aber aelter versionierter Stand wurde abgewiesen.
- Ein Tombstone eines Benutzers beeinflusste den gleichnamigen Eintrag des zweiten Benutzers nicht.
- Eine absichtlich fehlschlagende Mehrschritt-Transaktion hinterliess 0 Zeilen und bestaetigte den Rollback.
- Nach Abschluss: weiterhin 4 Originalzeilen; 0 temporaere Testzeilen.

Es wurde keine Migration auf dem Parent-/Produktionsbranch ausgefuehrt.

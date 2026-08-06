# Phase 4: Karten- und Variantenmodell

## Ergebnis

Card Wizard Pro speichert eine Kartenidentität getrennt von ihrer sammelbaren Variante. Eine Variante wird aus Karten-ID, Sprache, Oberfläche, Edition, Treatment und optionalem Grading gebildet. Menge, Einkaufswert, Verkaufswert und Zustand gehören zum Sammlungsbestand.

## Kanonische Felder

- Karte: `tcg`, `cardId`
- Variante: `variantId`, `language`, `finish`, `edition`, `treatment`, `promo`, `firstEdition`, `gradingProvider`, `grade`, `gradingCert`
- Bestand: `condition`, `quantity`, `purchasePrice`, `saleValue`, `currency`

Die alten Werte `V1` bis `V4` bleiben lesbar und werden ausschließlich als Legacy-Treatments abgebildet. Sie definieren nicht mehr die Oberfläche einer Karte.

## Migration

`migrations/002_card_variant_model.sql` erweitert das bestehende Schema ausschließlich additiv. Bestehende JSON-Daten werden in typisierte Spalten übernommen. Fehlende Varianten-IDs werden deterministisch erzeugt; ungültige Mengen fallen auf `1` zurück. Es werden keine Tabellen oder Bestandsdaten gelöscht.

## Validierung

Die Migration wurde auf dem isolierten Neon-Branch `br-odd-bar-atzla2o0` ausgeführt. Alle vier vorhandenen Datensätze blieben erhalten und erhielten vollständige kanonische Werte. Ein Test mit zwei Oberflächen derselben Karte ergab zwei getrennte Varianten. Eine Mengen- und Wertänderung aktualisierte den vorhandenen Eintrag ohne Duplikat; die Testdaten wurden danach entfernt.

Vor einer Produktivmigration sind Datenbank-Backup beziehungsweise Neon-Restore-Point, Preview-Deployment und ein erneuter Smoke-Test verpflichtend.

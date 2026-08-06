import { Panel } from './Layout';

export function HelpView() {
  return <div className="stack"><Panel title="Hilfe"><div className="help-grid"><article><strong>1 · Bild wählen</strong><p>Fotografiere Karten gerade und mit wenig Spiegelung. Das Bild bleibt lokal, bis du den Scan startest.</p></article><article><strong>2 · Treffer prüfen</strong><p>Bestätige einen Katalogtreffer, bevor du Preise abrufst oder die Karte speicherst.</p></article><article><strong>3 · Synchronisieren</strong><p>Lokale Daten bleiben die Arbeitskopie. Cloud-Push und Pull werden im Account-Bereich bewusst ausgelöst.</p></article><article><strong>Datenschutz</strong><p>Ein KI-Scan überträgt das ausgewählte Bild an den konfigurierten KI-Dienst. Bilder werden nicht in der Scan-Historie gespeichert.</p></article></div></Panel>
    <Panel title="Kompatibilitätsmodus"><p className="muted">Falls während der schrittweisen Migration eine Spezialfunktion fehlt, ist die vorherige Oberfläche vorläufig unter <a href="/legacy.html">legacy.html</a> verfügbar. Sie wird nicht automatisch geladen.</p></Panel></div>;
}

// Stable scan review panel for single-card scans.
(function () {
  const security = window.CardWizardSecurity;
  let latestScan = null;
  let loading = false;

  const JP_NAME_OVERRIDES = {
    'ママンボウ': 'Alomomola'
  };

  function $(id) { return document.getElementById(id); }
  function text(value) { return String(value || '').trim(); }
  function toast(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else console.log(message);
  }
  const escapeHtml = security.escapeHtml;
  function hasAsianText(value) {
    return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(value || ''));
  }
  function latinFallbackName(value) { return JP_NAME_OVERRIDES[text(value)] || ''; }
  function padNumber(value) {
    const raw = String(value || '').trim().toUpperCase();
    if (!raw) return '';
    const parts = raw.split('/');
    const left = parts[0].replace(/\s+/g, '');
    const padded = /^\d{1,2}$/.test(left) ? left.padStart(3, '0') : left;
    if (parts.length <= 1) return padded;
    return `${padded}/${parts.slice(1).join('/').replace(/\s+/g, '')}`;
  }
  function searchNumber(value) { return padNumber(String(value || '').split('/')[0]); }
  function inferVersion(card) {
    const rarity = String(card?.rarity || card?.cardType || '').toLowerCase();
    const name = String(card?.name || card?.originalName || card?.cardmarketName || '').toLowerCase();
    if (card?.cardVersion) return card.cardVersion;
    if (rarity.includes('special illustration')) return 'V3';
    if (rarity.includes('illustration') || rarity.includes('full art')) return 'V2';
    if (rarity.includes('gold') || rarity.includes('secret') || rarity.includes('hyper')) return 'V4';
    if (/\b(ex|gx|v)\b/.test(name)) return 'V1';
    return '';
  }
  function trigger(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = value || '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function selectedCondition() { return $('condition')?.value || 'Near Mint'; }
  function scanInputFromResult(scan) {
    const card = Array.isArray(scan?.cards) ? scan.cards[0] : null;
    return card || {};
  }
  function cardmarketName(name) {
    if (typeof window.buildCMName === 'function') {
      try { return window.buildCMName(name) || name; } catch {}
    }
    return String(name || '')
      .replace(/\s+ex$/i, '-ex')
      .replace(/\s+EX$/i, '-EX')
      .replace(/\s+V$/i, '-V')
      .replace(/\s+GX$/i, '-GX');
  }
  function stableOriginalName(card) {
    return text(card?.originalName || card?.visibleTitle || card?.name || $('originalName')?.value || '');
  }
  function stableCardmarketName(card) {
    const direct = text(card?.cardmarketName);
    if (direct && !hasAsianText(direct)) return cardmarketName(direct);
    const english = text(card?.englishName);
    if (english && !hasAsianText(english)) return cardmarketName(english);
    const mapped = latinFallbackName(card?.cardmarketName) || latinFallbackName(card?.name) || latinFallbackName(card?.originalName) || latinFallbackName(card?.visibleTitle);
    if (mapped) return cardmarketName(mapped);
    const dom = text($('cardmarketName')?.value);
    if (dom && !hasAsianText(dom)) return cardmarketName(dom);
    return cardmarketName(direct || english || card?.name || '');
  }
  function candidatePayload(scan) {
    const card = scanInputFromResult(scan);
    const originalName = stableOriginalName(card);
    const cmName = stableCardmarketName(card);
    const fullNumber = text(card.fullNumber || card.number || $('fullNumber')?.value || $('searchNumber')?.value || '');
    const search = text(card.searchNumber || searchNumber(fullNumber) || $('searchNumber')?.value || '');
    return {
      fast: true,
      name: cmName || originalName,
      originalName,
      cardmarketName: cmName,
      englishName: !hasAsianText(cmName) ? cmName : text(card.englishName || ''),
      visibleTitle: text(card.visibleTitle || (hasAsianText(originalName) ? originalName : '')),
      number: fullNumber || search,
      fullNumber,
      searchNumber: search,
      setCode: card.setCode || $('setCode')?.value || '',
      setName: card.setName || $('setName')?.value || '',
      cardType: card.cardType || '',
      supertype: card.cardType || '',
      languageCode: card.languageCode || '',
      language: card.language || '',
      languageGuess: card.languageGuess || card.language || ''
    };
  }
  async function apiFetch(path, options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(path, {
        credentials: 'same-origin',
        ...(options || {}),
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `Fehler ${response.status}`);
      return data;
    } catch (err) {
      if (err?.name === 'AbortError') throw new Error('Schneller Vorschlag dauert zu lange. Du kannst unten manuell Treffer suchen.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  function addStyle() {
    if ($('cw-scan-panel-style')) return;
    const style = document.createElement('style');
    style.id = 'cw-scan-panel-style';
    style.textContent = `
      .cwScanPanel{margin-top:12px;border:1px solid rgba(89,117,165,.34);border-radius:18px;background:#071426;padding:12px;display:grid;gap:10px;contain:layout paint;position:relative;z-index:1}
      .cwScanHead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .cwScanTitle{font-weight:950;font-size:18px;color:#f5f7fb}.cwScanBadge{border:1px solid rgba(150,170,255,.35);border-radius:999px;padding:6px 10px;background:#102039;color:#dbe7ff;font-size:12px;font-weight:900}
      .cwScanStatus{font-size:13px;color:#a8b3c6;line-height:1.4;border:1px solid rgba(89,117,165,.28);border-radius:14px;padding:10px;background:#06101d}
      .cwScanStatus.ok{color:#c9ffdf;border-color:rgba(33,194,107,.42);background:#062716}.cwScanStatus.warn{color:#ffd7bd;border-color:rgba(255,157,69,.42);background:#321407}
      .cwScanList{display:grid;gap:10px}.cwScanCandidate{display:grid;grid-template-columns:56px minmax(0,1fr);gap:10px;border:1px solid rgba(89,117,165,.28);border-radius:16px;background:#071426;padding:10px;align-items:start;overflow:hidden}
      .cwScanCandidate img{width:56px;height:78px;object-fit:cover;border-radius:8px;background:#050d1a}.cwScanCandidate b{display:block;color:#f5f7fb;line-height:1.2;overflow-wrap:anywhere}.cwScanMeta{color:#a8b3c6;font-size:13px;line-height:1.35;overflow-wrap:anywhere}
      .cwScanHint{margin-top:5px;color:#a8b3c6;font-size:12px;line-height:1.35}.cwScanActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.cwScanActions .btn{min-height:44px;padding:10px 12px}.cwScanSecondary{grid-column:1/-1}
      @media(max-width:620px){.cwScanPanel{margin-bottom:12px;padding:12px}.cwScanCandidate{grid-template-columns:48px minmax(0,1fr)}.cwScanCandidate img{width:48px;height:67px}.cwScanActions{grid-template-columns:1fr}.cwScanSecondary{grid-column:auto}.cwScanActions .btn{width:100%}}
    `;
    document.head.appendChild(style);
  }
  function removeLegacyPanel() {
    const legacy = $('cwConfirmBox');
    if (legacy) legacy.remove();
  }
  function ensurePanel() {
    addStyle();
    removeLegacyPanel();
    let panel = $('cwScanPanel');
    if (panel) return panel;
    const anchor = $('scanStatus') || $('imageBox') || document.querySelector('#scanner .card');
    if (!anchor) return null;
    panel = document.createElement('section');
    panel.id = 'cwScanPanel';
    panel.className = 'cwScanPanel';
    panel.innerHTML = `
      <div class="cwScanHead">
        <div class="cwScanTitle">Scan-Ergebnis pruefen</div>
        <div class="cwScanBadge">Schnellmodus</div>
      </div>
      <div id="cwScanStatus" class="cwScanStatus">Nach dem Scan erscheint hier ein schneller Vorschlag. Genaue API-Treffer kannst du unten weiterhin manuell suchen.</div>
      <div id="cwScanCandidates" class="cwScanList"></div>
    `;
    anchor.insertAdjacentElement('afterend', panel);
    return panel;
  }
  function status(message, type) {
    ensurePanel();
    const el = $('cwScanStatus');
    if (!el) return;
    el.textContent = message;
    el.className = `cwScanStatus ${type || ''}`.trim();
  }
  function scrollToManualSearch() {
    const target = $('singleTcgSearchBtn') || $('originalName') || $('cardmarketName');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (target.focus) setTimeout(() => target.focus({ preventScroll: true }), 350);
  }
  function applyCandidate(card) {
    const full = padNumber(card.number || card.fullNumber || '');
    const originalName = stableOriginalName(card);
    const cmName = stableCardmarketName(card);
    trigger('originalName', originalName || card.name || '');
    trigger('cardmarketName', cmName || cardmarketName(card.name));
    trigger('fullNumber', full);
    trigger('searchNumber', searchNumber(full));
    trigger('setCode', card.setCode || '');
    trigger('setName', card.cardmarketSetName || card.setName || '');
    const version = inferVersion(card);
    if (version) {
      document.querySelectorAll('#typeChips .chip').forEach((chip) => chip.classList.toggle('active', chip.dataset.ver === version));
    }
    if (typeof window.liveSet === 'function') window.liveSet();
    if (typeof window.liveNumber === 'function') window.liveNumber();
    if (typeof window.buildUrl === 'function') window.buildUrl();
  }
  function collectionCardFromCandidate(card) {
    const full = padNumber(card.number || card.fullNumber || $('fullNumber')?.value || '');
    const cmName = stableCardmarketName(card);
    const url = typeof window.buildUrl === 'function' ? window.buildUrl() : ($('cmUrl')?.textContent || '');
    return {
      id: globalThis.crypto?.randomUUID?.() || `card-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      version: 1,
      catalogCardId: card.id || '',
      sourceId: card.sourceId || '',
      originalName: stableOriginalName(card) || $('originalName')?.value || '',
      cardmarketName: cmName || cardmarketName(card.name || $('cardmarketName')?.value || ''),
      fullNumber: full,
      searchNumber: searchNumber(full),
      setCode: card.setCode || $('setCode')?.value || '',
      setName: card.cardmarketSetName || card.setName || $('setName')?.value || '',
      rarity: card.rarity || '',
      price: String($('sellPrice')?.value || '').replace('.', ','),
      ebayPrice: String($('ebayPrice')?.value || '').replace('.', ','),
      shipping: String($('shipping')?.value || '').replace('.', ','),
      condition: selectedCondition(),
      cardVersion: inferVersion(card),
      lotName: '',
      image: card.imageSmall || card.imageLarge || document.querySelector('#imageBox img.thumb')?.src || '',
      imageLarge: card.imageLarge || '',
      cardmarketUrl: url && !url.includes('Noch nicht genug') ? url : '',
      confirmedScanId: latestScan?.scanId || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
  function readStore() {
    try { return JSON.parse(localStorage.getItem('cw_collections_v2') || '') || null; } catch { return null; }
  }
  function normalizeStore(store) {
    const next = store && Array.isArray(store.collections) ? store : { selectedId: 'default', collections: [{ id: 'default', name: 'Hauptsammlung', cards: [] }] };
    if (!next.collections.length) next.collections.push({ id: 'default', name: 'Hauptsammlung', cards: [] });
    if (!next.collections.some((c) => c.id === next.selectedId)) next.selectedId = next.collections[0].id;
    next.collections.forEach((c) => { if (!Array.isArray(c.cards)) c.cards = []; });
    return next;
  }
  function saveToCollection(card) {
    const store = normalizeStore(readStore());
    const selected = store.collections.find((c) => c.id === store.selectedId) || store.collections[0];
    selected.cards = [card, ...(selected.cards || [])];
    localStorage.setItem('cw_collections_v2', JSON.stringify(store));
    localStorage.setItem('cw_collection', JSON.stringify(selected.cards || []));
    window.dispatchEvent(new StorageEvent('storage', { key: 'cw_collection' }));
  }
  async function handleCandidate(card, action) {
    applyCandidate(card);
    if (action === 'manual') {
      status('In die Felder uebernommen. Unten kannst du jetzt die genaue API-Treffersuche starten.', 'ok');
      scrollToManualSearch();
      return;
    }
    if (action === 'apply') {
      status('In die Felder uebernommen. Noch nicht gespeichert.', 'ok');
      toast('Scan-Daten uebernommen');
      return;
    }

    saveToCollection(collectionCardFromCandidate(card));
    let confirmOk = true;
    if (latestScan?.scanId) {
      try {
        await apiFetch('/api/scans/confirm', {
          method: 'POST',
          body: JSON.stringify({ scanId: latestScan.scanId, cardId: card.id || '', card })
        });
      } catch (err) {
        confirmOk = false;
        console.warn('Scan-Confirm konnte nicht gespeichert werden:', err);
      }
    }
    if (window.cwCloudSync?.pushCloud) {
      try { await window.cwCloudSync.pushCloud(true); } catch {}
    }
    status(confirmOk ? 'Gespeichert und mit dem Scan verknuepft.' : 'Lokal gespeichert. Server-Verknuepfung konnte gerade nicht bestaetigt werden.', confirmOk ? 'ok' : 'warn');
    toast(confirmOk ? 'Karte gespeichert' : 'Karte lokal gespeichert');
    if (window.cwScanHistory?.loadHistory) setTimeout(() => window.cwScanHistory.loadHistory().catch(() => {}), 300);
  }
  function renderCandidates(cards) {
    ensurePanel();
    const target = $('cwScanCandidates');
    if (!target) return;
    if (!cards.length) {
      target.innerHTML = `
        <div class="cwScanStatus warn">Kein schneller Vorschlag gefunden. Unten kannst du die genaue API-Treffersuche manuell starten.</div>
        <button class="btn ghost" type="button" id="cwScanManualOnly">Unten manuell pruefen</button>
      `;
      $('cwScanManualOnly')?.addEventListener('click', scrollToManualSearch);
      return;
    }
    target.innerHTML = cards.slice(0, 3).map((card, index) => `
      <article class="cwScanCandidate" data-index="${index}">
        ${security.safeImageUrl(card.imageSmall || card.imageLarge) ? `<img src="${escapeHtml(security.safeImageUrl(card.imageSmall || card.imageLarge))}" alt="">` : '<img alt="">'}
        <div>
          <b>${escapeHtml(stableCardmarketName(card) || card.name || 'Unbekannte Karte')}</b>
          <div class="cwScanMeta">${escapeHtml(card.cardmarketSetName || card.setName || '-')} · ${escapeHtml(card.setCode || '-')} · Nr. ${escapeHtml(card.number || '-')}</div>
          ${card.rarity ? `<div class="cwScanMeta">${escapeHtml(card.rarity)}</div>` : ''}
          <div class="cwScanHint">Schneller Vorschlag aus den Scan-Daten. Fuer genauere Treffer unten manuell suchen.</div>
          <div class="cwScanActions">
            <button class="btn ghost cwScanApply" type="button">In Felder uebernehmen</button>
            <button class="btn primary cwScanSave" type="button">In Sammlung speichern</button>
            <button class="btn ghost cwScanManual cwScanSecondary" type="button">Unten genauer pruefen</button>
          </div>
        </div>
      </article>
    `).join('');
    target.querySelectorAll('.cwScanCandidate').forEach((el) => {
      const card = cards[Number(el.dataset.index)];
      el.querySelector('.cwScanApply').onclick = () => handleCandidate(card, 'apply').catch((err) => status(err.message || 'Uebernehmen fehlgeschlagen.', 'warn'));
      el.querySelector('.cwScanSave').onclick = () => handleCandidate(card, 'save').catch((err) => status(err.message || 'Speichern fehlgeschlagen.', 'warn'));
      el.querySelector('.cwScanManual').onclick = () => handleCandidate(card, 'manual').catch((err) => status(err.message || 'Pruefen fehlgeschlagen.', 'warn'));
    });
  }
  async function loadCandidates(scan) {
    if (loading) return;
    loading = true;
    try {
      latestScan = scan;
      status('Schneller Vorschlag wird vorbereitet...');
      const data = await apiFetch('/api/card-search', {
        method: 'POST',
        body: JSON.stringify(candidatePayload(scan))
      });
      latestScan = { ...scan, candidates: data.cards || [] };
      renderCandidates(data.cards || []);
      status((data.cards || []).length ? 'Schneller Vorschlag bereit. Waehle jetzt eine Aktion.' : 'Kein schneller Vorschlag gefunden.', (data.cards || []).length ? 'ok' : 'warn');
    } catch (err) {
      renderCandidates([]);
      status(err.message || 'Schneller Vorschlag konnte nicht geladen werden.', 'warn');
    } finally {
      loading = false;
    }
  }
  function patchScanFetch() {
    if (window.__cwScanPanelFetchPatched) return;
    window.__cwScanPanelFetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = String(init?.method || 'GET').toUpperCase();
      if (url.startsWith('/api/scan') && method === 'POST') {
        response.clone().json().then((data) => {
          if (data?.ok && Array.isArray(data.cards) && data.cards.length) {
            setTimeout(() => loadCandidates(data), 120);
          }
        }).catch(() => {});
      }
      return response;
    };
  }
  function install() {
    ensurePanel();
    patchScanFetch();
  }

  window.cwScanConfirm = { loadCandidates, applyCandidate };
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 700);
    setTimeout(install, 1700);
  });
})();

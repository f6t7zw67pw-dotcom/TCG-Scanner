// Stable manual search UI and full i18n alias DB panels.
(function () {
  if (window.__cwStableSearchHelper) return;
  window.__cwStableSearchHelper = true;

  function $(id) { return document.getElementById(id); }
  function text(value) { return String(value || '').trim(); }
  function toast(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else console.log(message);
  }
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  }
  function toCardmarketName(value) {
    return text(value)
      .replace(/\s+ex$/i, '-ex')
      .replace(/\s+EX$/i, '-EX')
      .replace(/\s+V$/i, '-V')
      .replace(/\s+GX$/i, '-GX');
  }
  function localAlias(value) {
    if (typeof window.cwNameAliasLookup !== 'function') return '';
    try { return text(window.cwNameAliasLookup(value)); } catch { return ''; }
  }
  function setValue(id, value) {
    const el = $(id);
    if (!el) return;
    el.value = value || '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function requestBodyFromSingle() {
    const originalName = text($('originalName')?.value);
    const alias = localAlias(originalName) || localAlias($('cardmarketName')?.value);
    const cardmarketName = alias ? toCardmarketName(alias) : text($('cardmarketName')?.value);
    return {
      name: cardmarketName || originalName,
      originalName,
      cardmarketName,
      englishName: alias || cardmarketName,
      number: text($('fullNumber')?.value || $('searchNumber')?.value),
      fullNumber: text($('fullNumber')?.value),
      searchNumber: text($('searchNumber')?.value),
      setCode: text($('setCode')?.value),
      setName: text($('setName')?.value),
      languageCode: text(document.querySelector('#langChips .chip.active')?.dataset?.code || ''),
      language: text(document.querySelector('#langChips .chip.active')?.dataset?.label || '')
    };
  }
  async function fetchCards(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch('/api/card-search', {
        method: 'POST',
        credentials: 'same-origin',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error || `Fehler ${response.status}`);
      return Array.isArray(data.cards) ? data.cards.slice(0, 5) : [];
    } catch (err) {
      if (err?.name === 'AbortError') throw new Error('Treffersuche dauert zu lange. Bitte Name, Nummer oder Set pruefen.');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  function applyCard(card) {
    setValue('originalName', card.name || card.originalName || '');
    setValue('cardmarketName', card.cardmarketName || toCardmarketName(card.name || ''));
    setValue('fullNumber', card.number || card.fullNumber || '');
    setValue('searchNumber', String(card.number || card.searchNumber || '').split('/')[0]);
    setValue('setCode', card.setCode || '');
    setValue('setName', card.cardmarketSetName || card.setName || '');
    if (typeof window.buildUrl === 'function') window.buildUrl();
    toast('Treffer uebernommen');
  }
  function renderCards(cards) {
    const target = $('singleMatches');
    if (!target) return;
    const box = document.createElement('div');
    box.className = 'matchBox';
    box.innerHTML = `<b>Treffer aus Katalog/API (${cards.length})</b>`;
    if (!cards.length) {
      box.innerHTML += '<div class="small">Keine Treffer. Pruefe englischen Namen, Nummer und Set.</div>';
    }
    cards.forEach((card, index) => {
      const item = document.createElement('div');
      item.className = 'matchItem';
      item.innerHTML = `
        <img loading="lazy" decoding="async" src="${escapeHtml(card.imageSmall || '')}" alt="">
        <div>
          <b>${escapeHtml(card.cardmarketName || card.name || '-')}</b>
          <div class="small">${escapeHtml(card.setName || '-')} · ${escapeHtml(card.setCode || '-')} · ${escapeHtml(card.number || '-')} · ${escapeHtml(card.rarity || '')}</div>
          <div class="actions"><button class="miniBtn use" type="button" data-index="${index}">Uebernehmen</button></div>
        </div>
      `;
      box.appendChild(item);
    });
    target.innerHTML = '';
    target.appendChild(box);
    target.querySelectorAll('.use').forEach((button) => {
      button.onclick = () => applyCard(cards[Number(button.dataset.index)] || {});
    });
  }
  async function stableSingleSearch(button) {
    const target = $('singleMatches');
    if (!target) return;
    const oldText = button?.textContent || 'Treffer suchen';
    if (button) {
      button.disabled = true;
      button.textContent = 'Suche...';
    }
    target.innerHTML = '<div class="matchBox">Suche Treffer stabil...</div>';
    try {
      const cards = await fetchCards(requestBodyFromSingle());
      renderCards(cards);
    } catch (err) {
      target.innerHTML = `<div class="matchBox">Fehler: ${escapeHtml(err.message || 'Treffersuche fehlgeschlagen.')}</div>`;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText;
      }
    }
  }
  function installSearchOverride() {
    const button = $('singleTcgSearchBtn');
    if (!button || button.dataset.cwStableSearch === '1') return;
    button.dataset.cwStableSearch = '1';
    button.onclick = null;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      stableSingleSearch(button);
    }, true);
  }
  function formatAliases(items) {
    return items.map((item) => `${item.alias}: ${item.englishName}`).join('\n');
  }
  async function loadAliasLanguage(language, targetId, label) {
    const target = $(targetId);
    if (!target) return;
    target.value = `${label} wird geladen...`;
    const response = await fetch('/api/card-search', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listPokemonAliases', language, limit: 1200 })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || `${label} konnte nicht geladen werden.`);
    target.value = formatAliases(data.aliases || []);
    const hint = $('i18nAliasDbHint');
    if (hint) hint.textContent = `${label}: ${data.count || 0} Eintraege geladen.`;
  }
  function installI18nDbPanels() {
    const db = $('db');
    if (!db || $('jpPokemonAliasDb')) return;
    const card = document.createElement('div');
    card.className = 'card wide';
    card.innerHTML = `
      <div class="title"><h2>Japanisch -> Englisch DB</h2><span class="badge">Pokemon 1025</span></div>
      <div class="small">Direkt aus Neon/PokeAPI. Format wie bei Deutsch: Japanischer Name: Englischer Name.</div>
      <textarea id="jpPokemonAliasDb" style="min-height:320px" spellcheck="false">Noch nicht geladen.</textarea>
      <div class="actions">
        <button class="btn primary" id="loadJpPokemonAliasDb" type="button">Japanisch DB laden</button>
        <button class="btn ghost" id="copyJpPokemonAliasDb" type="button">Kopieren</button>
      </div>
      <div id="i18nAliasDbHint" class="small">Danach bauen wir Chinesisch -> Englisch genauso darunter.</div>
    `;
    db.appendChild(card);
    $('loadJpPokemonAliasDb').onclick = () => loadAliasLanguage('ja-hrkt', 'jpPokemonAliasDb', 'Japanisch -> Englisch').catch((err) => {
      $('jpPokemonAliasDb').value = `Fehler: ${err.message}`;
    });
    $('copyJpPokemonAliasDb').onclick = async () => {
      await navigator.clipboard.writeText($('jpPokemonAliasDb')?.value || '');
      toast('Japanisch DB kopiert');
    };
  }
  function install() {
    installSearchOverride();
    installI18nDbPanels();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();

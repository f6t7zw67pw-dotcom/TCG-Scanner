// Server-side price lookup UI. No provider credentials are stored in the browser.
(function () {
  function $(id) { return document.getElementById(id); }
  function toast(text) {
    if (typeof window.toast === 'function') window.toast(text);
    else console.log(text);
  }
  function money(amount, currency) {
    if (!Number.isFinite(Number(amount))) return '';
    return `${Number(amount).toFixed(2).replace('.', ',')} ${currency || 'EUR'}`;
  }
  function selectedLanguage() {
    return document.querySelector('#langChips .chip.active')?.dataset.label || '';
  }
  function selectedCondition() {
    return $('condition')?.value || '';
  }
  function singlePayload() {
    return {
      name: $('originalName')?.value || $('cardmarketName')?.value || '',
      cardmarketName: $('cardmarketName')?.value || '',
      number: $('fullNumber')?.value || $('searchNumber')?.value || '',
      setCode: $('setCode')?.value || '',
      setName: $('setName')?.value || '',
      condition: selectedCondition(),
      language: selectedLanguage(),
      cardmarketUrl: $('cmUrl')?.textContent?.startsWith('http') ? $('cmUrl').textContent : ''
    };
  }
  function status(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `cwPriceStatus ${type || ''}`.trim();
  }
  async function fetchPrice(payload) {
    const response = await fetch('/api/prices', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || data.message || `Fehler ${response.status}`);
    return data;
  }
  function renderPriceResult(target, data, onUse) {
    const price = data.price;
    if (!price) {
      target.innerHTML = '<div class="cwPriceEmpty">Aktuell kein Preis verfuegbar.</div>';
      return;
    }
    target.innerHTML = `
      <div class="cwPriceResult">
        <div><b>${money(price.amount, price.currency)}</b><span>${price.cardName || ''}</span></div>
        <div class="small">${price.set || price.setCode || ''} ${price.number ? '· ' + price.number : ''}</div>
        <div class="small">Quelle: ${price.source || 'Preisprovider'} · ${new Date(price.fetchedAt).toLocaleString('de-DE')}</div>
        <div class="actions"><button class="btn primary cwUsePrice" type="button">Preis uebernehmen</button>${price.url ? '<button class="btn ghost cwOpenPrice" type="button">Quelle oeffnen</button>' : ''}</div>
      </div>
    `;
    target.querySelector('.cwUsePrice').onclick = () => onUse(price);
    const open = target.querySelector('.cwOpenPrice');
    if (open) open.onclick = () => window.open(price.url, '_blank');
  }
  function addStyle() {
    if ($('cw-price-style')) return;
    const style = document.createElement('style');
    style.id = 'cw-price-style';
    style.textContent = `
      .cwPriceBox{margin-top:12px;border:1px solid rgba(89,117,165,.32);border-radius:18px;background:linear-gradient(180deg,rgba(8,18,33,.98),rgba(5,13,26,.98));padding:12px;display:grid;gap:10px}
      .cwPriceHead{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:900}
      .cwPriceStatus,.cwPriceEmpty{font-size:13px;color:#a8b3c6;line-height:1.4;border:1px solid rgba(89,117,165,.28);border-radius:14px;padding:10px;background:#071426}
      .cwPriceStatus.ok{color:#c9ffdf;border-color:rgba(33,194,107,.42);background:#062716}
      .cwPriceStatus.warn{color:#ffd7bd;border-color:rgba(255,157,69,.42);background:#321407}
      .cwPriceResult{display:grid;gap:7px;border:1px solid rgba(33,194,107,.35);background:#062716;border-radius:14px;padding:10px;color:#dfffea}
      .cwPriceResult b{font-size:22px;margin-right:8px}
      .cwPriceResult span{color:#c9ffdf;font-weight:800}
    `;
    document.head.appendChild(style);
  }
  function ensureSinglePriceBox() {
    const sellPrice = $('sellPrice');
    if (!sellPrice || $('cwSinglePriceBox')) return;
    const box = document.createElement('div');
    box.id = 'cwSinglePriceBox';
    box.className = 'cwPriceBox';
    box.innerHTML = `
      <div class="cwPriceHead"><span>Preisabfrage</span><span class="badge">Server</span></div>
      <button class="btn ghost" id="cwFetchSinglePrice" type="button">Preis abrufen</button>
      <div id="cwSinglePriceStatus" class="cwPriceStatus">Preis wird erst nach Klick serverseitig abgefragt.</div>
      <div id="cwSinglePriceResult"></div>
    `;
    sellPrice.parentElement.parentElement.parentNode.insertBefore(box, sellPrice.parentElement.parentElement);
    $('cwFetchSinglePrice').onclick = async () => {
      const statusEl = $('cwSinglePriceStatus');
      const resultEl = $('cwSinglePriceResult');
      status(statusEl, 'Preis wird geladen...');
      resultEl.innerHTML = '';
      try {
        const data = await fetchPrice(singlePayload());
        status(statusEl, data.cached ? 'Preis aus Cache geladen.' : 'Preis frisch geladen.', 'ok');
        renderPriceResult(resultEl, data, (price) => {
          $('sellPrice').value = String(price.amount).replace('.', ',');
          $('sellPrice').dispatchEvent(new Event('input', { bubbles: true }));
          toast('Preis uebernommen');
        });
      } catch (err) {
        status(statusEl, err.message || 'Preisabfrage fehlgeschlagen.', 'warn');
      }
    };
  }
  function readMultiPayload(cardEl) {
    const field = (key) => cardEl.querySelector(`input[data-k="${key}"]`)?.value || '';
    const urlText = cardEl.querySelector('.url')?.textContent || '';
    return {
      name: field('originalName') || field('cardmarketName'),
      cardmarketName: field('cardmarketName'),
      number: field('fullNumber'),
      setCode: field('setCode'),
      setName: field('setName'),
      condition: selectedCondition(),
      language: selectedLanguage(),
      cardmarketUrl: urlText.startsWith('http') ? urlText : ''
    };
  }
  function ensureMultiPriceBox(cardEl) {
    if (!cardEl || cardEl.querySelector('.cwMultiPriceBox')) return;
    const priceInput = cardEl.querySelector('input[data-k="cmPrice"]');
    if (!priceInput) return;
    const box = document.createElement('div');
    box.className = 'cwPriceBox cwMultiPriceBox';
    box.innerHTML = `
      <div class="cwPriceHead"><span>Preisabfrage</span><span class="badge">Server</span></div>
      <button class="btn ghost cwFetchMultiPrice" type="button">Preis abrufen</button>
      <div class="cwPriceStatus">Noch nicht abgefragt.</div>
      <div class="cwMultiPriceResult"></div>
    `;
    priceInput.parentNode.insertBefore(box, priceInput.nextSibling);
    box.querySelector('.cwFetchMultiPrice').onclick = async () => {
      const statusEl = box.querySelector('.cwPriceStatus');
      const resultEl = box.querySelector('.cwMultiPriceResult');
      status(statusEl, 'Preis wird geladen...');
      resultEl.innerHTML = '';
      try {
        const data = await fetchPrice(readMultiPayload(cardEl));
        status(statusEl, data.cached ? 'Preis aus Cache geladen.' : 'Preis frisch geladen.', 'ok');
        renderPriceResult(resultEl, data, (price) => {
          priceInput.value = String(price.amount).replace('.', ',');
          priceInput.dispatchEvent(new Event('input', { bubbles: true }));
          toast('Preis uebernommen');
        });
      } catch (err) {
        status(statusEl, err.message || 'Preisabfrage fehlgeschlagen.', 'warn');
      }
    };
  }
  function enhanceMulti() {
    document.querySelectorAll('#multiResults .resultCard').forEach(ensureMultiPriceBox);
  }
  function install() {
    addStyle();
    ensureSinglePriceBox();
    enhanceMulti();
    const multi = $('multiResults');
    if (multi && !window.__cwPriceObserver) {
      window.__cwPriceObserver = new MutationObserver(() => setTimeout(enhanceMulti, 60));
      window.__cwPriceObserver.observe(multi, { childList: true, subtree: true });
    }
  }
  window.addEventListener('load', () => {
    install();
    setTimeout(install, 500);
    setTimeout(install, 1500);
  });
})();

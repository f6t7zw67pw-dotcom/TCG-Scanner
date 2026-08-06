// TCG API Match UI v1
// Einbindung in index.html direkt vor </body>:
// <script src="tcg-api-ui.js"></script>

(function(){
  const security = window.CardWizardSecurity;
  function $(id){ return document.getElementById(id); }
  function toast(t){
    const el = $('toast');
    if(el){ el.textContent = t; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2300); }
    else alert(t);
  }
  function norm(v){ return String(v || '').trim(); }

  function ensureStyle(){
    if(document.getElementById('tcgMatchStyle')) return;
    const style = document.createElement('style');
    style.id = 'tcgMatchStyle';
    style.textContent = `
      .tcgMatchBox{margin-top:14px;border:1px solid rgba(89,117,165,.32);border-radius:18px;background:linear-gradient(180deg,rgba(8,18,33,.98),rgba(5,13,26,.98));padding:12px;display:grid;gap:10px}
      .tcgMatchTitle{font-weight:900;color:#f4f7fb;font-size:16px;display:flex;justify-content:space-between;gap:8px;align-items:center}
      .tcgMatchItem{display:grid;grid-template-columns:58px 1fr;gap:10px;align-items:center;border:1px solid rgba(89,117,165,.28);background:#071426;border-radius:16px;padding:8px}
      .tcgMatchItem img{width:58px;height:80px;object-fit:cover;border-radius:10px;background:#020814}
      .tcgMatchItem b{display:block;margin-bottom:3px}
      .tcgMatchMeta{font-size:12px;color:#a7b1c2;line-height:1.35}
      .tcgMatchActions{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}
      .tcgMiniBtn{border:0;border-radius:999px;background:linear-gradient(135deg,#7c3cff,#246bff);color:white;padding:8px 10px;font-weight:850;font-size:12px}
      .tcgGhostBtn{background:#13233a;border:1px solid #304663}
    `;
    document.head.appendChild(style);
  }

  async function searchTcgCards(scan){
    const response = await fetch('/api/card-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: scan.originalName || scan.cardmarketName || scan.name || '',
        number: scan.fullNumber || scan.searchNumber || '',
        setCode: scan.setCode || ''
      })
    });
    const data = await response.json();
    if(!data.ok) throw new Error(data.error || 'Kartensuche fehlgeschlagen');
    return data.cards || [];
  }

  function toCardmarketName(name){
    return String(name || '')
      .replace(/\s+ex$/i, '-ex')
      .replace(/\s+EX$/i, '-EX')
      .replace(/\s+V$/i, '-V')
      .replace(/\s+GX$/i, '-GX')
      .trim();
  }

  function applySingleMatch(card){
    if($('originalName')) $('originalName').value = card.name || '';
    if($('cardmarketName')) $('cardmarketName').value = card.cardmarketName || toCardmarketName(card.name);
    if($('fullNumber')) $('fullNumber').value = card.number || '';
    if($('searchNumber')) $('searchNumber').value = (card.number || '').split('/')[0];
    if($('setCode')) $('setCode').value = card.setCode || '';
    if($('setName')) $('setName').value = card.setName || '';
    if(typeof window.buildUrl === 'function') window.buildUrl();
    toast('Treffer übernommen');
  }

  function patchMultiCard(index, card){
    if(!Array.isArray(window.multiCards) && typeof multiCards === 'undefined') return false;
    const arr = window.multiCards || multiCards;
    if(!arr[index]) return false;
    arr[index].originalName = card.name || arr[index].originalName || '';
    arr[index].cardmarketName = card.cardmarketName || toCardmarketName(card.name);
    arr[index].fullNumber = card.number || arr[index].fullNumber || '';
    arr[index].searchNumber = (card.number || '').split('/')[0] || arr[index].searchNumber || '';
    arr[index].setCode = card.setCode || arr[index].setCode || '';
    arr[index].setName = card.setName || arr[index].setName || '';
    if(typeof window.renderMulti === 'function') window.renderMulti();
    return true;
  }

  function renderMatches(target, cards, mode, index){
    ensureStyle();
    target.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'tcgMatchBox';
    box.innerHTML = `<div class="tcgMatchTitle"><span>Treffer aus Pokémon TCG API</span><span>${cards.length}</span></div>`;
    if(!cards.length){
      box.innerHTML += '<div class="tcgMatchMeta">Keine Treffer gefunden. Versuche den englischen Namen oder nur den Namen ohne ex/V/GX.</div>';
    }
    cards.forEach(card => {
      const item = document.createElement('div');
      item.className = 'tcgMatchItem';
      item.innerHTML = `
        <img${security.safeImageUrl(card.imageSmall) ? ` src="${security.escapeHtml(security.safeImageUrl(card.imageSmall))}"` : ''} alt="">
        <div>
          <b>${security.escapeHtml(card.name || '-')}</b>
          <div class="tcgMatchMeta">${security.escapeHtml(card.setName || '-')} · ${security.escapeHtml(card.setCode || '-')} · ${security.escapeHtml(card.number || '-')} · ${security.escapeHtml(card.rarity || '')}</div>
          <div class="tcgMatchActions">
            <button class="tcgMiniBtn useMatch" type="button">Übernehmen</button>
            ${security.safeHttpUrl(card.imageLarge) ? `<button class="tcgMiniBtn tcgGhostBtn openImg" type="button">Bild</button>` : ''}
          </div>
        </div>
      `;
      item.querySelector('.useMatch').onclick = () => {
        if(mode === 'multi') patchMultiCard(index, card);
        else applySingleMatch(card);
      };
      const imgBtn = item.querySelector('.openImg');
      if(imgBtn) imgBtn.onclick = () => security.openExternal(card.imageLarge);
      box.appendChild(item);
    });
    target.appendChild(box);
  }

  async function searchSingleMatches(){
    const scan = {
      originalName: $('originalName')?.value || '',
      cardmarketName: $('cardmarketName')?.value || '',
      fullNumber: $('fullNumber')?.value || '',
      searchNumber: $('searchNumber')?.value || '',
      setCode: $('setCode')?.value || ''
    };
    const target = $('singleTcgMatches') || createSingleBox();
    target.innerHTML = '<div class="tcgMatchBox">Suche Treffer...</div>';
    try{ renderMatches(target, await searchTcgCards(scan), 'single'); }
    catch(e){ target.textContent = `Fehler: ${e.message || 'Kartensuche fehlgeschlagen'}`; }
  }

  function createSingleBox(){
    ensureStyle();
    const anchor = $('cmUrl') || $('nameHint') || $('singleArea');
    const wrap = document.createElement('div');
    wrap.id = 'singleTcgMatches';
    if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    return wrap;
  }

  function addSingleButton(){
    if(document.getElementById('tcgSingleSearchBtn')) return;
    const host = $('nameHint')?.parentNode || $('singleArea');
    if(!host) return;
    const btn = document.createElement('button');
    btn.id = 'tcgSingleSearchBtn';
    btn.type = 'button';
    btn.className = 'btn ghost';
    btn.textContent = 'Treffer suchen';
    btn.onclick = searchSingleMatches;
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.appendChild(btn);
    const hint = $('nameHint');
    if(hint && hint.parentNode) hint.parentNode.insertBefore(actions, hint.nextSibling);
    else host.appendChild(actions);
  }

  window.searchTcgCards = searchTcgCards;
  window.showSingleTcgMatches = searchSingleMatches;
  window.renderTcgMatches = renderMatches;

  window.addEventListener('load', function(){
    ensureStyle();
    addSingleButton();
    const status = $('scanStatus');
    if(status && !status.dataset.tcgUi){
      status.dataset.tcgUi = '1';
      status.textContent = status.textContent + ' · TCG-Trefferliste geladen.';
    }
  });
})();

// Keeps mobile input fields focusable and makes the image picker reliable on phones.
(function () {
  if (window.__cwMobileInputHelper) return;
  window.__cwMobileInputHelper = true;

  const FIELD_SELECTOR = 'input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select';

  function isField(target) {
    return target && target.closest && target.closest(FIELD_SELECTOR);
  }

  function markFields() {
    document.querySelectorAll(FIELD_SELECTOR).forEach((field) => {
      field.removeAttribute('readonly');
      field.disabled = false;
      field.style.pointerEvents = 'auto';
      field.style.userSelect = 'text';
      field.style.webkitUserSelect = 'text';
      field.style.touchAction = field.tagName === 'SELECT' ? 'manipulation' : 'auto';
    });
  }

  function focusField(field) {
    if (!field || field.disabled || field.readOnly) return;
    try { field.focus({ preventScroll: true }); } catch { field.focus(); }
    if ((field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') && typeof field.setSelectionRange === 'function') {
      const len = String(field.value || '').length;
      try { field.setSelectionRange(len, len); } catch {}
    }
  }

  function focusEventTarget(event) {
    const field = isField(event.target);
    if (!field) return;
    focusField(field);
  }

  function installTouchFocus() {
    if (document.documentElement.dataset.cwMobileInputFocus === '1') return;
    document.documentElement.dataset.cwMobileInputFocus = '1';

    document.addEventListener('touchstart', focusEventTarget, true);
    document.addEventListener('touchend', focusEventTarget, true);

    document.addEventListener('pointerdown', (event) => {
      if (event.pointerType && event.pointerType !== 'touch') return;
      focusEventTarget(event);
    }, true);

    document.addEventListener('pointerup', (event) => {
      if (event.pointerType && event.pointerType !== 'touch') return;
      focusEventTarget(event);
    }, true);

    document.addEventListener('click', focusEventTarget, true);
  }

  function installFilePicker() {
    const input = document.getElementById('imageInput');
    if (!input) return;

    input.disabled = false;
    input.removeAttribute('capture');
    input.setAttribute('accept', 'image/*');
    input.style.pointerEvents = 'none';

    const label = document.querySelector('label.btn.primary');
    if (label && label.textContent.includes('Foto')) {
      label.setAttribute('for', 'imageInput');
      label.classList.remove('cwFilePick');
    }

    const altButton = document.getElementById('pickImageBtn');
    if (altButton && altButton.dataset.cwMobilePicker !== '1') {
      altButton.dataset.cwMobilePicker = '1';
      altButton.addEventListener('click', () => {
        const picker = document.getElementById('imageInput');
        if (!picker) return;
        picker.disabled = false;
        picker.value = '';
        picker.click();
      }, true);
    }
  }

  function installStyle() {
    if (document.getElementById('cw-mobile-input-style')) return;
    const style = document.createElement('style');
    style.id = 'cw-mobile-input-style';
    style.textContent = `
      input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea, select {
        -webkit-user-select: text !important;
        user-select: text !important;
        pointer-events: auto !important;
        position: relative;
        z-index: 2;
      }
      input:focus, textarea:focus, select:focus {
        border-color: #7c3cff !important;
        box-shadow: 0 0 0 2px rgba(124,60,255,.25) !important;
      }
      #imageInput {
        position: fixed !important;
        left: 0 !important;
        top: 0 !important;
        width: 1px !important;
        height: 1px !important;
        opacity: .01 !important;
        pointer-events: none !important;
        z-index: -1 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function install() {
    installStyle();
    markFields();
    installTouchFocus();
    installFilePicker();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install();
  window.addEventListener('load', () => {
    install();
    setTimeout(markFields, 300);
    setTimeout(markFields, 1000);
    setTimeout(installFilePicker, 300);
    setTimeout(installFilePicker, 1000);
  });
  new MutationObserver(() => {
    setTimeout(markFields, 20);
    setTimeout(installFilePicker, 20);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();

(function installCardWizardSecurity(global) {
  'use strict';

  const HTML_ESCAPE = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  });

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ESCAPE[character]);
  }

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value ?? '').trim());
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
      return url.href;
    } catch {
      return '';
    }
  }

  function safeImageUrl(value) {
    const raw = String(value ?? '').trim();
    if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw;
    return safeHttpUrl(raw);
  }

  function openExternal(value) {
    const url = safeHttpUrl(value);
    if (!url || typeof global.open !== 'function') return null;
    const opened = global.open(url, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
    return opened;
  }

  function setExternalLink(anchor, value) {
    const url = safeHttpUrl(value);
    if (!anchor) return false;
    if (!url) {
      anchor.removeAttribute('href');
      return false;
    }
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    return true;
  }

  global.CardWizardSecurity = Object.freeze({
    escapeAttribute: escapeHtml,
    escapeHtml,
    openExternal,
    safeHttpUrl,
    safeImageUrl,
    setExternalLink
  });
})(globalThis);

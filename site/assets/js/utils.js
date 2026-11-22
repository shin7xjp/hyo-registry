/**
 * Hyo Registry — Shared Utilities
 */

import { icons } from './icons.js';

/**
 * Copy text to clipboard and show visual feedback on a button.
 */
export async function copyToClipboard(text, btnEl) {
  try {
    await navigator.clipboard.writeText(text);
    if (btnEl) {
      btnEl.classList.add('copied');
      btnEl.innerHTML = icons.check;
      setTimeout(() => {
        btnEl.classList.remove('copied');
        btnEl.innerHTML = icons.copy;
      }, 1600);
    }
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    if (btnEl) {
      btnEl.classList.add('copied');
      btnEl.innerHTML = icons.check;
      setTimeout(() => {
        btnEl.classList.remove('copied');
        btnEl.innerHTML = icons.copy;
      }, 1600);
    }
  }
}

/**
 * Create an element with optional classes and innerHTML.
 */
export function el(tag, className, innerHTML) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (innerHTML !== undefined) e.innerHTML = innerHTML;
  return e;
}

/**
 * Debounce a function.
 */
export function debounce(fn, ms = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Render a package card element.
 */
export function renderPackageCard(pkg) {
  const card = el('a', 'pkg-card fade-in');
  card.href = `package.html?name=${encodeURIComponent(pkg.name)}`;

  const depCount = Object.keys(pkg.dependencies || {}).length;
  const permCount = (pkg.permissions || []).length;

  card.innerHTML = `
    <div class="pkg-card-header">
      <span class="pkg-name">${escapeHtml(pkg.name)}</span>
      <span class="pkg-version">v${escapeHtml(pkg.latestVersion)}</span>
    </div>
    <p class="pkg-desc">${escapeHtml(pkg.description || 'No description')}</p>
    <div class="pkg-meta">
      <span class="pkg-meta-item">
        ${icons.layers}
        ${pkg.versionCount} version${pkg.versionCount !== 1 ? 's' : ''}
      </span>
      ${depCount > 0 ? `<span class="pkg-meta-item">${icons.puzzle} ${depCount} dep${depCount !== 1 ? 's' : ''}</span>` : ''}
      ${permCount > 0 ? `<span class="pkg-meta-item">${icons.shield} ${permCount} perm${permCount !== 1 ? 's' : ''}</span>` : ''}
    </div>
  `;

  return card;
}

/**
 * Render a skeleton card for loading states.
 */
export function renderSkeletonCard() {
  const card = el('div', 'pkg-card');
  card.innerHTML = `
    <div class="pkg-card-header">
      <div class="skeleton" style="width:140px;height:18px"></div>
      <div class="skeleton" style="width:50px;height:20px;border-radius:100px"></div>
    </div>
    <div style="margin-bottom:var(--space-md)">
      <div class="skeleton" style="width:100%;height:14px;margin-bottom:6px"></div>
      <div class="skeleton" style="width:70%;height:14px"></div>
    </div>
    <div class="pkg-meta">
      <div class="skeleton" style="width:80px;height:14px"></div>
    </div>
  `;
  return card;
}

/**
 * Render an error banner.
 */
export function renderError(message, onRetry) {
  const banner = el('div', 'error-banner');
  banner.innerHTML = `
    ${icons.alert}
    <span>${escapeHtml(message)}</span>
  `;
  if (onRetry) {
    const btn = el('button', '', 'Retry');
    btn.addEventListener('click', onRetry);
    banner.appendChild(btn);
  }
  return banner;
}

/**
 * Render an empty state.
 */
export function renderEmptyState(title, description) {
  const wrap = el('div', 'empty-state');
  wrap.innerHTML = `
    ${icons.empty}
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)}</p>
  `;
  return wrap;
}

/**
 * Render a loading state.
 */
export function renderLoading(message = 'Loading packages…') {
  const wrap = el('div', 'loading-state');
  wrap.innerHTML = `
    <div class="spinner"></div>
    <span>${escapeHtml(message)}</span>
  `;
  return wrap;
}

/**
 * Escape HTML special chars.
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


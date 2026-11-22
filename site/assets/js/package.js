/**
 * Hyo Registry — Package Detail Page
 */

import { getPackage } from './registry.js';
import { icons } from './icons.js';
import { copyToClipboard, escapeHtml, el, renderError, renderLoading } from './utils.js';

let currentPkg = null;
let currentVersion = null;

export async function initPackagePage() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name');
  const container = document.getElementById('pkg-detail');

  if (!name) {
    container.innerHTML = '';
    container.appendChild(renderError('No package name specified.'));
    return;
  }

  // Show loading
  container.innerHTML = '';
  container.appendChild(renderLoading('Loading package details…'));

  try {
    const pkg = await getPackage(name);

    if (!pkg) {
      container.innerHTML = '';
      container.appendChild(renderError(`Package "${name}" not found in the registry.`));
      return;
    }

    currentPkg = pkg;
    const versionKeys = Object.keys(pkg.versions).sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        const diff = (pb[i] || 0) - (pa[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });

    currentVersion = versionKeys[0] || pkg.latestVersion;
    renderDetail(container, pkg, currentVersion, versionKeys);

  } catch (err) {
    container.innerHTML = '';
    container.appendChild(renderError(
      `Failed to load package: ${err.message}`,
      () => initPackagePage()
    ));
  }
}

function renderDetail(container, pkg, version, versionKeys) {
  const meta = pkg.versions[version] || {};
  const deps = meta.dependencies || {};
  const perms = meta.permissions || [];
  const depEntries = Object.entries(deps);

  // Set page title
  document.title = `${pkg.name} — Hyo Registry`;

  container.innerHTML = `
    <!-- Header -->
    <div class="detail-header">
      <div class="container">
        <div class="detail-breadcrumb">
          <a href="index.html">Registry</a>
          <span class="sep">/</span>
          <a href="index.html#packages">Packages</a>
          <span class="sep">/</span>
          <span>${escapeHtml(pkg.name)}</span>
        </div>

        <div class="detail-title-row">
          <h1 class="heading-lg" style="font-family:var(--font-mono)">${escapeHtml(pkg.name)}</h1>
          <div class="version-select-wrapper">
            <select class="version-select" id="version-select" aria-label="Select version">
              ${versionKeys.map(v => `<option value="${v}" ${v === version ? 'selected' : ''}>v${v}</option>`).join('')}
            </select>
            <span class="version-chevron">${icons.chevronDown}</span>
          </div>
        </div>

        <p class="text-body" style="max-width:640px">${escapeHtml(pkg.description || 'No description available.')}</p>
      </div>
    </div>

    <!-- Body -->
    <div class="container">
      <div class="detail-body">
        <!-- Main column -->
        <div class="detail-main">
          <!-- Install command -->
          <div style="margin-bottom:var(--space-xl)">
            <h2 class="heading-sm" style="margin-bottom:var(--space-md)">Installation</h2>
            <div class="code-block" id="install-block">
              <span class="code-prefix">$ </span>hyo add ${escapeHtml(pkg.name)}
              <button class="copy-btn" data-copy="hyo add ${escapeHtml(pkg.name)}" aria-label="Copy install command">${icons.copy}</button>
            </div>
          </div>

          <!-- Version metadata -->
          <div style="margin-bottom:var(--space-xl)">
            <h2 class="heading-sm" style="margin-bottom:var(--space-md)">Version Details</h2>
            <div class="info-block">
              <div class="info-row">
                <span class="info-label">Version</span>
                <span class="info-value">${escapeHtml(version)}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Entrypoint</span>
                <span class="info-value">${escapeHtml(meta.entrypoint || 'N/A')}</span>
              </div>
              <div class="info-row">
                <span class="info-label">SHA-256</span>
                <span class="info-value" style="font-size:.6875rem;max-width:280px;word-break:break-all">
                  ${meta.sha256 ? escapeHtml(meta.sha256) : 'N/A'}
                  ${meta.sha256 ? `<button class="copy-btn" style="position:static;display:inline-flex;width:22px;height:22px;vertical-align:middle;margin-left:4px" data-copy="${escapeHtml(meta.sha256)}" aria-label="Copy checksum">${icons.copy}</button>` : ''}
                </span>
              </div>
              ${meta.url ? `
              <div class="info-row">
                <span class="info-label">Download</span>
                <span class="info-value">
                  <a href="${escapeHtml(meta.url)}" target="_blank" rel="noopener" style="color:var(--text-accent);display:inline-flex;align-items:center;gap:4px;font-size:.75rem">
                    ${icons.download} .tar.gz
                  </a>
                </span>
              </div>` : ''}
            </div>
          </div>

          <!-- Dependencies -->
          <div style="margin-bottom:var(--space-xl)">
            <h2 class="heading-sm" style="margin-bottom:var(--space-md)">Dependencies</h2>
            ${depEntries.length > 0
              ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${depEntries.map(([dep, ver]) =>
                  `<span class="tag tag-accent">${escapeHtml(dep)} <span style="opacity:.6">${escapeHtml(ver)}</span></span>`
                ).join('')}</div>`
              : `<p class="text-sm">No dependencies.</p>`
            }
          </div>

          <!-- Permissions -->
          <div>
            <h2 class="heading-sm" style="margin-bottom:var(--space-md)">Permissions</h2>
            ${perms.length > 0
              ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${perms.map(p =>
                  `<span class="tag tag-warning">${icons.shield} ${escapeHtml(p)}</span>`
                ).join('')}</div>`
              : `<p class="text-sm">No special permissions required.</p>`
            }
          </div>
        </div>

        <!-- Sidebar -->
        <div class="detail-sidebar">
          <!-- All versions -->
          <div class="info-block">
            <div class="info-block-title">All Versions</div>
            <ul class="version-list" id="version-list">
              ${versionKeys.map(v => `
                <li class="version-list-item ${v === version ? 'active' : ''}" data-version="${v}">
                  <span>v${escapeHtml(v)}</span>
                  ${v === versionKeys[0] ? '<span class="version-badge">latest</span>' : ''}
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Quick info -->
          <div class="info-block">
            <div class="info-block-title">Package Info</div>
            <div class="info-row">
              <span class="info-label">Versions</span>
              <span class="info-value">${pkg.versionCount}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Latest</span>
              <span class="info-value">${escapeHtml(pkg.latestVersion)}</span>
            </div>
          </div>

          <!-- Registry link -->
          <div class="info-block" style="text-align:center">
            <a href="https://github.com/shin7xjp/hyo-registry" target="_blank" rel="noopener" style="font-size:.8125rem;color:var(--text-accent);display:inline-flex;align-items:center;gap:6px">
              ${icons.github} View Registry on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind events
  bindDetailEvents(container, pkg, versionKeys);
}

function bindDetailEvents(container, pkg, versionKeys) {
  // Version select dropdown
  const select = container.querySelector('#version-select');
  if (select) {
    select.addEventListener('change', (e) => {
      currentVersion = e.target.value;
      renderDetail(container, pkg, currentVersion, versionKeys);
    });
  }

  // Version list sidebar clicks
  const versionItems = container.querySelectorAll('.version-list-item');
  versionItems.forEach(item => {
    item.addEventListener('click', () => {
      currentVersion = item.dataset.version;
      renderDetail(container, pkg, currentVersion, versionKeys);
    });
  });

  // Copy buttons
  const copyBtns = container.querySelectorAll('[data-copy]');
  copyBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyToClipboard(btn.dataset.copy, btn);
    });
  });
}


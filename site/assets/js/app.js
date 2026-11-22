/**
 * Hyo Registry — Main Application
 */

import { getPackageList, getPackageCount, getTotalVersionCount } from './registry.js';
import { searchPackages, sortPackages } from './search.js';
import { icons } from './icons.js';
import {
  renderPackageCard,
  renderSkeletonCard,
  renderError,
  renderEmptyState,
  renderLoading,
  debounce,
  el,
} from './utils.js';

let allPackages = [];
let currentSort = 'name-asc';

/**
 * Initialize the homepage.
 */
export async function initHomepage() {
  initNavToggle();
  await loadHomepage();
}

function initNavToggle() {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      links.classList.toggle('open');
    });
  }
}

async function loadHomepage() {
  const pkgGrid = document.getElementById('pkg-grid');
  const statPackages = document.getElementById('stat-packages');
  const statVersions = document.getElementById('stat-versions');
  const heroSearch = document.getElementById('hero-search');
  const heroClear = document.getElementById('hero-search-clear');

  // Show skeleton loading
  if (pkgGrid) {
    pkgGrid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      pkgGrid.appendChild(renderSkeletonCard());
    }
  }

  try {
    allPackages = await getPackageList();
    allPackages = sortPackages(allPackages, currentSort);

    // Update stats
    if (statPackages) statPackages.textContent = allPackages.length;
    if (statVersions) {
      const totalVersions = await getTotalVersionCount();
      statVersions.textContent = totalVersions;
    }

    // Render package cards
    renderPackages(allPackages);

    // Search binding
    if (heroSearch) {
      const handleSearch = debounce(() => {
        const q = heroSearch.value;
        const filtered = searchPackages(allPackages, q);
        renderPackages(filtered, q);

        // Toggle clear button
        if (heroClear) {
          heroClear.classList.toggle('visible', q.length > 0);
        }
      }, 120);

      heroSearch.addEventListener('input', handleSearch);

      if (heroClear) {
        heroClear.addEventListener('click', () => {
          heroSearch.value = '';
          heroClear.classList.remove('visible');
          renderPackages(allPackages);
          heroSearch.focus();
        });
      }
    }

  } catch (err) {
    if (pkgGrid) {
      pkgGrid.innerHTML = '';
      pkgGrid.appendChild(renderError(
        `Failed to load registry: ${err.message}`,
        () => loadHomepage()
      ));
    }
    // Set stats to error state
    if (statPackages) statPackages.textContent = '—';
    if (statVersions) statVersions.textContent = '—';
  }
}

function renderPackages(packages, query = '') {
  const grid = document.getElementById('pkg-grid');
  if (!grid) return;

  grid.innerHTML = '';

  if (packages.length === 0) {
    if (query) {
      grid.appendChild(renderEmptyState(
        'No packages found',
        `No results for "${query}". Try a different search.`
      ));
    } else {
      grid.appendChild(renderEmptyState(
        'No packages available',
        'The registry is currently empty.'
      ));
    }
    return;
  }

  for (const pkg of packages) {
    grid.appendChild(renderPackageCard(pkg));
  }
}

/**
 * Initialize the explore page.
 */
export async function initExplorePage() {
  initNavToggle();

  const pkgGrid = document.getElementById('explore-grid');
  const searchInput = document.getElementById('explore-search');
  const searchClear = document.getElementById('explore-search-clear');
  const sortSelect = document.getElementById('explore-sort');
  const countLabel = document.getElementById('explore-count');

  if (pkgGrid) {
    pkgGrid.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      pkgGrid.appendChild(renderSkeletonCard());
    }
  }

  try {
    allPackages = await getPackageList();
    allPackages = sortPackages(allPackages, currentSort);

    renderExplorePackages(allPackages, pkgGrid, countLabel);

    // Search
    if (searchInput) {
      const handleSearch = debounce(() => {
        const q = searchInput.value;
        let filtered = searchPackages(allPackages, q);
        filtered = sortPackages(filtered, currentSort);
        renderExplorePackages(filtered, pkgGrid, countLabel, q);

        if (searchClear) {
          searchClear.classList.toggle('visible', q.length > 0);
        }
      }, 120);

      searchInput.addEventListener('input', handleSearch);

      if (searchClear) {
        searchClear.addEventListener('click', () => {
          searchInput.value = '';
          searchClear.classList.remove('visible');
          renderExplorePackages(sortPackages(allPackages, currentSort), pkgGrid, countLabel);
          searchInput.focus();
        });
      }
    }

    // Sort
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        const q = searchInput?.value || '';
        let filtered = searchPackages(allPackages, q);
        filtered = sortPackages(filtered, currentSort);
        renderExplorePackages(filtered, pkgGrid, countLabel, q);
      });
    }

  } catch (err) {
    if (pkgGrid) {
      pkgGrid.innerHTML = '';
      pkgGrid.appendChild(renderError(
        `Failed to load registry: ${err.message}`,
        () => initExplorePage()
      ));
    }
  }
}

function renderExplorePackages(packages, grid, countLabel, query = '') {
  if (!grid) return;
  grid.innerHTML = '';

  if (countLabel) {
    countLabel.textContent = `${packages.length} package${packages.length !== 1 ? 's' : ''}`;
  }

  if (packages.length === 0) {
    if (query) {
      grid.appendChild(renderEmptyState(
        'No packages found',
        `No results for "${query}". Try a different search.`
      ));
    } else {
      grid.appendChild(renderEmptyState(
        'No packages available',
        'The registry is currently empty.'
      ));
    }
    return;
  }

  for (const pkg of packages) {
    grid.appendChild(renderPackageCard(pkg));
  }
}


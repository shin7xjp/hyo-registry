/**
 * Hyo Registry — Search Module
 * Client-side fuzzy search over package name and description.
 */

/**
 * Filter and rank packages against a query string.
 * Matches against name and description. Name matches are ranked higher.
 * @param {Array} packages — [{name, description, ...}]
 * @param {string} query
 * @returns {Array} filtered and sorted packages
 */
export function searchPackages(packages, query) {
  if (!query || !query.trim()) return packages;

  const q = query.toLowerCase().trim();
  const terms = q.split(/\s+/).filter(Boolean);

  const scored = [];

  for (const pkg of packages) {
    const nameLower = pkg.name.toLowerCase();
    const descLower = (pkg.description || '').toLowerCase();

    let score = 0;

    for (const term of terms) {
      // Exact name match
      if (nameLower === term) {
        score += 100;
      }
      // Name starts with term
      else if (nameLower.startsWith(term)) {
        score += 60;
      }
      // Name contains term
      else if (nameLower.includes(term)) {
        score += 40;
      }
      // Description contains term
      else if (descLower.includes(term)) {
        score += 15;
      }
      // No match for this term — skip the package
      else {
        score = -1;
        break;
      }
    }

    if (score > 0) {
      scored.push({ pkg, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.pkg);
}

/**
 * Sort packages by a given criterion.
 * @param {Array} packages
 * @param {string} sortBy — 'name-asc' | 'name-desc' | 'version'
 */
export function sortPackages(packages, sortBy) {
  const sorted = [...packages];

  switch (sortBy) {
    case 'name-asc':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'version':
      sorted.sort((a, b) => {
        const va = (a.latestVersion || '0.0.0').split('.').map(Number);
        const vb = (b.latestVersion || '0.0.0').split('.').map(Number);
        for (let i = 0; i < 3; i++) {
          const diff = (vb[i] || 0) - (va[i] || 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });
      break;
    default:
      // Default: alphabetical
      sorted.sort((a, b) => a.name.localeCompare(b.name));
  }

  return sorted;
}


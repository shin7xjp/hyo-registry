/**
 * Hyo Registry — Registry Data Module
 * Fetches, caches, and provides access to the registry index.
 */

const REGISTRY_URL = 'https://raw.githubusercontent.com/shin7xjp/hyo-registry/main/index.json';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let _cache = null;
let _cacheTime = 0;
let _fetchPromise = null;

/**
 * Fetch and validate the registry index.
 * Uses in-memory cache to avoid redundant network requests.
 * @param {object} opts
 * @param {boolean} opts.force — bypass cache
 * @returns {Promise<{registryVersion: number, packages: object}>}
 */
export async function fetchRegistry({ force = false } = {}) {
  const now = Date.now();

  // Return cached data if still valid
  if (!force && _cache && (now - _cacheTime) < CACHE_TTL) {
    return _cache;
  }

  // Deduplicate in-flight requests
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      const res = await fetch(REGISTRY_URL, {
        cache: force ? 'no-cache' : 'default',
      });

      if (!res.ok) {
        throw new Error(`Registry returned ${res.status} ${res.statusText}`);
      }

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Registry returned invalid JSON');
      }

      // Validate structure
      if (!data || typeof data !== 'object') {
        throw new Error('Registry data is not an object');
      }
      if (typeof data.packages !== 'object' || data.packages === null) {
        throw new Error('Registry is missing packages field');
      }

      _cache = data;
      _cacheTime = Date.now();
      return data;
    } finally {
      _fetchPromise = null;
    }
  })();

  return _fetchPromise;
}

/**
 * Get a flat list of packages with computed metadata.
 * @returns {Promise<Array<{name, description, latestVersion, versions, versionCount}>>}
 */
export async function getPackageList(opts) {
  const data = await fetchRegistry(opts);
  const list = [];

  for (const [name, pkg] of Object.entries(data.packages)) {
    const versionKeys = Object.keys(pkg.versions || {});
    const latestVersion = getLatestVersion(versionKeys);
    const latestMeta = pkg.versions?.[latestVersion] || {};

    list.push({
      name,
      description: pkg.description || '',
      latestVersion,
      versions: pkg.versions || {},
      versionCount: versionKeys.length,
      dependencies: latestMeta.dependencies || {},
      permissions: latestMeta.permissions || [],
      entrypoint: latestMeta.entrypoint || '',
    });
  }

  return list;
}

/**
 * Get a single package by name.
 * @param {string} name
 * @returns {Promise<object|null>}
 */
export async function getPackage(name, opts) {
  const data = await fetchRegistry(opts);
  const pkg = data.packages?.[name];
  if (!pkg) return null;

  const versionKeys = Object.keys(pkg.versions || {});
  const latestVersion = getLatestVersion(versionKeys);

  return {
    name,
    description: pkg.description || '',
    latestVersion,
    versions: pkg.versions || {},
    versionCount: versionKeys.length,
  };
}

/**
 * Determine the latest semver version from an array of version strings.
 * Simple semver sort: major.minor.patch
 */
function getLatestVersion(versions) {
  if (!versions || versions.length === 0) return '0.0.0';

  return versions.slice().sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (pb[i] || 0) - (pa[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  })[0];
}

/**
 * Get the total package count.
 */
export async function getPackageCount(opts) {
  const data = await fetchRegistry(opts);
  return Object.keys(data.packages || {}).length;
}

/**
 * Get total version count across all packages.
 */
export async function getTotalVersionCount(opts) {
  const data = await fetchRegistry(opts);
  let count = 0;
  for (const pkg of Object.values(data.packages || {})) {
    count += Object.keys(pkg.versions || {}).length;
  }
  return count;
}


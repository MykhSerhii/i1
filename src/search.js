let cities = [];
let map = null;
let baseUrl = '';

// Latin → Cyrillic transliteration map (Ukrainian standard + common variants)
const LATIN_TO_CYR = [
  ['shch','щ'],['sch','щ'],['zh','ж'],['kh','х'],['ts','ц'],['ch','ч'],
  ['sh','ш'],['yu','ю'],['ya','я'],['ye','є'],['yi','ї'],
  ['a','а'],['b','б'],['v','в'],['h','г'],['g','г'],['d','д'],
  ['e','е'],['z','з'],['y','и'],['i','и'],['j','й'],['k','к'],
  ['l','л'],['m','м'],['n','н'],['o','о'],['p','п'],['r','р'],
  ['s','с'],['t','т'],['u','у'],['f','ф'],['c','к'],['x','кс'],
  ['q','к'],['w','в'],
];

function transliterate(str) {
  let s = str.toLowerCase();
  for (const [lat, cyr] of LATIN_TO_CYR) {
    s = s.split(lat).join(cyr);
  }
  return s;
}

/**
 * Normalizes text for fuzzy search (handles both Cyrillic and Latin input).
 */
function normalize(str) {
  const s = str.toLowerCase();
  // Detect if input contains Latin letters
  const hasLatin = /[a-z]/.test(s);
  const base = hasLatin ? transliterate(s) : s;
  return base
    .replace(/ї/g, 'и')
    .replace(/і/g, 'и')
    .replace(/є/g, 'е')
    .replace(/ь/g, '')
    .replace(/'/g, '')
    .replace(/-/g, ' ');
}

/**
 * Loads cities.json and sets up the search UI.
 */
export async function initSearch(mapInstance, serverBaseUrl) {
  map = mapInstance;
  baseUrl = serverBaseUrl;

  try {
    const res = await fetch(`${baseUrl}/public/cities.json`);
    cities = await res.json();
    cities.sort((a, b) => b.pop - a.pop);
  } catch (e) {
    console.warn('Could not load cities.json:', e.message);
    return;
  }

  const input = document.getElementById('search-input');
  const dropdown = document.getElementById('search-dropdown');
  if (!input || !dropdown) return;

  const clearBtn = document.getElementById('search-clear');

  function updateClear() {
    if (clearBtn) {
      clearBtn.classList.toggle('hidden', input.value.length === 0);
    }
  }

  function clearSearch() {
    input.value = '';
    dropdown.classList.add('hidden');
    updateClear();
    input.focus();
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearSearch);
  }

  input.addEventListener('input', () => {
    updateClear();
    const q = input.value.trim();
    if (q.length < 2) {
      dropdown.classList.add('hidden');
      return;
    }
    const results = search(q);
    renderDropdown(results, dropdown, input, updateClear);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearSearch();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = dropdown.querySelector('.search-result');
      if (first) first.focus();
    }
  });

  // Hide dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });
}

function search(query) {
  const q = normalize(query);
  return cities
    .filter(c => normalize(c.name).includes(q))
    .slice(0, 8);
}

function flyTo(city) {
  if (!map) return;
  map.flyTo({
    center: [city.lng, city.lat],
    zoom: city.pop >= 500 ? 11 : city.pop >= 100 ? 12 : 13,
    speed: 1.4,
  });
}

function renderDropdown(results, dropdown, input, updateClear) {
  if (results.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }

  dropdown.innerHTML = results.map((c, i) => `
    <div class="search-result" tabindex="0" data-idx="${i}">
      <span class="search-result-name">${c.name}</span>
      <span class="search-result-coords">${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}</span>
    </div>
  `).join('');

  dropdown.classList.remove('hidden');

  dropdown.querySelectorAll('.search-result').forEach((el, i) => {
    el.addEventListener('click', () => {
      flyTo(results[i]);
      input.value = results[i].name;
      dropdown.classList.add('hidden');
      updateClear();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        flyTo(results[i]);
        input.value = results[i].name;
        dropdown.classList.add('hidden');
        updateClear();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = el.nextElementSibling;
        if (next) next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = el.previousElementSibling;
        if (prev) prev.focus();
        else input.focus();
      }
    });
  });
}

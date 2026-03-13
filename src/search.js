let cities = [];
let map = null;
let baseUrl = '';

/**
 * Normalizes Ukrainian text for fuzzy search.
 */
function normalize(str) {
  return str
    .toLowerCase()
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

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length < 2) {
      dropdown.classList.add('hidden');
      return;
    }
    const results = search(q);
    renderDropdown(results, dropdown, input);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      dropdown.classList.add('hidden');
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

function renderDropdown(results, dropdown, input) {
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
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        flyTo(results[i]);
        input.value = results[i].name;
        dropdown.classList.add('hidden');
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

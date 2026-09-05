/**
 * A repo's colour, once you have picked one yourself.
 *
 * `Colony._pickAccent` hands out a colour from a fixed palette by hashing the repo's name —
 * stable, but not yours to choose. An override here replaces that guess and survives a
 * reload, the same way the rest of the game's settings do.
 */

const STORE_KEY = 'spacecolonizer.accents.v1'

export function loadAccentOverrides() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
    const map = new Map()
    if (raw && typeof raw === 'object') {
      for (const [name, value] of Object.entries(raw)) {
        if (Number.isFinite(value)) map.set(name, Math.round(value) & 0xffffff)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

export function saveAccentOverrides(map) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(map)))
  } catch {
    /* private mode, quota — the choice just doesn't survive the reload */
  }
}

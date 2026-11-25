export function isValidTimeZone(zone) {
  if (typeof zone !== 'string' || !zone.trim()) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; }
  catch { return false; }
}

export function supportedTimeZones(current, intl = Intl) {
  let zones = [];
  try { zones = intl.supportedValuesOf?.('timeZone') || []; } catch { /* Older browsers still accept a manually entered IANA code. */ }
  let localZone;
  try { localZone = intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* Keep the saved zone available. */ }
  return [...new Set([...zones, current, localZone, 'UTC'].filter(isValidTimeZone))].sort();
}

export function matchingTimeZones(zones, query) {
  const normalized = query.trim().replace(/\s+/g, '_').toLowerCase();
  const matches = zones.filter(zone => zone.toLowerCase().includes(normalized));
  // Some valid aliases are accepted by Intl but omitted from supportedValuesOf.
  const candidate = query.trim().replace(/\s+/g, '_');
  if (candidate && isValidTimeZone(candidate) && !matches.some(zone => zone.toLowerCase() === candidate.toLowerCase())) matches.unshift(candidate);
  return matches;
}

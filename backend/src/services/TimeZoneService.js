// Convert a calendar day in the configured IANA zone to a UTC boundary, including DST.
export function zonedDayStart(day, timeZone) {
  const desired = Date.parse(`${day}T00:00:00Z`);
  let candidate = desired;
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(formatter.formatToParts(candidate).map(part => [part.type, part.value]));
    const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    const shift = desired - represented;
    candidate += shift;
    if (!shift) break;
  }
  return new Date(candidate);
}

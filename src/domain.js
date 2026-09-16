export function normalizeObservations(observations) {
  const byDate = new Map();
  for (const item of observations) {
    const date = String(item.date || '');
    const balance = Number(item.balance);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(balance)) continue;
    byDate.set(date, { date, balance });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function observationOnOrBefore(observations, requestedDate) {
  return normalizeObservations(observations).filter(item => item.date <= requestedDate).at(-1) || null;
}

export function combineAccountObservations(observations, accountIds) {
  const grouped = new Map(accountIds.map(id => [id, []]));
  for (const item of observations) if (grouped.has(item.accountId)) grouped.get(item.accountId).push(item);
  const dates = [...new Set(observations.filter(item => grouped.has(item.accountId)).map(item => item.date))].sort();
  return dates.flatMap(date => {
    const components = accountIds.map(accountId => ({ accountId, observation: observationOnOrBefore(grouped.get(accountId), date) }));
    if (components.some(component => !component.observation)) return [];
    return [{ date, balance: components.reduce((sum, component) => sum + component.observation.balance, 0), components }];
  });
}

export function combineSynchronizedAccountObservations(observations, accountIds) {
  if (!accountIds.length) return [];
  const grouped = new Map(accountIds.map(id => [id, normalizeObservations(observations.filter(item => item.accountId === id))]));
  if ([...grouped.values()].some(items => !items.length)) return [];
  const commonDates = [...new Set(grouped.get(accountIds[0]).map(item => item.date))].filter(date => accountIds.every(id => grouped.get(id).some(item => item.date === date))).sort();
  const combined = commonDates.map(date => {
    const components = accountIds.map(accountId => ({ accountId, observation: grouped.get(accountId).find(item => item.date === date) }));
    return { date, balance: components.reduce((sum, component) => sum + component.observation.balance, 0), components, synchronized: true };
  });
  const latestComponents = accountIds.map(accountId => ({ accountId, observation: grouped.get(accountId).at(-1) }));
  const latestDate = latestComponents.map(component => component.observation.date).sort().at(-1);
  if (!combined.some(item => item.date === latestDate)) combined.push({ date: latestDate, balance: latestComponents.reduce((sum, component) => sum + component.observation.balance, 0), components: latestComponents, synchronized: latestComponents.every(component => component.observation.date === latestDate) });
  return combined.sort((a, b) => a.date.localeCompare(b.date));
}

export function combineDepositObservations(observations, accounts) {
  const cashIds = accounts.filter(account => account.type === 'checking' || account.type === 'savings').map(account => account.id);
  const otherIds = accounts.filter(account => !cashIds.includes(account.id)).map(account => account.id);
  const grouped = new Map(accounts.map(account => [account.id, normalizeObservations(observations.filter(item => item.accountId === account.id))]));
  const activeIds = accounts.filter(account => grouped.get(account.id).length).map(account => account.id);
  if (!activeIds.length) return [];
  const activeCash = cashIds.filter(id => grouped.get(id).length);
  const cash = activeCash.length > 1 ? combineSynchronizedAccountObservations(observations, activeCash) : activeCash.length ? grouped.get(activeCash[0]).map(item => ({ date: item.date, balance: item.balance, components: [{ accountId: activeCash[0], observation: item }], synchronized: true })) : [];
  const dates = new Set(cash.map(item => item.date));
  if (!cash.length) for (const id of otherIds) for (const item of grouped.get(id)) dates.add(item.date);
  const latestDate = activeIds.map(id => grouped.get(id).at(-1).date).sort().at(-1);
  dates.add(latestDate);
  return [...dates].sort().flatMap(date => {
    const cashPoint = cash.filter(item => item.date <= date).at(-1);
    if (activeCash.length && !cashPoint) return [];
    const components = [...(cashPoint?.components || [])];
    for (const id of otherIds) {
      const observation = observationOnOrBefore(grouped.get(id), date);
      if (observation) components.push({ accountId: id, observation });
    }
    if (!components.length) return [];
    return [{ date, balance: components.reduce((sum, component) => sum + component.observation.balance, 0), components, synchronized: components.every(component => component.observation.date === date) }];
  });
}

export function calculateReport(observations, startDate, endDate) {
  const normalized = normalizeObservations(observations);
  if (!normalized.length || startDate > endDate) return null;
  const beginning = observationOnOrBefore(normalized, startDate);
  const ending = observationOnOrBefore(normalized, endDate);
  if (!beginning || !ending || beginning.date > ending.date) return null;
  const change = ending.balance - beginning.balance;
  return {
    requestedStart: startDate,
    requestedEnd: endDate,
    beginning,
    ending,
    change,
    percentageChange: beginning.balance === 0 ? null : (change / beginning.balance) * 100,
    observations: normalized.filter(item => item.date >= beginning.date && item.date <= ending.date)
  };
}

export function presetRange(preset, endDate) {
  const end = new Date(`${endDate}T12:00:00`);
  const start = new Date(end);
  if (preset === '7D') start.setDate(start.getDate() - 7);
  if (preset === '30D') start.setDate(start.getDate() - 30);
  if (preset === '90D') start.setDate(start.getDate() - 90);
  if (preset === '1Y') start.setFullYear(start.getFullYear() - 1);
  if (preset === 'YTD') start.setMonth(0, 1);
  return { startDate: start.toISOString().slice(0, 10), endDate };
}

export function chartTimeTicks(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const spanDays = Math.max(0, (end - start) / 86_400_000);
  const count = spanDays <= 14 ? 4 : spanDays <= 45 ? 5 : spanDays <= 180 ? 6 : spanDays <= 550 ? 7 : 8;
  if (spanDays === 0) return [startDate];
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getTime() + (index / (count - 1)) * (end - start));
    return date.toISOString().slice(0, 10);
  });
}

export function chartLabelIndices(observations, maximum = 7) {
  if (!observations.length) return [];
  if (observations.length <= maximum) return observations.map((_, index) => index);
  const indices = new Set([0, observations.length - 1]);
  let minimum = 0;
  let maximumIndex = 0;
  observations.forEach((item, index) => {
    if (item.balance < observations[minimum].balance) minimum = index;
    if (item.balance > observations[maximumIndex].balance) maximumIndex = index;
  });
  indices.add(minimum); indices.add(maximumIndex);
  for (let slot = 1; indices.size < maximum && slot < maximum * 2; slot += 1) {
    indices.add(Math.round((slot / (maximum - 1)) * (observations.length - 1)));
  }
  return [...indices].sort((a, b) => a - b).slice(0, maximum);
}

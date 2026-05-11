export function getNinjaLeagueUrl(league: string) {
  const normalizedLeague = league.toLowerCase();

  if (normalizedLeague === 'hardcore' || normalizedLeague === 'standard') {
    return normalizedLeague;
  }

  if (normalizedLeague.startsWith('hardcore ')) {
    return `${normalizedLeague.replace('hardcore ', '').replace(/\s/g, '')}hc`;
  }

  return normalizedLeague.replace(/\s/g, '');
}

export function getNinjaTypeUrl(type: string) {
  return `${type.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase()}s`
    .replace('prophecys', 'prophecies')
    .replace('accessorys', 'accessories')
    .replace('currencys', 'currency')
    .replace('fragmentss', 'fragments');
}

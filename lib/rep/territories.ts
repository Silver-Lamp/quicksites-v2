// lib/rep/territories.ts
//
// Where each rep walks. The restaurants section on a /for-<name> page lists the swept
// restaurants of this city (site, no online ordering, …); a rep with no territory gets the
// "sweep where you are" widget instead and the section fills in from their first sweep.
//
// Hand-typed on purpose: a territory is an agreement with a person, not something a sweep can
// infer, and three entries do not need a table. Add a line when a rep is given a city.

export type RepTerritory = { city: string; region: string; label: string };

export const REP_TERRITORIES: Record<string, RepTerritory> = {
  abdou: { city: 'Vashon', region: 'WA', label: 'Vashon Island' },
  craig: { city: 'Vashon', region: 'WA', label: 'Vashon Island' },
  amber: { city: 'Vashon', region: 'WA', label: 'Vashon Island' },
  katie: { city: 'Vashon', region: 'WA', label: 'Vashon Island' },
  ryan: { city: 'Renton', region: 'WA', label: 'Renton' },
};

export function territoryFor(code: string | null | undefined): RepTerritory | null {
  return code ? REP_TERRITORIES[code] ?? null : null;
}

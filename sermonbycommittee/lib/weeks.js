import data from '../weeks.json' with { type: 'json' };

export const weeks = data.weeks;

export function findWeek(slug) {
  return weeks.find(w => w.slug === slug);
}

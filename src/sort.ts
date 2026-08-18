import type { Answer, CatalogProgress, Item, RankingState, SortList } from './types';
const now = () => new Date().toISOString();
export const makeItem = (label: string): Item => ({ id: crypto.randomUUID(), label });
const eligible = (list: SortList) => list.items.map(item => item.id).filter(id => !list.unrankedIds.includes(id));
export const itemOrder = (list: SortList) => eligible(list).sort((a,b) => list.ranking.ratings[b].score - list.ranking.ratings[a].score);
const pairKey = (a: string, b: string) => [a,b].sort().join(':');
export function newList(name: string, labels: string[], catalog?: CatalogProgress): SortList { const seen = new Set<string>(); const items = labels.map(x => x.trim()).filter(x => x && !seen.has(x.toLowerCase()) && !!seen.add(x.toLowerCase())).map(makeItem); return { id: crypto.randomUUID(), name, items, unrankedIds: [], catalog, createdAt: now(), updatedAt: now(), ranking: { ratings: Object.fromEntries(items.map(i => [i.id, { score: 0, comparisons: 0 }])), comparisons: [], activity: { kind: 'normal' }, normalAnswers: 0 } }; }
export function edgeSize(list: SortList) { return Math.min(10, Math.floor(eligible(list).length / 2)); }
export function bandFor(list: SortList, id: string) { const ids = itemOrder(list); const index = ids.indexOf(id); const edge = edgeSize(list); if (index < edge) return 'Top 10'; if (index >= ids.length - edge) return 'Bottom 10'; const middle = Math.max(1, ids.length - edge * 2); const spot = index - edge; return spot < middle / 3 ? 'Upper-middle' : spot < middle * 2 / 3 ? 'Middle' : 'Lower-middle'; }
export function itemConfidence(list: SortList, id: string) { const rating = list.ranking.ratings[id]; if (!rating) return 0; const ids = itemOrder(list); const index = ids.indexOf(id); const neighbors = [ids[index - 1], ids[index + 1]].filter(Boolean); const gap = neighbors.length ? Math.min(...neighbors.map(other => Math.abs(rating.score - list.ranking.ratings[other].score))) : .5; return Math.round(Math.min(.98, (1 - Math.exp(-rating.comparisons / 2.8)) * .8 + (1 - Math.exp(-gap * 3)) * .2) * 100); }
export function listConfidence(list: SortList) { const ids = eligible(list); return ids.length ? Math.round(ids.reduce((sum,id) => sum + itemConfidence(list,id), 0) / ids.length) : 0; }
const activeIds = (list: SortList) => list.ranking.activity.poolIds?.filter(id => eligible(list).includes(id)) ?? eligible(list);
const target = (list: SortList, id: string) => list.ranking.activity.kind === 'refine-item' && list.ranking.activity.itemId === id ? (list.ranking.activity.targetConfidence ?? 85) : 70;
function decisiveStreak(list: SortList, id: string) {
  const outcomes = list.ranking.comparisons.filter(c => c.leftId === id || c.rightId === id).map(c => {
    if (c.outcome === 'tie') return 'tie';
    return c.leftId === id ? c.outcome : c.outcome === 'left' ? 'right' : 'left';
  });
  if (!outcomes.length || outcomes.includes('tie') || new Set(outcomes).size !== 1) return undefined;
  return outcomes[0];
}
function pickCandidate(list: SortList, candidates = activeIds(list)) { const activity = list.ranking.activity; if (activity.kind === 'refine-item' && activity.itemId && candidates.includes(activity.itemId) && itemConfidence(list, activity.itemId) < target(list, activity.itemId)) return activity.itemId;
  let preferred = candidates;
  if (activity.kind === 'normal') {
    const phase = list.ranking.normalAnswers % 5;
    if (phase < 3) {
      // A clean early win/loss streak is highly informative. Keep the item in
      // motion until its story changes or it is confidently broadly placed.
      const streaking = candidates.filter(id => decisiveStreak(list, id) && itemConfidence(list, id) < 70);
      const newOrLightlyPlaced = candidates.filter(id => list.ranking.ratings[id].comparisons < 2);
      if (streaking.length) preferred = streaking;
      else if (newOrLightlyPlaced.length) preferred = newOrLightlyPlaced;
    }
    else if (phase === 3) { const contenders = itemOrder(list).slice(0, 15); const topCandidates = candidates.filter(id => contenders.includes(id)); if (topCandidates.length) preferred = topCandidates; }
  }
  return [...preferred].sort((a,b) => { const aScore = 100 - itemConfidence(list,a); const bScore = 100 - itemConfidence(list,b); return bScore - aScore || list.ranking.ratings[a].comparisons - list.ranking.ratings[b].comparisons; })[0]; }
export function schedule(list: SortList): SortList { if (list.ranking.current || list.ranking.replacementDue || activeIds(list).length < 2) return list; const pool = activeIds(list); const seen = new Set(list.ranking.comparisons.map(c => pairKey(c.leftId,c.rightId))); const viable = pool.filter(id => pool.some(other => other !== id && !seen.has(pairKey(id, other)))); const carry = list.ranking.carry?.itemId; const focus = carry && viable.includes(carry) ? carry : pickCandidate(list, viable); if (!focus) return { ...list, ranking: { ...list.ranking, current: undefined, carry: undefined } }; const ratings = list.ranking.ratings; const rival = pool.filter(id => id !== focus && !seen.has(pairKey(focus,id))).sort((a,b) => Math.abs(ratings[focus].score - ratings[a].score) - Math.abs(ratings[focus].score - ratings[b].score) || ratings[a].comparisons - ratings[b].comparisons)[0]; const current = list.ranking.carry?.side === 'right' ? { leftId: rival, rightId: focus } : { leftId: focus, rightId: rival }; return { ...list, ranking: { ...list.ranking, current } }; }
export const ready = schedule;
function rate(ranking: RankingState, leftId: string, rightId: string, outcome: 'left'|'right'|'tie') { const left = ranking.ratings[leftId]; const right = ranking.ratings[rightId]; const expected = 1 / (1 + Math.exp(right.score-left.score)); const actual = outcome === 'left' ? 1 : outcome === 'right' ? 0 : .5; const delta = (.7 / Math.sqrt(1 + Math.min(left.comparisons,right.comparisons))) * (actual - expected); return { ...ranking, current: undefined, carry: undefined, ratings: { ...ranking.ratings, [leftId]: { score: left.score + delta, comparisons: left.comparisons + 1 }, [rightId]: { score: right.score - delta, comparisons: right.comparisons + 1 } }, comparisons: [...ranking.comparisons, { leftId, rightId, outcome }] }; }
export function answer(list: SortList, outcome: Answer) { const pair = list.ranking.current; if (!pair) return list; let next: SortList; if (outcome.startsWith('unavailable')) { const removedLeft = outcome === 'unavailable-left'; const id = removedLeft ? pair.leftId : pair.rightId; const remainingId = removedLeft ? pair.rightId : pair.leftId; const removedWasNew = list.ranking.ratings[id].comparisons === 0; next = { ...list, unrankedIds: [...list.unrankedIds, id], ranking: { ...list.ranking, current: undefined, carry: { itemId: remainingId, side: removedLeft ? 'right' : 'left' }, replacementDue: removedWasNew }, updatedAt: now() }; } else next = { ...list, ranking: rate(list.ranking,pair.leftId,pair.rightId,outcome as 'left'|'right'|'tie'), updatedAt: now() };
  if (next.ranking.activity.kind === 'normal') { const normalAnswers = next.ranking.replacementDue ? next.ranking.normalAnswers : next.ranking.normalAnswers + 1; next = { ...next, ranking: { ...next.ranking, normalAnswers, trickleDue: next.ranking.replacementDue || normalAnswers % 5 === 0 } }; }
  return schedule(next);
}
export function addItems(list: SortList, labels: string[]) { const names = new Set(list.items.map(i => i.label.toLowerCase())); const additions = labels.map(x => x.trim()).filter(x => x && !names.has(x.toLowerCase())).map(makeItem); return schedule({ ...list, items: [...list.items, ...additions], ranking: { ...list.ranking, current: undefined, trickleDue: false, ratings: { ...list.ranking.ratings, ...Object.fromEntries(additions.map(i => [i.id, { score: 0, comparisons: 0 }])) } }, updatedAt: now() }); }
export function refineList(list: SortList) { return schedule({ ...list, ranking: { ...list.ranking, activity: { kind: 'refine-list' }, current: undefined }, updatedAt: now() }); }
export function refineItem(list: SortList, itemId: string) { return schedule({ ...list, ranking: { ...list.ranking, activity: { kind: 'refine-item', itemId, targetConfidence: 85 }, current: undefined }, updatedAt: now() }); }
export function beginEdgeActivity(list: SortList, edge: 'top'|'bottom') { const order = itemOrder(list); const pool = edge === 'top' ? order.slice(0, 15) : order.slice(-15); return schedule({ ...list, ranking: { ...list.ranking, activity: { kind: edge === 'top' ? 'refine-top' : 'refine-bottom', poolIds: pool }, current: undefined }, updatedAt: now() }); }
export function stopActivity(list: SortList) { return schedule({ ...list, ranking: { ...list.ranking, activity: { kind: 'normal' }, current: undefined }, updatedAt: now() }); }

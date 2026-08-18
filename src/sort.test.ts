import { describe, expect, it } from 'vitest';
import { answer, bandFor, beginEdgeActivity, itemOrder, newList, ready } from './sort';

describe('discovery ranking', () => {
  it('schedules normal comparisons and marks every fifth answer for catalog trickling', () => {
    let list = ready(newList('test', ['A', 'B', 'C', 'D']));
    for (let i = 0; i < 5; i += 1) list = answer(list, 'left');
    expect(list.ranking.normalAnswers).toBe(5);
    expect(list.ranking.trickleDue).toBe(true);
  });
  it('assigns items to a five-band layout', () => {
    let list = ready(newList('test', Array.from({ length: 25 }, (_, i) => `Item ${i}`)));
    for (let i = 0; i < 10; i += 1) list = answer(list, 'left');
    const bands = itemOrder(list).map(id => bandFor(list, id));
    expect(bands).toContain('Top 10'); expect(bands).toContain('Bottom 10'); expect(bands).toContain('Middle');
  });
  it('creates a fifteen-item contender pool for edge activities', () => {
    const list = ready(newList('test', Array.from({ length: 20 }, (_, i) => `Item ${i}`)));
    const refined = beginEdgeActivity(list, 'top');
    expect(refined.ranking.activity.kind).toBe('refine-top');
    expect(refined.ranking.activity.poolIds).toHaveLength(15);
  });
  it('never schedules a previously answered pair', () => {
    let list = ready(newList('test', ['A', 'B', 'C']));
    for (let i = 0; i < 3; i += 1) list = answer(list, 'left');
    const pairs = list.ranking.comparisons.map(c => [c.leftId, c.rightId].sort().join(':'));
    expect(new Set(pairs).size).toBe(pairs.length);
  });
  it('carries the experienced item forward after its opponent is unavailable', () => {
    let list = ready(newList('test', ['A', 'B', 'C']));
    const removed = list.ranking.current!.leftId;
    list = { ...list, ranking: { ...list.ranking, ratings: { ...list.ranking.ratings, [removed]: { ...list.ranking.ratings[removed], comparisons: 1 } } } };
    const remaining = list.ranking.current!.rightId;
    list = answer(list, 'unavailable-left');
    expect(list.ranking.current?.rightId).toBe(remaining);
    expect(list.unrankedIds).toHaveLength(1);
  });
  it('requests an immediate replacement when an unseen item is eliminated', () => {
    let list = ready(newList('test', ['A', 'B', 'C']));
    list = answer(list, 'unavailable-left');
    expect(list.ranking.replacementDue).toBe(true);
    expect(list.ranking.trickleDue).toBe(true);
    expect(list.ranking.normalAnswers).toBe(0);
    expect(list.ranking.current).toBeUndefined();
  });
});

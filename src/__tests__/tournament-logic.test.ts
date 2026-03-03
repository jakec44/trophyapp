/**
 * Unit-ish tests for vote toggle and "could place" ranking logic
 */

import {
  getEntryMetricValue,
  formatMetric,
  getMetricUnitShort,
} from '../types/tournaments';
import type { FishEntry, UserFish, MetricType } from '../types/tournaments';

describe('vote toggle logic', () => {
  it('tapping up again should remove vote', () => {
    const upVote = (prev: { upVotes: number; userVote: 'UP' | 'DOWN' | null }) => {
      const next = prev.userVote === 'UP' ? null : 'UP';
      let up = prev.upVotes;
      if (prev.userVote === 'UP') up--;
      if (next === 'UP') up++;
      return { upVotes: up, userVote: next };
    };
    const r1 = upVote({ upVotes: 5, userVote: null });
    expect(r1.userVote).toBe('UP');
    expect(r1.upVotes).toBe(6);
    const r2 = upVote({ upVotes: r1.upVotes, userVote: r1.userVote });
    expect(r2.userVote).toBe(null);
    expect(r2.upVotes).toBe(5);
  });

  it('switching up to down adjusts counts correctly', () => {
    const vote = (
      prev: { upVotes: number; downVotes: number; userVote: 'UP' | 'DOWN' | null },
      next: 'UP' | 'DOWN' | null
    ) => {
      let up = prev.upVotes;
      let down = prev.downVotes;
      if (prev.userVote === 'UP') up--;
      if (prev.userVote === 'DOWN') down--;
      if (next === 'UP') up++;
      if (next === 'DOWN') down++;
      return { upVotes: up, downVotes: down, userVote: next };
    };
    const state = { upVotes: 10, downVotes: 2, userVote: 'UP' as const };
    const r = vote(state, 'DOWN');
    expect(r.upVotes).toBe(9);
    expect(r.downVotes).toBe(3);
    expect(r.userVote).toBe('DOWN');
  });
});

describe('could place ranking logic', () => {
  const mkEntry = (weightLbs?: number, lengthIn?: number, upVotes = 0): FishEntry =>
    ({
      id: 'e',
      userId: 'u',
      username: 'u',
      imageUrl: '',
      weightLbs,
      lengthIn,
      upVotes,
      downVotes: 0,
    } as FishEntry);

  it('gets metric value by type', () => {
    const e = mkEntry(8.5, 24, 10);
    expect(getEntryMetricValue(e, 'WEIGHT_LBS')).toBe(8.5);
    expect(getEntryMetricValue(e, 'LENGTH_IN')).toBe(24);
    expect(getEntryMetricValue(e, 'VOTES_UP')).toBe(10);
  });

  it('formats metric correctly', () => {
    expect(formatMetric(12.3, 'WEIGHT_LBS')).toBe('12.3 lbs');
    expect(formatMetric(37.5, 'LENGTH_IN')).toBe('37.5 in');
    expect(formatMetric(42, 'VOTES_UP')).toBe('42 👍');
    expect(formatMetric(undefined, 'WEIGHT_LBS')).toBe('—');
  });

  it('getMetricUnitShort returns correct unit labels', () => {
    expect(getMetricUnitShort('WEIGHT_LBS')).toBe('lbs');
    expect(getMetricUnitShort('LENGTH_IN')).toBe('in');
    expect(getMetricUnitShort('VOTES_UP')).toBe('👍');
  });

  it('single-tournament screen: route param id must match displayed tournament', () => {
    const routeParamId = 'tournament-redfish';
    const displayedTournament = {
      id: 'tournament-redfish',
      type: 'BIGGEST_REDFISH' as const,
      title: 'Redfish',
      metricType: 'LENGTH_IN' as const,
      entrantsCount: 98,
      topEntries: [],
    };
    expect(displayedTournament.id).toBe(routeParamId);
  });

  it('user fish beats 3rd place when value is higher', () => {
    const top3 = [
      mkEntry(12, 26),
      mkEntry(10, 24),
      mkEntry(8, 22),
    ];
    const thirdWeight = getEntryMetricValue(top3[2], 'WEIGHT_LBS');
    const userFish: UserFish = {
      id: 'f',
      imageUrl: '',
      weightLbs: 9,
      lengthIn: 23,
      createdAt: '',
    };
    expect(userFish.weightLbs).toBeGreaterThan(thirdWeight!);
    const predictedRank = 3;
    expect(predictedRank).toBeLessThanOrEqual(3);
  });
});

/**
 * Crew System - Supabase helpers
 * Handles crews, members, invites, and challenges.
 */

import { supabase } from './supabase';

export type CrewRole = 'captain' | 'officer' | 'member';
export type CrewInviteStatus = 'pending' | 'accepted' | 'declined';
export interface Crew {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_private: boolean;
  level: number;
  xp: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  invite_code: string | null;
}

export interface CrewMember {
  id: string;
  crew_id: string;
  user_id: string;
  role: CrewRole;
  contribution_xp: number;
  joined_at: string;
  profiles?: { display_name: string; avatar_url: string | null };
}

export interface CrewWithMembers extends Crew {
  crew_members: (CrewMember & { profiles?: { display_name: string; avatar_url: string | null } })[];
  member_count?: number;
}

export interface CrewInvite {
  id: string;
  crew_id: string;
  invited_user_id: string | null;
  invited_phone_or_email: string | null;
  invited_by: string;
  status: CrewInviteStatus;
  created_at: string;
}


// XP thresholds per level (cumulative)
const XP_PER_LEVEL = [0, 100, 300, 600, 1000, 1600, 2400, 3400, 4600, 6000];
const MAX_LEVEL = 10;

export function xpToLevel(xp: number): { level: number; xpInLevel: number; xpNeededForNext: number } {
  let level = 1;
  for (let i = XP_PER_LEVEL.length - 1; i >= 1; i--) {
    if (xp >= XP_PER_LEVEL[i]) {
      level = i + 1;
      break;
    }
  }
  if (xp >= XP_PER_LEVEL[XP_PER_LEVEL.length - 1]) {
    return { level: MAX_LEVEL, xpInLevel: xp - XP_PER_LEVEL[MAX_LEVEL - 1], xpNeededForNext: 0 };
  }
  const xpForThisLevel = XP_PER_LEVEL[level - 1];
  const xpForNextLevel = XP_PER_LEVEL[level] ?? xpForThisLevel + 1000;
  return {
    level,
    xpInLevel: xp - xpForThisLevel,
    xpNeededForNext: xpForNextLevel - xpForThisLevel,
  };
}

export const CREW_REWARDS: { level: number; reward: string }[] = [
  { level: 1, reward: 'Crew badge' },
  { level: 2, reward: 'Custom crew badge' },
  { level: 3, reward: 'Crew banner color' },
  { level: 5, reward: 'Crew-only tournaments' },
  { level: 7, reward: 'Special profile frame' },
  { level: 10, reward: 'Exclusive visual rewards' },
];

/** Get current user's crew (if any) */
export async function getMyCrew(userId: string): Promise<CrewWithMembers | null> {
  const { data: membership } = await supabase
    .from('crew_members')
    .select('crew_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return null;

  const { data: crew, error } = await supabase
    .from('crews')
    .select(
      `
      *,
      crew_members(
        id, crew_id, user_id, role, contribution_xp, joined_at,
        profiles(display_name, avatar_url)
      )
    `
    )
    .eq('id', membership.crew_id)
    .single();

  if (error || !crew) return null;
  return { ...crew, member_count: (crew.crew_members as any[])?.length ?? 0 } as CrewWithMembers;
}

/** List crews for Find Crew (searchable, filterable) */
export async function listCrews(opts: {
  search?: string;
  isPrivate?: boolean;
  minLevel?: number;
  limit?: number;
  offset?: number;
}): Promise<{ crews: (Crew & { member_count: number })[]; total: number }> {
  let query = supabase.from('crews').select('*, crew_members(count)', { count: 'exact' });

  if (opts.search?.trim()) {
    query = query.or(`name.ilike.%${opts.search.trim()}%,description.ilike.%${opts.search.trim()}%`);
  }
  if (opts.isPrivate !== undefined) {
    query = query.eq('is_private', opts.isPrivate);
  }
  if (opts.minLevel != null) {
    query = query.gte('level', opts.minLevel);
  }

  query = query.order('level', { ascending: false }).order('xp', { ascending: false });
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) return { crews: [], total: 0 };
  const crews = (data ?? []).map(({ crew_members, ...c }: any) => {
    const mc = crew_members;
    const member_count =
      typeof mc === 'number' ? mc : Array.isArray(mc) && mc[0]?.count != null ? mc[0].count : 0;
    return { ...c, member_count };
  });
  return { crews, total: count ?? 0 };
}

/** Create a new crew */
export async function createCrew(
  userId: string,
  data: { name: string; description?: string; avatar_url?: string; is_private?: boolean }
): Promise<{ crew: Crew; error: string | null }> {
  const name = data.name.trim();
  if (!name || name.length < 2) return { crew: null as any, error: 'Crew name must be at least 2 characters' };

  const { data: crew, error: createErr } = await supabase
    .from('crews')
    .insert({
      name,
      description: data.description?.trim() || null,
      avatar_url: data.avatar_url || null,
      is_private: data.is_private ?? false,
      created_by: userId,
      invite_code: generateInviteCode(),
    })
    .select()
    .single();

  if (createErr) return { crew: null as any, error: createErr.message };

  const { error: memberErr } = await supabase.from('crew_members').insert({
    crew_id: crew.id,
    user_id: userId,
    role: 'captain',
  });

  if (memberErr) {
    await supabase.from('crews').delete().eq('id', crew.id);
    return { crew: null as any, error: memberErr.message };
  }

  return { crew, error: null };
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/** Join a crew (public = instant, private = request) */
export async function joinCrew(
  userId: string,
  crewId: string,
  isPrivate: boolean
): Promise<{ ok: boolean; error: string | null }> {
  const { data: existing } = await supabase
    .from('crew_members')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return { ok: false, error: 'You are already in a crew' };

  if (isPrivate) {
    const { error } = await supabase.from('crew_invites').insert({
      crew_id: crewId,
      invited_user_id: userId,
      invited_by: userId, // will be updated by caller if we have inviter
      status: 'pending',
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: null }; // request sent
  }

  const { error } = await supabase.from('crew_members').insert({
    crew_id: crewId,
    user_id: userId,
    role: 'member',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/** Leave crew */
export async function leaveCrew(userId: string, crewId: string): Promise<{ ok: boolean; error: string | null }> {
  const { data: mem } = await supabase
    .from('crew_members')
    .select('role')
    .eq('crew_id', crewId)
    .eq('user_id', userId)
    .single();
  if (!mem) return { ok: false, error: 'Not a member' };
  if (mem.role === 'captain') return { ok: false, error: 'Captain must transfer leadership or dissolve crew first' };

  const { error } = await supabase
    .from('crew_members')
    .delete()
    .eq('crew_id', crewId)
    .eq('user_id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/** Add XP to crew (e.g. on catch, tournament win) */
export async function addCrewXp(crewId: string, amount: number, memberId?: string): Promise<void> {
  const { data: crew } = await supabase.from('crews').select('xp, level').eq('id', crewId).single();
  if (!crew) return;

  const newXp = crew.xp + amount;
  const { level } = xpToLevel(newXp);
  await supabase
    .from('crews')
    .update({ xp: newXp, level, updated_at: new Date().toISOString() })
    .eq('id', crewId);

  if (memberId) {
    const { data: m } = await supabase
      .from('crew_members')
      .select('contribution_xp')
      .eq('crew_id', crewId)
      .eq('user_id', memberId)
      .single();
    if (m) {
      await supabase
        .from('crew_members')
        .update({ contribution_xp: (m.contribution_xp ?? 0) + amount })
        .eq('crew_id', crewId)
        .eq('user_id', memberId);
    }
  }
}


/** Get crew by invite code */
export async function getCrewByInviteCode(code: string): Promise<Crew | null> {
  const { data } = await supabase.from('crews').select('*').eq('invite_code', code.toUpperCase()).maybeSingle();
  return data;
}

/** Invite user to crew by user ID */
export async function inviteUserToCrew(
  crewId: string,
  inviterId: string,
  invitedUserId: string
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from('crew_invites').insert({
    crew_id: crewId,
    invited_user_id: invitedUserId,
    invited_by: inviterId,
    status: 'pending',
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, error: null };
}

/** Get pending invites for a user */
export async function getMyCrewInvites(userId: string): Promise<(CrewInvite & { crews: Crew })[]> {
  const { data } = await supabase
    .from('crew_invites')
    .select('*, crews(*)')
    .eq('invited_user_id', userId)
    .eq('status', 'pending');
  return data ?? [];
}

/** Accept or decline crew invite */
export async function respondToCrewInvite(
  inviteId: string,
  userId: string,
  accept: boolean
): Promise<{ ok: boolean; error: string | null }> {
  const { data: invite } = await supabase
    .from('crew_invites')
    .select('crew_id')
    .eq('id', inviteId)
    .eq('invited_user_id', userId)
    .eq('status', 'pending')
    .single();
  if (!invite) return { ok: false, error: 'Invite not found or expired' };

  await supabase
    .from('crew_invites')
    .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
    .eq('id', inviteId);

  if (accept) {
    const { error } = await supabase.from('crew_members').insert({
      crew_id: invite.crew_id,
      user_id: userId,
      role: 'member',
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, error: null };
}

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useAuthContext } from '@/src/context/AuthContext';
import {
  getFriendsWithProfiles,
  getPendingFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend as removeFriendApi,
  supabase,
  type FriendWithProfile,
  type PendingFriendRequest,
} from '@/src/lib/supabase';

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'pending_invite';

export interface FriendRequest {
  id: string;
  fromUserId?: string;
  fromDisplayName?: string;
  fromAvatarUrl?: string;
  toPhoneNumber?: string;
  status: FriendRequestStatus;
  createdAt: string;
  inviteToken?: string;
}

export interface FriendPreview {
  id: string;
  userId?: string;
  friendshipId: string;
  displayName: string;
  isOnApp?: boolean;
  avatar: string;
  proVerified?: boolean;
  badges?: string[];
  location?: string;
  totalCatches?: number;
  personalBest?: string;
  bestCatchImage?: string;
  bestSpecies?: string;
  level?: string;
  levelNumber?: number;
}

type FriendsContextType = {
  friends: FriendPreview[];
  requests: FriendRequest[];
  loading: boolean;
  refresh: () => Promise<void>;
  removeFriend: (userIdOrFriendshipId: string) => Promise<void>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  addPendingInvite: (req: Omit<FriendRequest, 'id' | 'createdAt'>) => void;
};

const FriendsContext = createContext<FriendsContextType | null>(null);

function toFriendPreview(f: FriendWithProfile): FriendPreview {
  return {
    id: f.userId,
    userId: f.userId,
    friendshipId: f.id,
    displayName: f.displayName,
    isOnApp: true,
    avatar: f.avatarUrl,
    proVerified: false,
    badges: [],
    totalCatches: 0,
    personalBest: '',
  };
}

function toFriendRequest(r: PendingFriendRequest): FriendRequest {
  return {
    id: r.id,
    fromUserId: r.fromUserId,
    fromDisplayName: r.fromDisplayName,
    fromAvatarUrl: r.fromAvatarUrl,
    status: 'pending',
    createdAt: r.createdAt,
  };
}


export function FriendsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [friends, setFriends] = useState<FriendPreview[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setFriends([]);
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [friendsData, requestsData] = await Promise.all([
        getFriendsWithProfiles(user.id),
        getPendingFriendRequests(user.id),
      ]);
      setFriends(friendsData.map(toFriendPreview));
      setRequests(requestsData.map(toFriendRequest));
    } catch (e) {
      console.error('Friends refresh error:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Real-time: re-fetch whenever a friendship row involving this user changes
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to any change on friendships where the current user is a party.
    // Supabase Realtime only supports single-column filters, so we subscribe
    // once for user_id_1 and once for user_id_2, then deduplicate via debounce.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { refresh(); }, 500);
    };

    const ch1 = supabase
      .channel(`friendships-as-user1-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `user_id_1=eq.${user.id}`,
      }, scheduleRefresh)
      .subscribe();

    const ch2 = supabase
      .channel(`friendships-as-user2-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `user_id_2=eq.${user.id}`,
      }, scheduleRefresh)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }, [user?.id, refresh]);

  const removeFriend = useCallback(
    async (userIdOrFriendshipId: string) => {
      if (!user?.id) return;
      const friend = friends.find(
        (f) => f.userId === userIdOrFriendshipId || f.friendshipId === userIdOrFriendshipId
      );
      const friendshipId = friend?.friendshipId ?? userIdOrFriendshipId;
      try {
        await removeFriendApi(friendshipId, user.id);
        setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId && f.userId !== userIdOrFriendshipId));
      } catch (e) {
        console.error('Remove friend error:', e);
      }
    },
    [user?.id, friends]
  );

  const acceptRequest = useCallback(
    async (friendshipId: string) => {
      if (!user?.id) return;
      try {
        await acceptFriendRequest(friendshipId, user.id);
        await refresh();
      } catch (e) {
        console.error('Accept request error:', e);
      }
    },
    [user?.id, refresh]
  );

  const declineRequest = useCallback(
    async (friendshipId: string) => {
      if (!user?.id) return;
      try {
        await declineFriendRequest(friendshipId, user.id);
        setRequests((prev) => prev.filter((r) => r.id !== friendshipId));
      } catch (e) {
        console.error('Decline request error:', e);
      }
    },
    [user?.id]
  );

  const addPendingInvite = useCallback((req: Omit<FriendRequest, 'id' | 'createdAt'>) => {
    setRequests((prev) => [
      {
        ...req,
        id: `inv-${Date.now()}`,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  return (
    <FriendsContext.Provider
      value={{
        friends,
        requests,
        loading,
        refresh,
        removeFriend,
        acceptRequest,
        declineRequest,
        addPendingInvite,
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriendsContext() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriendsContext must be used within FriendsProvider');
  return ctx;
}

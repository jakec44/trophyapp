/**
 * Storage key helpers for the single `media` bucket.
 * All paths follow {userId}/{type}/... so RLS can check (storage.foldername(name))[1] = auth.uid().
 */
export const mediaPath = {
  story:  (userId: string, id: string) => `${userId}/stories/${id}.jpg`,
  log:    (userId: string, id: string) => `${userId}/catches/${id}.jpg`,
  avatar: (userId: string)             => `${userId}/avatars/main.jpg`,
  banner: (userId: string)             => `${userId}/banners/main.jpg`,
  entry:  (userId: string, tournamentId: string, id: string) =>
    `${userId}/tournaments/${tournamentId}/${id}.jpg`,
  post:   (userId: string, postId: string) =>
    `${userId}/posts/${postId}.jpg`,
  /** Multi-media post: userId/posts/postId_0.jpg, postId_1.mp4, ... */
  postIndex: (userId: string, postId: string, index: number, ext: 'jpg' | 'mp4') =>
    `${userId}/posts/${postId}_${index}.${ext}`,
};

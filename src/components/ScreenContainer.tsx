/**
 * Global scroll padding and safe area utilities.
 * Use to ensure content is never blocked by the bottom tab bar.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Approximate height of CustomTabBar (padding + content + labels). */
export const TAB_BAR_HEIGHT = 88;

/** Extra spacing below last scrollable item. */
export const SCROLL_BOTTOM_SPACING = 24;

/**
 * Returns paddingBottom value for ScrollView/FlatList contentContainerStyle
 * so the last element scrolls above the tab bar.
 */
export function useBottomSafePadding(): number {
  const insets = useSafeAreaInsets();
  return Math.max(SCROLL_BOTTOM_SPACING, insets.bottom) + TAB_BAR_HEIGHT;
}

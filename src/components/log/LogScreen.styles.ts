import { Platform, StyleSheet } from 'react-native';
import { colors } from '@/utils/colors';

const BRIGHT_BLUE = colors.brightBlue;

export const logScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lightBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightBorder,
    backgroundColor: colors.lightCard,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
  },
  headerSpacer: {
    width: 40,
  },
  newSpeciesBannerWrap: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden' as const,
    ...Platform.select({
      ios: {
        shadowColor: '#0066FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  newSpeciesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 12,
  },
  newSpeciesEmoji: {
    fontSize: 28,
  },
  newSpeciesContent: {
    flex: 1,
  },
  newSpeciesTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  newSpeciesText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.95)',
    marginTop: 2,
  },
  keyboardWrap: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  analyzingBlock: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: colors.lightCard,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lightBorder,
  },
  analyzingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.lightText,
    marginTop: 16,
  },
  analyzingSubtext: {
    fontSize: 14,
    color: colors.lightSubtext,
    marginTop: 4,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRIGHT_BLUE,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: 'rgba(220,53,69,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(220,53,69,0.4)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.lightText,
  },
  errorDismiss: {
    padding: 4,
  },
  submitWrap: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});

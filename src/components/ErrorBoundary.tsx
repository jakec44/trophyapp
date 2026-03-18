/**
 * Error boundary: catches render errors and shows a fallback with a reload button.
 * Reload clears the error and forces a re-mount of children so the app can recover.
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { colors } from '@/utils/colors';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((props: { error: Error; retry: () => void }) => ReactNode);
  /** When this changes, the boundary resets and children re-mount. */
  retryKey?: number;
  /** Called when user taps Reload. Parent should increment retryKey and pass it back. */
  onRetry?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.retryKey !== this.props.retryKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback;
      if (typeof Fallback === 'function') {
        return (
          <Fallback
            error={this.state.error}
            retry={this.handleRetry}
          />
        );
      }
      if (Fallback) return Fallback;
      return (
        <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
      );
    }
    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  onRetry: () => void;
}

function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        We hit a snag. Try reloading to get back on the water.
      </Text>
      {__DEV__ && (
        <Text style={styles.devError} numberOfLines={5}>
          {error.message}
        </Text>
      )}
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>Reload</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.abyss,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: colors.textDim,
    textAlign: 'center',
    marginBottom: 24,
  },
  devError: {
    fontSize: 12,
    color: colors.textFaint,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.teal,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: colors.abyss,
    fontSize: 16,
    fontWeight: '600',
  },
});

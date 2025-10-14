/**
 * React Hook for Shopify Customer Account API Authentication
 * 
 * Provides a convenient React hook for managing customer authentication state
 * and operations. Handles automatic token refresh, state management, and
 * provides easy-to-use methods for authentication flows.
 * 
 * Features:
 * - Automatic authentication state management
 * - Token refresh handling
 * - Loading and error states
 * - Easy-to-use authentication methods
 * - TypeScript support with proper typing
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AuthState,
  AuthError,
  AuthErrorType,
  initiateCustomerAuth,
  handleAuthCallback,
  getAuthState,
  isAuthenticated,
  logout as authLogout,
  refreshAccessToken,
  AuthConfig
} from './auth';

/**
 * Authentication hook state interface
 */
interface UseAuthState {
  authState: AuthState | null;
  isLoading: boolean;
  error: AuthError | null;
  isAuthenticated: boolean;
}

/**
 * Authentication hook actions interface
 */
interface UseAuthActions {
  login: (config: Partial<AuthConfig>) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

/**
 * Complete authentication hook interface
 */
export interface UseAuthReturn extends UseAuthState, UseAuthActions {}

/**
 * Custom hook for managing Shopify Customer Account API authentication
 * 
 * Provides authentication state management, automatic token refresh,
 * and convenient methods for login/logout operations.
 * 
 * @returns Authentication state and actions
 * 
 * @example
 * ```tsx
 * function LoginComponent() {
 *   const { login, isLoading, error, isAuthenticated } = useAuth();
 * 
 *   const handleLogin = async () => {
 *     try {
 *       await login({
 *         clientId: process.env.CLIENT_ID,
 *         shopDomain: 'your-shop.myshopify.com',
 *         redirectUri: window.location.origin + '/auth/callback',
 *         scopes: ['openid', 'email', 'customer-account-api:full']
 *       });
 *     } catch (error) {
 *       console.error('Login failed:', error);
 *     }
 *   };
 * 
 *   if (isAuthenticated) {
 *     return <div>Welcome! You are logged in.</div>;
 *   }
 * 
 *   return (
 *     <button onClick={handleLogin} disabled={isLoading}>
 *       {isLoading ? 'Logging in...' : 'Login with Shopify'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);

  /**
   * Initializes authentication state on component mount
   * Checks for existing authentication data and handles OAuth callbacks
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if this is an OAuth callback
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');

        if (code && state) {
          // Handle OAuth callback
          const newAuthState = await handleAuthCallback();
          setAuthState(newAuthState);
          
          // Clean up URL parameters
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('code');
          newUrl.searchParams.delete('state');
          newUrl.searchParams.delete('error');
          newUrl.searchParams.delete('error_description');
          
          window.history.replaceState({}, '', newUrl.toString());
        } else {
          // Check for existing authentication state
          const existingAuthState = getAuthState();
          setAuthState(existingAuthState);
        }
      } catch (error) {
        console.error('Authentication initialization error:', error);
        setError(
          error instanceof AuthError 
            ? error 
            : new AuthError(
                AuthErrorType.UNKNOWN_ERROR,
                'Failed to initialize authentication',
                error as Error
              )
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Sets up automatic token refresh
   * Monitors token expiration and refreshes tokens before they expire
   */
  useEffect(() => {
    if (!authState?.expiresAt) return;

    const timeUntilExpiry = authState.expiresAt - Date.now();
    const refreshBuffer = 5 * 60 * 1000; // Refresh 5 minutes before expiry

    if (timeUntilExpiry <= refreshBuffer) {
      // Token is already expired or about to expire
      refreshToken();
      return;
    }

    // Set up automatic refresh
    const refreshTimeout = setTimeout(() => {
      refreshToken();
    }, timeUntilExpiry - refreshBuffer);

    return () => clearTimeout(refreshTimeout);
  }, [authState?.expiresAt]);

  /**
   * Initiates customer authentication flow
   * Redirects user to Shopify for authentication
   * 
   * @param config - Authentication configuration
   * @throws AuthError if authentication initiation fails
   */
  const login = useCallback(async (config: Partial<AuthConfig>): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await initiateCustomerAuth(config);
      // Note: initiateCustomerAuth redirects the user, so this line won't be reached
    } catch (error) {
      console.error('Login error:', error);
      setError(
        error instanceof AuthError 
          ? error 
          : new AuthError(
              AuthErrorType.UNKNOWN_ERROR,
              'Login failed',
              error as Error
            )
      );
      setIsLoading(false);
      throw error;
    }
  }, []);

  /**
   * Logs out the current user
   * Clears all authentication data and state
   */
  const logout = useCallback((): void => {
    try {
      authLogout();
      setAuthState(null);
      setError(null);
    } catch (error) {
      console.error('Logout error:', error);
      setError(
        new AuthError(
          AuthErrorType.UNKNOWN_ERROR,
          'Logout failed',
          error as Error
        )
      );
    }
  }, []);

  /**
   * Refreshes the access token
   * Uses the refresh token to get a new access token
   * 
   * @throws AuthError if token refresh fails
   */
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      const newAuthState = await refreshAccessToken();
      setAuthState(newAuthState);
    } catch (error) {
      console.error('Token refresh error:', error);
      
      // If refresh fails, user needs to log in again
      if (error instanceof AuthError && error.type === AuthErrorType.TOKEN_EXPIRED) {
        setAuthState(null);
        setError(
          new AuthError(
            AuthErrorType.TOKEN_EXPIRED,
            'Session expired. Please log in again.'
          )
        );
      } else {
        setError(
          error instanceof AuthError 
            ? error 
            : new AuthError(
                AuthErrorType.UNKNOWN_ERROR,
                'Failed to refresh token',
                error as Error
              )
        );
      }
      throw error;
    }
  }, []);

  /**
   * Clears the current error state
   * Allows user to retry operations after an error
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    // State
    authState,
    isLoading,
    error,
    isAuthenticated: isAuthenticated(),

    // Actions
    login,
    logout,
    refreshToken,
    clearError,
  };
}

/**
 * Hook for getting current authentication state without actions
 * Useful for components that only need to read authentication state
 * 
 * @returns Current authentication state
 */
export function useAuthState(): AuthState | null {
  const [authState, setAuthState] = useState<AuthState | null>(null);

  useEffect(() => {
    const currentAuthState = getAuthState();
    setAuthState(currentAuthState);

    // Set up interval to check for auth state changes
    const interval = setInterval(() => {
      const newAuthState = getAuthState();
      if (JSON.stringify(newAuthState) !== JSON.stringify(authState)) {
        setAuthState(newAuthState);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [authState]);

  return authState;
}

/**
 * Hook for checking if user is authenticated
 * Simple boolean check for authentication status
 * 
 * @returns True if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      setIsAuth(isAuthenticated());
    };

    checkAuth();

    // Set up interval to check authentication status
    const interval = setInterval(checkAuth, 1000);

    return () => clearInterval(interval);
  }, []);

  return isAuth;
}

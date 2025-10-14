/**
 * Authentication Button Component
 * 
 * A reusable React component that provides a login/logout button with
 * proper loading states, error handling, and user feedback. Integrates
 * with the Shopify Customer Account API authentication system.
 * 
 * Features:
 * - Automatic login/logout state management
 * - Loading indicators during authentication
 * - Error message display
 * - Responsive design with Polaris components
 * - Accessibility support
 */

import React from 'react';
import { Button, Banner, Spinner, Text } from '@shopify/polaris';
import { useAuth } from './useAuth';

/**
 * Props interface for AuthButton component
 */
interface AuthButtonProps {
  /**
   * Custom configuration for authentication
   * If not provided, uses default environment variables
   */
  authConfig?: {
    clientId?: string;
    shopDomain?: string;
    redirectUri?: string;
    scopes?: string[];
  };
  
  /**
   * Custom text for login button
   */
  loginText?: string;
  
  /**
   * Custom text for logout button
   */
  logoutText?: string;
  
  /**
   * Whether to show user information when authenticated
   */
  showUserInfo?: boolean;
  
}

/**
 * Authentication Button Component
 * 
 * Provides a complete authentication interface with login/logout functionality,
 * loading states, and error handling. Uses Shopify Customer Account API
 * for secure authentication.
 * 
 * @param props - Component props
 * @returns JSX element with authentication interface
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <AuthButton />
 * 
 * // With custom configuration
 * <AuthButton 
 *   authConfig={{
 *     clientId: 'your-client-id',
 *     shopDomain: 'your-shop.myshopify.com',
 *     redirectUri: window.location.origin + '/auth/callback',
 *     scopes: ['openid', 'email', 'customer-account-api:full']
 *   }}
 *   loginText="Sign in to your account"
 *   logoutText="Sign out"
 *   showUserInfo={true}
 * />
 * ```
 */
export function AuthButton({
  authConfig,
  loginText = 'Login with Shopify',
  logoutText = 'Logout',
  showUserInfo = false
}: AuthButtonProps): JSX.Element {
  const { 
    authState, 
    isLoading, 
    error, 
    isAuthenticated, 
    login, 
    logout, 
    clearError 
  } = useAuth();

  /**
   * Handles login button click
   * Initiates the Shopify Customer Account API authentication flow
   */
  const handleLogin = async (): Promise<void> => {
    try {
      clearError();
      
      // Use provided config or fall back to environment variables
      const config = {
        clientId: authConfig?.clientId || process.env.CLIENT_ID,
        shopDomain: authConfig?.shopDomain || process.env.SHOP_DOMAIN,
        redirectUri: authConfig?.redirectUri || `${window.location.origin}/auth/callback`,
        scopes: authConfig?.scopes || [
          'openid',
          'email',
          'customer-account-api:full'
        ]
      };

      await login(config);
    } catch (error) {
      console.error('Login failed:', error);
      // Error is automatically handled by the useAuth hook
    }
  };

  /**
   * Handles logout button click
   * Clears authentication state and logs out the user
   */
  const handleLogout = (): void => {
    try {
      logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  /**
   * Renders error banner if there's an authentication error
   */
  const renderError = (): JSX.Element | null => {
    if (!error) return null;

    return (
      <Banner
        title="Authentication Error"
        tone="critical"
        onDismiss={clearError}
      >
        <Text as="p">
          {error.message}
        </Text>
        {error.type === 'TOKEN_EXPIRED' && (
          <Text as="p">
            Your session has expired. Please log in again.
          </Text>
        )}
      </Banner>
    );
  };

  /**
   * Renders user information when authenticated
   */
  const renderUserInfo = (): JSX.Element | null => {
    if (!isAuthenticated || !showUserInfo || !authState?.customerId) {
      return null;
    }

    return (
      <div style={{ marginBottom: '1rem' }}>
        <Text as="p" variant="bodyMd">
          Welcome! Customer ID: {authState.customerId}
        </Text>
      </div>
    );
  };

  /**
   * Renders loading spinner during authentication operations
   */
  const renderLoadingState = (): JSX.Element => {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Spinner size="small" />
        <Text as="span" variant="bodyMd">
          {isAuthenticated ? 'Logging out...' : 'Logging in...'}
        </Text>
      </div>
    );
  };

  /**
   * Renders the main authentication button
   */
  const renderAuthButton = (): JSX.Element => {
    if (isLoading) {
      return renderLoadingState();
    }

    if (isAuthenticated) {
      return (
        <Button
          onClick={handleLogout}
          variant="secondary"
        >
          {logoutText}
        </Button>
      );
    }

    return (
      <Button
        onClick={handleLogin}
        variant="primary"
      >
        {loginText}
      </Button>
    );
  };

  return (
    <div>
      {renderError()}
      {renderUserInfo()}
      {renderAuthButton()}
    </div>
  );
}

/**
 * Higher-order component for protecting routes that require authentication
 * 
 * @param Component - Component to protect
 * @param fallback - Component to show when not authenticated
 * @returns Protected component
 */
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ComponentType
) {
  return function ProtectedComponent(props: P): JSX.Element {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="large" />
        </div>
      );
    }

    if (!isAuthenticated) {
      if (fallback) {
        const FallbackComponent = fallback;
        return <FallbackComponent />;
      }
      
      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <Text as="h2" variant="headingMd">
            Authentication Required
          </Text>
          <Text as="p" variant="bodyMd">
            Please log in to access this page.
          </Text>
          <div style={{ marginTop: '1rem' }}>
            <AuthButton />
          </div>
        </div>
      );
    }

    return <Component {...props} />;
  };
}

export default AuthButton;

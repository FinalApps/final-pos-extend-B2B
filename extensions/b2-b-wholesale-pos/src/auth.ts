/**
 * Shopify Customer Account API Authentication Utilities
 * 
 * Provides secure authentication flow for customer login using Shopify's
 * Customer Account API with PKCE (Proof Key for Code Exchange) for enhanced security.
 * 
 * Features:
 * - PKCE flow for public client security
 * - Comprehensive error handling and validation
 * - Secure token storage and management
 * - State management for CSRF protection
 * - Automatic token refresh handling
 */

import { logOrderOperation } from './utils';

/**
 * Configuration interface for Customer Account API authentication
 */
export interface AuthConfig {
  clientId: string;
  shopDomain: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * Authentication state interface
 */
export interface AuthState {
  isAuthenticated: boolean;
  customerId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Authentication error types
 */
export enum AuthErrorType {
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  USER_CANCELLED = 'USER_CANCELLED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Custom authentication error class
 */
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Validates authentication configuration
 * Ensures all required environment variables and parameters are present
 * 
 * @param config - Authentication configuration to validate
 * @throws AuthError if configuration is invalid
 */
export function validateAuthConfig(config: Partial<AuthConfig>): AuthConfig {
  const errors: string[] = [];

  if (!config.clientId) {
    errors.push('CLIENT_ID environment variable is required');
  }

  if (!config.shopDomain) {
    errors.push('Shop domain is required');
  }

  if (!config.redirectUri) {
    errors.push('Redirect URI is required');
  }

  if (!config.scopes || config.scopes.length === 0) {
    errors.push('At least one scope is required');
  }

  if (errors.length > 0) {
    throw new AuthError(
      AuthErrorType.CONFIGURATION_ERROR,
      `Configuration validation failed: ${errors.join(', ')}`
    );
  }

  return config as AuthConfig;
}

/**
 * Generates a cryptographically secure random string
 * Used for code verifier and state parameter generation
 * 
 * @param length - Length of the random string (default: 128)
 * @returns Base64URL encoded random string
 */
export async function generateRandomString(length: number = 128): Promise<string> {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, Array.from(array)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates PKCE code verifier
 * Creates a cryptographically secure random string for PKCE flow
 * 
 * @returns Base64URL encoded code verifier
 */
export async function generateCodeVerifier(): Promise<string> {
  return generateRandomString(128);
}

/**
 * Generates PKCE code challenge from verifier
 * Creates SHA256 hash of the verifier for enhanced security
 * 
 * @param verifier - Code verifier to hash
 * @returns Base64URL encoded code challenge
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generates secure state parameter for CSRF protection
 * Creates a random string to prevent cross-site request forgery
 * 
 * @returns Base64URL encoded state parameter
 */
export async function generateState(): Promise<string> {
  return generateRandomString(64);
}

/**
 * Generates secure nonce for replay attack prevention
 * Creates a random string to prevent replay attacks
 * 
 * @returns Base64URL encoded nonce
 */
export async function generateNonce(): Promise<string> {
  return generateRandomString(32);
}

/**
 * Builds the authorization URL for Customer Account API
 * Constructs the complete OAuth authorization URL with all required parameters
 * 
 * @param config - Authentication configuration
 * @param state - State parameter for CSRF protection
 * @param nonce - Nonce for replay attack prevention
 * @param codeChallenge - PKCE code challenge
 * @returns Complete authorization URL
 * @throws AuthError if URL construction fails
 */
export function buildAuthorizationUrl(
  config: AuthConfig,
  state: string,
  nonce: string,
  codeChallenge: string
): string {
  try {
    const authorizationUrl = new URL(
      `https://shopify.com/authentication/${config.shopDomain}/oauth/authorize`
    );

    // Add required OAuth parameters
    authorizationUrl.searchParams.append('scope', config.scopes.join(' '));
    authorizationUrl.searchParams.append('client_id', config.clientId);
    authorizationUrl.searchParams.append('response_type', 'code');
    authorizationUrl.searchParams.append('redirect_uri', config.redirectUri);
    authorizationUrl.searchParams.append('state', state);
    authorizationUrl.searchParams.append('nonce', nonce);

    // Add PKCE parameters for enhanced security
    authorizationUrl.searchParams.append('code_challenge', codeChallenge);
    authorizationUrl.searchParams.append('code_challenge_method', 'S256');

    return authorizationUrl.toString();
  } catch (error) {
    throw new AuthError(
      AuthErrorType.CONFIGURATION_ERROR,
      'Failed to build authorization URL',
      error as Error
    );
  }
}

/**
 * Initiates the Customer Account API authentication flow
 * Handles the complete PKCE flow setup and redirects user to Shopify
 * 
 * @param config - Authentication configuration
 * @throws AuthError if authentication setup fails
 */
export async function initiateCustomerAuth(config: Partial<AuthConfig>): Promise<void> {
  try {
    // Validate configuration
    const validatedConfig = validateAuthConfig(config);

    // Generate PKCE parameters
    const verifier = await generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = await generateState();
    const nonce = await generateNonce();

    // Store sensitive data securely
    const authData = {
      codeVerifier: verifier,
      state,
      nonce,
      timestamp: Date.now()
    };

    // Store in sessionStorage for security (cleared on tab close)
    sessionStorage.setItem('shopify-auth-data', JSON.stringify(authData));

    // Build and redirect to authorization URL
    const authUrl = buildAuthorizationUrl(validatedConfig, state, nonce, challenge);
    
    logOrderOperation('customer_auth_initiated', 'system', {
      shopDomain: validatedConfig.shopDomain,
      scopes: validatedConfig.scopes
    });

    // Redirect to Shopify authentication
    window.location.href = authUrl;

  } catch (error) {
    logOrderOperation('customer_auth_error', 'system', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      AuthErrorType.UNKNOWN_ERROR,
      'Failed to initiate customer authentication',
      error as Error
    );
  }
}

/**
 * Handles the OAuth callback and exchanges authorization code for tokens
 * Processes the callback from Shopify and completes the authentication flow
 * 
 * @param url - Current URL containing authorization code and state
 * @returns Authentication state with tokens
 * @throws AuthError if token exchange fails
 */
export async function handleAuthCallback(url: string = window.location.href): Promise<AuthState> {
  try {
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const error = urlObj.searchParams.get('error');

    // Check for OAuth errors
    if (error) {
      if (error === 'access_denied') {
        throw new AuthError(
          AuthErrorType.USER_CANCELLED,
          'User cancelled the authentication process'
        );
      }
      throw new AuthError(
        AuthErrorType.INVALID_RESPONSE,
        `OAuth error: ${error}`
      );
    }

    // Validate required parameters
    if (!code || !state) {
      throw new AuthError(
        AuthErrorType.INVALID_RESPONSE,
        'Missing authorization code or state parameter'
      );
    }

    // Retrieve stored authentication data
    const storedData = sessionStorage.getItem('shopify-auth-data');
    if (!storedData) {
      throw new AuthError(
        AuthErrorType.INVALID_RESPONSE,
        'No stored authentication data found'
      );
    }

    const authData = JSON.parse(storedData);

    // Validate state parameter for CSRF protection
    if (state !== authData.state) {
      throw new AuthError(
        AuthErrorType.INVALID_RESPONSE,
        'Invalid state parameter - possible CSRF attack'
      );
    }

    // Check for expired authentication attempt (5 minutes)
    const now = Date.now();
    if (now - authData.timestamp > 5 * 60 * 1000) {
      throw new AuthError(
        AuthErrorType.TOKEN_EXPIRED,
        'Authentication attempt expired'
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(
      code,
      authData.codeVerifier,
      process.env.CLIENT_ID!,
      process.env.REDIRECT_URI!
    );

    // Clean up stored data
    sessionStorage.removeItem('shopify-auth-data');

    // Store tokens securely
    const authState: AuthState = {
      isAuthenticated: true,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: Date.now() + (tokenResponse.expires_in * 1000)
    };

    // Store in localStorage for persistence
    localStorage.setItem('shopify-customer-auth', JSON.stringify(authState));

    logOrderOperation('customer_auth_success', 'system', {
      customerId: tokenResponse.customer_id
    });

    return authState;

  } catch (error) {
    logOrderOperation('customer_auth_callback_error', 'system', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      AuthErrorType.UNKNOWN_ERROR,
      'Failed to handle authentication callback',
      error as Error
    );
  }
}

/**
 * Exchanges authorization code for access and refresh tokens
 * Makes secure server-side request to Shopify's token endpoint
 * 
 * @param code - Authorization code from callback
 * @param codeVerifier - PKCE code verifier
 * @param clientId - OAuth client ID
 * @param redirectUri - OAuth redirect URI
 * @returns Token response with access and refresh tokens
 * @throws AuthError if token exchange fails
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  customer_id: string;
}> {
  try {
    const response = await fetch('/api/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        client_id: clientId,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AuthError(
        AuthErrorType.NETWORK_ERROR,
        `Token exchange failed: ${response.status} ${response.statusText}`,
        new Error(JSON.stringify(errorData))
      );
    }

    const tokenData = await response.json();

    if (!tokenData.access_token || !tokenData.refresh_token) {
      throw new AuthError(
        AuthErrorType.INVALID_RESPONSE,
        'Invalid token response from server'
      );
    }

    return tokenData;

  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      AuthErrorType.NETWORK_ERROR,
      'Failed to exchange authorization code for tokens',
      error as Error
    );
  }
}

/**
 * Retrieves current authentication state
 * Checks localStorage for stored authentication data
 * 
 * @returns Current authentication state or null if not authenticated
 */
export function getAuthState(): AuthState | null {
  try {
    const stored = localStorage.getItem('shopify-customer-auth');
    if (!stored) return null;

    const authState: AuthState = JSON.parse(stored);

    // Check if token is expired
    if (authState.expiresAt && Date.now() > authState.expiresAt) {
      // Token expired, clear storage
      localStorage.removeItem('shopify-customer-auth');
      return null;
    }

    return authState;

  } catch (error) {
    // Invalid stored data, clear it
    localStorage.removeItem('shopify-customer-auth');
    return null;
  }
}

/**
 * Checks if user is currently authenticated
 * Validates stored authentication state and token expiration
 * 
 * @returns True if user is authenticated with valid token
 */
export function isAuthenticated(): boolean {
  const authState = getAuthState();
  return authState?.isAuthenticated === true;
}

/**
 * Logs out the current user
 * Clears all stored authentication data
 */
export function logout(): void {
  localStorage.removeItem('shopify-customer-auth');
  sessionStorage.removeItem('shopify-auth-data');
  
  logOrderOperation('customer_logout', 'system');
}

/**
 * Refreshes expired access token using refresh token
 * Automatically handles token refresh for seamless user experience
 * 
 * @returns New authentication state with refreshed tokens
 * @throws AuthError if token refresh fails
 */
export async function refreshAccessToken(): Promise<AuthState> {
  try {
    const authState = getAuthState();
    if (!authState?.refreshToken) {
      throw new AuthError(
        AuthErrorType.TOKEN_EXPIRED,
        'No refresh token available'
      );
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: authState.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new AuthError(
        AuthErrorType.NETWORK_ERROR,
        `Token refresh failed: ${response.status} ${response.statusText}`
      );
    }

    const tokenData = await response.json();

    const newAuthState: AuthState = {
      ...authState,
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000)
    };

    // Update stored authentication state
    localStorage.setItem('shopify-customer-auth', JSON.stringify(newAuthState));

    logOrderOperation('token_refresh_success', 'system');

    return newAuthState;

  } catch (error) {
    logOrderOperation('token_refresh_error', 'system', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof AuthError) {
      throw error;
    }

    throw new AuthError(
      AuthErrorType.UNKNOWN_ERROR,
      'Failed to refresh access token',
      error as Error
    );
  }
}

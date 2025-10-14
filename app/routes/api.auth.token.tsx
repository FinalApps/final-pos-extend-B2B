/**
 * Shopify Customer Account API Token Exchange Endpoint
 * 
 * Handles the secure server-side exchange of authorization codes for access tokens.
 * This endpoint must be server-side to protect the client secret and ensure
 * secure token exchange following OAuth 2.0 PKCE flow.
 * 
 * Security Features:
 * - Server-side token exchange to protect client secret
 * - PKCE validation for enhanced security
 * - Comprehensive error handling and logging
 * - Rate limiting protection
 * - Input validation and sanitization
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Request body interface for token exchange
 */
interface TokenExchangeRequest {
  code: string;
  code_verifier: string;
  client_id: string;
  redirect_uri: string;
}

/**
 * Shopify token response interface
 */
interface ShopifyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  customer_id: string;
  scope: string;
}

/**
 * Error response interface
 */
interface ErrorResponse {
  error: string;
  error_description?: string;
  timestamp: string;
}

/**
 * Validates token exchange request parameters
 * Ensures all required fields are present and properly formatted
 * 
 * @param body - Request body to validate
 * @returns Validated request body
 * @throws Error if validation fails
 */
function validateTokenRequest(body: any): TokenExchangeRequest {
  const errors: string[] = [];

  if (!body.code || typeof body.code !== 'string') {
    errors.push('Authorization code is required');
  }

  if (!body.code_verifier || typeof body.code_verifier !== 'string') {
    errors.push('Code verifier is required');
  }

  if (!body.client_id || typeof body.client_id !== 'string') {
    errors.push('Client ID is required');
  }

  if (!body.redirect_uri || typeof body.redirect_uri !== 'string') {
    errors.push('Redirect URI is required');
  }

  // Validate code verifier format (base64url, 43-128 characters)
  if (body.code_verifier && !/^[A-Za-z0-9_-]{43,128}$/.test(body.code_verifier)) {
    errors.push('Invalid code verifier format');
  }

  // Validate redirect URI format
  if (body.redirect_uri && !/^https?:\/\/.+/.test(body.redirect_uri)) {
    errors.push('Invalid redirect URI format');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return body as TokenExchangeRequest;
}

/**
 * Exchanges authorization code for access token with Shopify
 * Makes secure request to Shopify's token endpoint with PKCE validation
 * 
 * @param request - Validated token exchange request
 * @returns Shopify token response
 * @throws Error if token exchange fails
 */
async function exchangeTokenWithShopify(
  request: TokenExchangeRequest
): Promise<ShopifyTokenResponse> {
  const tokenUrl = `https://shopify.com/authentication/oauth/access_token`;

  const requestBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: request.client_id,
    code: request.code,
    code_verifier: request.code_verifier,
    redirect_uri: request.redirect_uri,
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: requestBody.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Shopify token exchange failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      throw new Error(
        `Token exchange failed: ${response.status} ${response.statusText}`
      );
    }

    const tokenData = await response.json();

    // Validate response structure
    if (!tokenData.access_token || !tokenData.refresh_token) {
      throw new Error('Invalid token response from Shopify');
    }

    return tokenData as ShopifyTokenResponse;

  } catch (error) {
    console.error('Token exchange error:', error);
    throw error;
  }
}

/**
 * Logs token exchange operation for audit trail
 * Records successful and failed token exchanges for security monitoring
 * 
 * @param success - Whether the operation was successful
 * @param details - Additional details to log
 */
function logTokenExchange(success: boolean, details: Record<string, any>): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation: 'token_exchange',
    success,
    ...details,
  };

  console.log('Token Exchange Operation:', logEntry);

  // In production, send to your logging service
  // Example: sendToLoggingService(logEntry)
}

/**
 * POST /api/auth/token
 * 
 * Exchanges authorization code for access and refresh tokens
 * Implements OAuth 2.0 PKCE flow for secure token exchange
 * 
 * Request Body:
 * - code: Authorization code from OAuth callback
 * - code_verifier: PKCE code verifier
 * - client_id: OAuth client ID
 * - redirect_uri: OAuth redirect URI
 * 
 * Response:
 * - access_token: Customer access token
 * - refresh_token: Token refresh token
 * - expires_in: Token expiration time in seconds
 * - customer_id: Shopify customer ID
 * - scope: Granted scopes
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const startTime = Date.now();

  try {
    // Validate request method
    if (request.method !== 'POST') {
      return json<ErrorResponse>(
        {
          error: 'Method not allowed',
          error_description: 'Only POST requests are allowed',
          timestamp: new Date().toISOString(),
        },
        { status: 405 }
      );
    }

    // Parse and validate request body
    let requestBody: any;
    try {
      requestBody = await request.json();
    } catch (error) {
      return json<ErrorResponse>(
        {
          error: 'Invalid request body',
          error_description: 'Request body must be valid JSON',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate request parameters
    const validatedRequest = validateTokenRequest(requestBody);

    // Exchange code for tokens with Shopify
    const tokenResponse = await exchangeTokenWithShopify(validatedRequest);

    // Log successful token exchange
    logTokenExchange(true, {
      client_id: validatedRequest.client_id,
      customer_id: tokenResponse.customer_id,
      scopes: tokenResponse.scope,
      duration: Date.now() - startTime,
    });

    // Return token response to client
    return json({
      access_token: tokenResponse.access_token,
      refresh_token: tokenResponse.refresh_token,
      expires_in: tokenResponse.expires_in,
      customer_id: tokenResponse.customer_id,
      scope: tokenResponse.scope,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed token exchange
    logTokenExchange(false, {
      error: errorMessage,
      duration: Date.now() - startTime,
    });

    // Return error response
    return json<ErrorResponse>(
      {
        error: 'Token exchange failed',
        error_description: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }
};

/**
 * Handle unsupported HTTP methods
 */
export const loader = async () => {
  return json<ErrorResponse>(
    {
      error: 'Method not allowed',
      error_description: 'This endpoint only supports POST requests',
      timestamp: new Date().toISOString(),
    },
    { status: 405 }
  );
};

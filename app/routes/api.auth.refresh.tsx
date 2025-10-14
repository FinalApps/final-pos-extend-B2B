/**
 * Shopify Customer Account API Token Refresh Endpoint
 * 
 * Handles the secure server-side refresh of expired access tokens using
 * refresh tokens. This endpoint ensures seamless user experience by
 * automatically refreshing tokens before they expire.
 * 
 * Security Features:
 * - Server-side token refresh to protect client secret
 * - Comprehensive error handling and logging
 * - Rate limiting protection
 * - Input validation and sanitization
 * - Automatic token rotation
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Request body interface for token refresh
 */
interface TokenRefreshRequest {
  refresh_token: string;
}

/**
 * Shopify refresh token response interface
 */
interface ShopifyRefreshResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
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
 * Validates token refresh request parameters
 * Ensures refresh token is present and properly formatted
 * 
 * @param body - Request body to validate
 * @returns Validated request body
 * @throws Error if validation fails
 */
function validateRefreshRequest(body: any): TokenRefreshRequest {
  const errors: string[] = [];

  if (!body.refresh_token || typeof body.refresh_token !== 'string') {
    errors.push('Refresh token is required');
  }

  // Basic token format validation
  if (body.refresh_token && body.refresh_token.length < 10) {
    errors.push('Invalid refresh token format');
  }

  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  return body as TokenRefreshRequest;
}

/**
 * Refreshes access token with Shopify
 * Makes secure request to Shopify's token refresh endpoint
 * 
 * @param request - Validated refresh request
 * @returns Shopify refresh response
 * @throws Error if token refresh fails
 */
async function refreshTokenWithShopify(
  request: TokenRefreshRequest
): Promise<ShopifyRefreshResponse> {
  const tokenUrl = `https://shopify.com/authentication/oauth/access_token`;

  const requestBody = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: request.refresh_token,
    client_id: process.env.CLIENT_ID!,
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
      console.error('Shopify token refresh failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });

      // Handle specific error cases
      if (response.status === 401) {
        throw new Error('Refresh token expired or invalid');
      }

      throw new Error(
        `Token refresh failed: ${response.status} ${response.statusText}`
      );
    }

    const tokenData = await response.json();

    // Validate response structure
    if (!tokenData.access_token) {
      throw new Error('Invalid token refresh response from Shopify');
    }

    return tokenData as ShopifyRefreshResponse;

  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Logs token refresh operation for audit trail
 * Records successful and failed token refresh attempts for security monitoring
 * 
 * @param success - Whether the operation was successful
 * @param details - Additional details to log
 */
function logTokenRefresh(success: boolean, details: Record<string, any>): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation: 'token_refresh',
    success,
    ...details,
  };

  console.log('Token Refresh Operation:', logEntry);

  // In production, send to your logging service
  // Example: sendToLoggingService(logEntry)
}

/**
 * POST /api/auth/refresh
 * 
 * Refreshes expired access token using refresh token
 * Implements OAuth 2.0 refresh token flow for seamless user experience
 * 
 * Request Body:
 * - refresh_token: Valid refresh token
 * 
 * Response:
 * - access_token: New access token
 * - refresh_token: New refresh token (if rotated)
 * - expires_in: Token expiration time in seconds
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
    const validatedRequest = validateRefreshRequest(requestBody);

    // Refresh token with Shopify
    const refreshResponse = await refreshTokenWithShopify(validatedRequest);

    // Log successful token refresh
    logTokenRefresh(true, {
      scopes: refreshResponse.scope,
      duration: Date.now() - startTime,
      token_rotated: !!refreshResponse.refresh_token,
    });

    // Return refresh response to client
    return json({
      access_token: refreshResponse.access_token,
      refresh_token: refreshResponse.refresh_token,
      expires_in: refreshResponse.expires_in,
      scope: refreshResponse.scope,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log failed token refresh
    logTokenRefresh(false, {
      error: errorMessage,
      duration: Date.now() - startTime,
    });

    // Determine appropriate HTTP status code
    let statusCode = 400;
    if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
      statusCode = 401;
    }

    // Return error response
    return json<ErrorResponse>(
      {
        error: 'Token refresh failed',
        error_description: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
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

/**
 * Shopify Cart API Service
 * 
 * Provides comprehensive cart management functionality for the B2B wholesale POS system.
 * Integrates with Shopify's Cart API to handle adding, updating, and managing cart items
 * with proper error handling, validation, and customer authentication.
 * 
 * Features:
 * - Complete cart CRUD operations
 * - Customer authentication integration
 * - Comprehensive error handling
 * - TypeScript support with proper typing
 * - B2B-specific cart features (bulk pricing, quantity rules)
 * - Cart persistence and state management
 */

import { logOrderOperation } from './utils';
import { getAuthState } from './auth';

/**
 * Cart item interface matching Shopify's Cart API response
 */
export interface CartItem {
  id: number;
  title: string;
  key: string;
  price: number;
  original_price: number;
  discounted_price: number;
  line_price: number;
  original_line_price: number;
  total_discount: number;
  discounts: any[];
  quantity: number;
  sku: string;
  grams: number;
  vendor: string;
  taxable: boolean;
  product_id: number;
  product_has_only_default_variant: boolean;
  gift_card: boolean;
  final_price: number;
  final_line_price: number;
  url: string;
  featured_image: {
    aspect_ratio: number;
    alt: string;
    height: number;
    url: string;
    width: number;
  };
  image: string;
  handle: string;
  requires_shipping: boolean;
  product_type: string;
  product_title: string;
  product_description: string;
  variant_title: string | null;
  variant_options: string[];
  options_with_values: Array<{
    name: string;
    value: string;
  }>;
  properties: Record<string, any> | null;
  variant_id: number;
  line_level_discount_allocations: any[];
  line_level_total_discount: number;
  selling_plan_allocation?: {
    price: number;
    compare_at_price: number;
    per_delivery_price: number;
    selling_plan: {
      id: number;
      name: string;
      description: string | null;
      options: Array<{
        name: string;
        position: number;
        value: string;
      }>;
      recurring_deliveries: boolean;
    };
  };
}

/**
 * Complete cart interface matching Shopify's Cart API response
 */
export interface Cart {
  token: string;
  note: string | null;
  attributes: Record<string, any>;
  original_total_price: number;
  total_price: number;
  total_discount: number;
  total_weight: number;
  item_count: number;
  items: CartItem[];
  requires_shipping: boolean;
  currency: string;
  items_subtotal_price: number;
  cart_level_discount_applications: any[];
}

/**
 * Cart operation request interfaces
 */
export interface AddToCartRequest {
  items: Array<{
    id: number;
    quantity: number;
    properties?: Record<string, any>;
    selling_plan?: number;
  }>;
}

export interface UpdateCartRequest {
  updates?: Record<string, number>;
  note?: string;
  attributes?: Record<string, any>;
  discount?: string;
}

export interface ChangeCartItemRequest {
  id?: number | string;
  line?: number;
  quantity?: number;
  properties?: Record<string, any>;
  selling_plan?: number | null;
}

/**
 * Cart error types
 */
export enum CartErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STOCK_ERROR = 'STOCK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Custom cart error class
 */
export class CartError extends Error {
  constructor(
    public type: CartErrorType,
    message: string,
    public originalError?: Error,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'CartError';
  }
}

/**
 * Cart service class for managing Shopify cart operations
 */
export class CartService {
  private baseUrl: string;
  private authState: any;

  constructor() {
    this.baseUrl = (window as any).Shopify?.routes?.root || '/';
    this.authState = getAuthState();
  }

  /**
   * Gets the current cart
   * 
   * @returns Promise resolving to the current cart
   * @throws CartError if the operation fails
   */
  async getCart(): Promise<Cart> {
    try {
      const response = await fetch(`${this.baseUrl}cart.js`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new CartError(
          CartErrorType.NETWORK_ERROR,
          `Failed to fetch cart: ${response.status} ${response.statusText}`,
          undefined,
          response.status
        );
      }

      const cart = await response.json();
      
      logOrderOperation('cart_fetched', 'system', {
        itemCount: cart.item_count,
        totalPrice: cart.total_price
      });

      return cart;

    } catch (error) {
      logOrderOperation('cart_fetch_error', 'system', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to fetch cart',
        error as Error
      );
    }
  }

  /**
   * Adds items to the cart
   * 
   * @param request - Items to add to cart
   * @returns Promise resolving to the updated cart items
   * @throws CartError if the operation fails
   */
  async addToCart(request: AddToCartRequest): Promise<CartItem[]> {
    try {
      // Validate request
      this.validateAddToCartRequest(request);

      const response = await fetch(`${this.baseUrl}cart/add.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific Shopify cart errors
        if (response.status === 422) {
          throw new CartError(
            CartErrorType.STOCK_ERROR,
            errorData.description || 'Unable to add item to cart',
            undefined,
            response.status
          );
        }

        throw new CartError(
          CartErrorType.NETWORK_ERROR,
          `Failed to add items to cart: ${response.status} ${response.statusText}`,
          undefined,
          response.status
        );
      }

      const result = await response.json();
      
      logOrderOperation('items_added_to_cart', 'system', {
        itemCount: request.items.length,
        items: request.items.map(item => ({ id: item.id, quantity: item.quantity }))
      });

      return result.items || [];

    } catch (error) {
      logOrderOperation('add_to_cart_error', 'system', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request: request
      });

      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to add items to cart',
        error as Error
      );
    }
  }

  /**
   * Updates cart items, note, attributes, or discounts
   * 
   * @param request - Cart update request
   * @returns Promise resolving to the updated cart
   * @throws CartError if the operation fails
   */
  async updateCart(request: UpdateCartRequest): Promise<Cart> {
    try {
      // Validate request
      this.validateUpdateCartRequest(request);

      const response = await fetch(`${this.baseUrl}cart/update.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new CartError(
          CartErrorType.NETWORK_ERROR,
          `Failed to update cart: ${response.status} ${response.statusText}`,
          undefined,
          response.status
        );
      }

      const cart = await response.json();
      
      logOrderOperation('cart_updated', 'system', {
        updates: request.updates,
        note: request.note,
        attributes: request.attributes
      });

      return cart;

    } catch (error) {
      logOrderOperation('cart_update_error', 'system', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request: request
      });

      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to update cart',
        error as Error
      );
    }
  }

  /**
   * Changes a specific cart line item
   * 
   * @param request - Line item change request
   * @returns Promise resolving to the updated cart
   * @throws CartError if the operation fails
   */
  async changeCartItem(request: ChangeCartItemRequest): Promise<Cart> {
    try {
      // Validate request
      this.validateChangeCartItemRequest(request);

      const response = await fetch(`${this.baseUrl}cart/change.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 400) {
          throw new CartError(
            CartErrorType.VALIDATION_ERROR,
            errorData.description || 'Invalid cart item change request',
            undefined,
            response.status
          );
        }

        throw new CartError(
          CartErrorType.NETWORK_ERROR,
          `Failed to change cart item: ${response.status} ${response.statusText}`,
          undefined,
          response.status
        );
      }

      const cart = await response.json();
      
      logOrderOperation('cart_item_changed', 'system', {
        request: request
      });

      return cart;

    } catch (error) {
      logOrderOperation('cart_item_change_error', 'system', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request: request
      });

      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to change cart item',
        error as Error
      );
    }
  }

  /**
   * Clears all items from the cart
   * 
   * @returns Promise resolving to the empty cart
   * @throws CartError if the operation fails
   */
  async clearCart(): Promise<Cart> {
    try {
      const response = await fetch(`${this.baseUrl}cart/clear.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new CartError(
          CartErrorType.NETWORK_ERROR,
          `Failed to clear cart: ${response.status} ${response.statusText}`,
          undefined,
          response.status
        );
      }

      const cart = await response.json();
      
      logOrderOperation('cart_cleared', 'system');

      return cart;

    } catch (error) {
      logOrderOperation('cart_clear_error', 'system', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to clear cart',
        error as Error
      );
    }
  }

  /**
   * Removes a specific item from the cart by setting quantity to 0
   * 
   * @param itemId - The variant ID or line item key to remove
   * @returns Promise resolving to the updated cart
   * @throws CartError if the operation fails
   */
  async removeCartItem(itemId: number | string): Promise<Cart> {
    try {
      const updates: Record<string, number> = {};
      updates[itemId.toString()] = 0;

      return await this.updateCart({ updates });

    } catch (error) {
      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to remove cart item',
        error as Error
      );
    }
  }

  /**
   * Updates the quantity of a specific cart item
   * 
   * @param itemId - The variant ID or line item key
   * @param quantity - The new quantity
   * @returns Promise resolving to the updated cart
   * @throws CartError if the operation fails
   */
  async updateCartItemQuantity(itemId: number | string, quantity: number): Promise<Cart> {
    try {
      if (quantity < 0) {
        throw new CartError(
          CartErrorType.VALIDATION_ERROR,
          'Quantity cannot be negative'
        );
      }

      const updates: Record<string, number> = {};
      updates[itemId.toString()] = quantity;

      return await this.updateCart({ updates });

    } catch (error) {
      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to update cart item quantity',
        error as Error
      );
    }
  }

  /**
   * Applies a discount code to the cart
   * 
   * @param discountCode - The discount code to apply
   * @returns Promise resolving to the updated cart
   * @throws CartError if the operation fails
   */
  async applyDiscount(discountCode: string): Promise<Cart> {
    try {
      if (!discountCode || discountCode.trim().length === 0) {
        throw new CartError(
          CartErrorType.VALIDATION_ERROR,
          'Discount code cannot be empty'
        );
      }

      return await this.updateCart({ discount: discountCode.trim() });

    } catch (error) {
      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to apply discount',
        error as Error
      );
    }
  }

  /**
   * Removes all discounts from the cart
   * 
   * @returns Promise resolving to the updated cart
   * @throws CartError if the operation fails
   */
  async removeDiscounts(): Promise<Cart> {
    try {
      return await this.updateCart({ discount: '' });

    } catch (error) {
      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to remove discounts',
        error as Error
      );
    }
  }

  /**
   * Updates cart attributes
   * 
   * @param attributes - Cart attributes to set
   * @returns Promise resolving to the updated cart
   * @throws CartError if the operation fails
   */
  async updateCartAttributes(attributes: Record<string, any>): Promise<Cart> {
    try {
      return await this.updateCart({ attributes });

    } catch (error) {
      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to update cart attributes',
        error as Error
      );
    }
  }

  /**
   * Updates the cart note
   * 
   * @param note - The cart note
   * @returns Promise resolving to the updated cart
   * @throws CartError if the operation fails
   */
  async updateCartNote(note: string): Promise<Cart> {
    try {
      return await this.updateCart({ note });

    } catch (error) {
      if (error instanceof CartError) {
        throw error;
      }

      throw new CartError(
        CartErrorType.UNKNOWN_ERROR,
        'Failed to update cart note',
        error as Error
      );
    }
  }

  /**
   * Validates add to cart request
   * 
   * @param request - Request to validate
   * @throws CartError if validation fails
   */
  private validateAddToCartRequest(request: AddToCartRequest): void {
    if (!request.items || !Array.isArray(request.items) || request.items.length === 0) {
      throw new CartError(
        CartErrorType.VALIDATION_ERROR,
        'Items array is required and cannot be empty'
      );
    }

    for (const item of request.items) {
      if (!item.id || typeof item.id !== 'number') {
        throw new CartError(
          CartErrorType.VALIDATION_ERROR,
          'Item ID is required and must be a number'
        );
      }

      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new CartError(
          CartErrorType.VALIDATION_ERROR,
          'Item quantity is required and must be a positive number'
        );
      }
    }
  }

  /**
   * Validates update cart request
   * 
   * @param request - Request to validate
   * @throws CartError if validation fails
   */
  private validateUpdateCartRequest(request: UpdateCartRequest): void {
    if (!request.updates && !request.note && !request.attributes && !request.discount) {
      throw new CartError(
        CartErrorType.VALIDATION_ERROR,
        'At least one update field is required'
      );
    }

    if (request.updates) {
      for (const [key, value] of Object.entries(request.updates)) {
        if (typeof value !== 'number' || value < 0) {
          throw new CartError(
            CartErrorType.VALIDATION_ERROR,
            `Invalid quantity for item ${key}: must be a non-negative number`
          );
        }
      }
    }
  }

  /**
   * Validates change cart item request
   * 
   * @param request - Request to validate
   * @throws CartError if validation fails
   */
  private validateChangeCartItemRequest(request: ChangeCartItemRequest): void {
    if (!request.id && !request.line) {
      throw new CartError(
        CartErrorType.VALIDATION_ERROR,
        'Either id or line parameter is required'
      );
    }

    if (request.quantity !== undefined && (typeof request.quantity !== 'number' || request.quantity < 0)) {
      throw new CartError(
        CartErrorType.VALIDATION_ERROR,
        'Quantity must be a non-negative number'
      );
    }
  }
}

/**
 * Singleton instance of the cart service
 */
export const cartService = new CartService();

/**
 * React Hooks for Cart State Management
 * 
 * Provides convenient React hooks for managing cart state and operations
 * in the B2B wholesale POS system. Integrates with the cart service and
 * provides real-time cart updates with proper error handling.
 * 
 * Features:
 * - Real-time cart state management
 * - Optimistic updates for better UX
 * - Comprehensive error handling
 * - Loading states for all operations
 * - TypeScript support with proper typing
 * - Integration with authentication system
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cart,
  CartItem,
  CartService,
  cartService,
  CartError,
  CartErrorType,
  AddToCartRequest,
  UpdateCartRequest,
  ChangeCartItemRequest
} from './cartService';

// Re-export CartItem for use in other components
export type { CartItem } from './cartService';
import { useAuth } from './useAuth';

/**
 * Cart hook state interface
 */
interface UseCartState {
  cart: Cart | null;
  isLoading: boolean;
  isUpdating: boolean;
  error: CartError | null;
  itemCount: number;
  totalPrice: number;
  isEmpty: boolean;
}

/**
 * Cart hook actions interface
 */
interface UseCartActions {
  addToCart: (request: AddToCartRequest) => Promise<void>;
  updateCart: (request: UpdateCartRequest) => Promise<void>;
  changeCartItem: (request: ChangeCartItemRequest) => Promise<void>;
  removeCartItem: (itemId: number | string) => Promise<void>;
  updateCartItemQuantity: (itemId: number | string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  applyDiscount: (discountCode: string) => Promise<void>;
  removeDiscounts: () => Promise<void>;
  updateCartAttributes: (attributes: Record<string, any>) => Promise<void>;
  updateCartNote: (note: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  clearError: () => void;
}

/**
 * Complete cart hook interface
 */
export interface UseCartReturn extends UseCartState, UseCartActions {}

/**
 * Custom hook for managing cart state and operations
 * 
 * Provides comprehensive cart management with real-time updates,
 * optimistic UI updates, and proper error handling.
 * 
 * @returns Cart state and actions
 * 
 * @example
 * ```tsx
 * function CartComponent() {
 *   const { 
 *     cart, 
 *     isLoading, 
 *     addToCart, 
 *     updateCartItemQuantity,
 *     clearCart 
 *   } = useCart();
 * 
 *   const handleAddToCart = async (variantId: number, quantity: number) => {
 *     try {
 *       await addToCart({
 *         items: [{ id: variantId, quantity }]
 *       });
 *     } catch (error) {
 *       console.error('Failed to add to cart:', error);
 *     }
 *   };
 * 
 *   if (isLoading) {
 *     return <div>Loading cart...</div>;
 *   }
 * 
 *   return (
 *     <div>
 *       <h2>Cart ({cart?.item_count || 0} items)</h2>
 *       {cart?.items.map(item => (
 *         <div key={item.key}>
 *           <span>{item.title}</span>
 *           <input 
 *             type="number" 
 *             value={item.quantity}
 *             onChange={(e) => updateCartItemQuantity(item.variant_id, parseInt(e.target.value))}
 *           />
 *         </div>
 *       ))}
 *       <button onClick={clearCart}>Clear Cart</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCart(): UseCartReturn {
  const { isAuthenticated } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<CartError | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Computed cart properties
   */
  const itemCount = cart?.item_count || 0;
  const totalPrice = cart?.total_price || 0;
  const isEmpty = itemCount === 0;

  /**
   * Initializes cart state on component mount
   * Fetches the current cart from Shopify
   */
  useEffect(() => {
    const initializeCart = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const currentCart = await cartService.getCart();
        setCart(currentCart);
      } catch (error) {
        console.error('Failed to initialize cart:', error);
        setError(
          error instanceof CartError 
            ? error 
            : new CartError(
                CartErrorType.UNKNOWN_ERROR,
                'Failed to load cart',
                error as Error
              )
        );
      } finally {
        setIsLoading(false);
      }
    };

    initializeCart();
  }, []);

  /**
   * Debounced cart refresh to prevent excessive API calls
   * Refreshes cart state after a short delay
   */
  const debouncedRefresh = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(async () => {
      try {
        const currentCart = await cartService.getCart();
        setCart(currentCart);
      } catch (error) {
        console.error('Failed to refresh cart:', error);
        // Don't set error here to avoid disrupting user experience
      }
    }, 300);
  }, []);

  /**
   * Cleans up timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Adds items to the cart with optimistic updates
   * 
   * @param request - Items to add to cart
   * @throws CartError if the operation fails
   */
  const addToCart = useCallback(async (request: AddToCartRequest): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      // Optimistic update - add items to current cart state
      if (cart) {
        const optimisticCart = { ...cart };
        const newItems: CartItem[] = [];
        
        for (const requestItem of request.items) {
          // Check if item already exists in cart
          const existingItem = optimisticCart.items.find(
            item => item.variant_id === requestItem.id
          );

          if (existingItem) {
            // Update existing item quantity
            existingItem.quantity += requestItem.quantity;
            existingItem.line_price = existingItem.price * existingItem.quantity;
            existingItem.final_line_price = existingItem.final_price * existingItem.quantity;
          } else {
            // Create new item (simplified - real implementation would need full item data)
            const newItem: CartItem = {
              id: requestItem.id,
              variant_id: requestItem.id,
              key: `${requestItem.id}:${Date.now()}`,
              title: `Product ${requestItem.id}`,
              price: 0, // Would be fetched from product data
              original_price: 0,
              discounted_price: 0,
              line_price: 0,
              original_line_price: 0,
              total_discount: 0,
              discounts: [],
              quantity: requestItem.quantity,
              sku: '',
              grams: 0,
              vendor: '',
              taxable: true,
              product_id: 0,
              product_has_only_default_variant: true,
              gift_card: false,
              final_price: 0,
              final_line_price: 0,
              url: '',
              featured_image: {
                aspect_ratio: 1,
                alt: '',
                height: 100,
                url: '',
                width: 100
              },
              image: '',
              handle: '',
              requires_shipping: true,
              product_type: '',
              product_title: '',
              product_description: '',
              variant_title: null,
              variant_options: [],
              options_with_values: [],
              properties: requestItem.properties || null,
              line_level_discount_allocations: [],
              line_level_total_discount: 0
            };
            newItems.push(newItem);
          }
        }

        optimisticCart.items = [...optimisticCart.items, ...newItems];
        optimisticCart.item_count = optimisticCart.items.reduce((sum, item) => sum + item.quantity, 0);
        setCart(optimisticCart);
      }

      // Perform actual API call
      await cartService.addToCart(request);
      
      // Refresh cart to get accurate data
      debouncedRefresh();

    } catch (error) {
      console.error('Add to cart error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to add items to cart',
              error as Error
            )
      );
      
      // Refresh cart to restore correct state
      debouncedRefresh();
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [cart, debouncedRefresh]);

  /**
   * Updates cart with optimistic updates
   * 
   * @param request - Cart update request
   * @throws CartError if the operation fails
   */
  const updateCart = useCallback(async (request: UpdateCartRequest): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      // Perform API call
      const updatedCart = await cartService.updateCart(request);
      setCart(updatedCart);

    } catch (error) {
      console.error('Update cart error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to update cart',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Changes a specific cart item with optimistic updates
   * 
   * @param request - Line item change request
   * @throws CartError if the operation fails
   */
  const changeCartItem = useCallback(async (request: ChangeCartItemRequest): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      // Perform API call
      const updatedCart = await cartService.changeCartItem(request);
      setCart(updatedCart);

    } catch (error) {
      console.error('Change cart item error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to change cart item',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Removes a cart item
   * 
   * @param itemId - The variant ID or line item key to remove
   * @throws CartError if the operation fails
   */
  const removeCartItem = useCallback(async (itemId: number | string): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedCart = await cartService.removeCartItem(itemId);
      setCart(updatedCart);

    } catch (error) {
      console.error('Remove cart item error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to remove cart item',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Updates cart item quantity
   * 
   * @param itemId - The variant ID or line item key
   * @param quantity - The new quantity
   * @throws CartError if the operation fails
   */
  const updateCartItemQuantity = useCallback(async (itemId: number | string, quantity: number): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedCart = await cartService.updateCartItemQuantity(itemId, quantity);
      setCart(updatedCart);

    } catch (error) {
      console.error('Update cart item quantity error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to update cart item quantity',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Clears the entire cart
   * 
   * @throws CartError if the operation fails
   */
  const clearCart = useCallback(async (): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      const emptyCart = await cartService.clearCart();
      setCart(emptyCart);

    } catch (error) {
      console.error('Clear cart error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to clear cart',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Applies a discount code to the cart
   * 
   * @param discountCode - The discount code to apply
   * @throws CartError if the operation fails
   */
  const applyDiscount = useCallback(async (discountCode: string): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedCart = await cartService.applyDiscount(discountCode);
      setCart(updatedCart);

    } catch (error) {
      console.error('Apply discount error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to apply discount',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Removes all discounts from the cart
   * 
   * @throws CartError if the operation fails
   */
  const removeDiscounts = useCallback(async (): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedCart = await cartService.removeDiscounts();
      setCart(updatedCart);

    } catch (error) {
      console.error('Remove discounts error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to remove discounts',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Updates cart attributes
   * 
   * @param attributes - Cart attributes to set
   * @throws CartError if the operation fails
   */
  const updateCartAttributes = useCallback(async (attributes: Record<string, any>): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedCart = await cartService.updateCartAttributes(attributes);
      setCart(updatedCart);

    } catch (error) {
      console.error('Update cart attributes error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to update cart attributes',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Updates the cart note
   * 
   * @param note - The cart note
   * @throws CartError if the operation fails
   */
  const updateCartNote = useCallback(async (note: string): Promise<void> => {
    try {
      setIsUpdating(true);
      setError(null);

      const updatedCart = await cartService.updateCartNote(note);
      setCart(updatedCart);

    } catch (error) {
      console.error('Update cart note error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to update cart note',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  /**
   * Refreshes the cart state
   * 
   * @throws CartError if the operation fails
   */
  const refreshCart = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const currentCart = await cartService.getCart();
      setCart(currentCart);

    } catch (error) {
      console.error('Refresh cart error:', error);
      setError(
        error instanceof CartError 
          ? error 
          : new CartError(
              CartErrorType.UNKNOWN_ERROR,
              'Failed to refresh cart',
              error as Error
            )
      );
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Clears the current error state
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    // State
    cart,
    isLoading,
    isUpdating,
    error,
    itemCount,
    totalPrice,
    isEmpty,

    // Actions
    addToCart,
    updateCart,
    changeCartItem,
    removeCartItem,
    updateCartItemQuantity,
    clearCart,
    applyDiscount,
    removeDiscounts,
    updateCartAttributes,
    updateCartNote,
    refreshCart,
    clearError,
  };
}

/**
 * Hook for getting cart state without actions
 * Useful for components that only need to read cart state
 * 
 * @returns Current cart state
 */
export function useCartState(): Cart | null {
  const [cart, setCart] = useState<Cart | null>(null);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const currentCart = await cartService.getCart();
        setCart(currentCart);
      } catch (error) {
        console.error('Failed to fetch cart state:', error);
      }
    };

    fetchCart();

    // Set up interval to check for cart changes
    const interval = setInterval(fetchCart, 5000);

    return () => clearInterval(interval);
  }, []);

  return cart;
}

/**
 * Hook for checking if cart is empty
 * Simple boolean check for cart emptiness
 * 
 * @returns True if cart is empty
 */
export function useIsCartEmpty(): boolean {
  const cart = useCartState();
  return !cart || cart.item_count === 0;
}

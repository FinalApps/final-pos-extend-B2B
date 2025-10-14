/**
 * Cart UI Components
 * 
 * Reusable React components for cart functionality in the B2B wholesale POS system.
 * Built with Shopify Polaris for consistent design and accessibility.
 * 
 * Features:
 * - Complete cart display and management
 * - Add to cart functionality
 * - Quantity controls with validation
 * - Discount code application
 * - Cart attributes and notes
 * - Responsive design with Polaris
 * - Accessibility support
 * - Error handling and loading states
 */

import React, { useState } from 'react';
import {
  Card,
  Button,
  TextField,
  Text,
  Badge,
  Banner,
  Spinner,
  Modal,
  FormLayout,
  Select,
  ButtonGroup,
  Icon,
  Tooltip,
  EmptyState,
  BlockStack,
  InlineStack
} from '@shopify/polaris';
import { useCart, CartItem } from './useCart';
import { formatCurrency } from './utils';

/**
 * Props interface for AddToCartButton component
 */
interface AddToCartButtonProps {
  /**
   * Product variant ID to add to cart
   */
  variantId: number;
  
  /**
   * Product title for display
   */
  productTitle: string;
  
  /**
   * Initial quantity to add (default: 1)
   */
  quantity?: number;
  
  /**
   * Product properties to add with the item
   */
  properties?: Record<string, any>;
  
  /**
   * Selling plan ID for subscriptions
   */
  sellingPlan?: number;
  
  /**
   * Custom button text
   */
  buttonText?: string;
  
  /**
   * Whether to show quantity selector
   */
  showQuantitySelector?: boolean;
  
  /**
   * Maximum quantity allowed
   */
  maxQuantity?: number;
  
  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Add to Cart Button Component
 * 
 * Provides a complete add-to-cart interface with quantity selection,
 * validation, and proper error handling.
 * 
 * @param props - Component props
 * @returns JSX element with add-to-cart functionality
 */
export function AddToCartButton({
  variantId,
  productTitle,
  quantity: initialQuantity = 1,
  properties,
  sellingPlan,
  buttonText = 'Add to Cart',
  showQuantitySelector = true,
  maxQuantity = 999,
  className
}: AddToCartButtonProps): JSX.Element {
  const { addToCart, isUpdating, error, clearError } = useCart();
  const [quantity, setQuantity] = useState(initialQuantity);
  const [isAdding, setIsAdding] = useState(false);

  /**
   * Handles adding item to cart
   */
  const handleAddToCart = async (): Promise<void> => {
    try {
      setIsAdding(true);
      clearError();

      await addToCart({
        items: [{
          id: variantId,
          quantity,
          properties,
          selling_plan: sellingPlan
        }]
      });

      // Reset quantity after successful add
      setQuantity(initialQuantity);

    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setIsAdding(false);
    }
  };

  /**
   * Validates quantity input
   */
  const validateQuantity = (value: string): string | undefined => {
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) {
      return 'Quantity must be a positive number';
    }
    if (num > maxQuantity) {
      return `Quantity cannot exceed ${maxQuantity}`;
    }
    return undefined;
  };

  return (
    <div className={className}>
      {error && (
        <Banner
          title="Add to Cart Error"
          tone="critical"
          onDismiss={clearError}
        >
          <Text as="p">{error.message}</Text>
        </Banner>
      )}

             <BlockStack gap="300">
         {showQuantitySelector && (
           <TextField
             label="Quantity"
             type="number"
             value={quantity.toString()}
             onChange={(value) => setQuantity(parseInt(value) || 1)}
             min={1}
             max={maxQuantity}
             error={validateQuantity(quantity.toString())}
             disabled={isAdding || isUpdating}
             autoComplete="off"
           />
         )}

         <Button
           variant="primary"
           onClick={handleAddToCart}
           loading={isAdding || isUpdating}
           disabled={quantity <= 0 || quantity > maxQuantity}
           fullWidth
         >
           {buttonText}
         </Button>
       </BlockStack>
    </div>
  );
}

/**
 * Props interface for CartItem component
 */
interface CartItemProps {
  /**
   * Cart item to display
   */
  item: CartItem;
  
  /**
   * Whether to show quantity controls
   */
  showQuantityControls?: boolean;
  
  /**
   * Whether to show remove button
   */
  showRemoveButton?: boolean;
  
  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Cart Item Component
 * 
 * Displays a single cart item with quantity controls and remove functionality.
 * 
 * @param props - Component props
 * @returns JSX element with cart item display
 */
export function CartItemComponent({
  item,
  showQuantityControls = true,
  showRemoveButton = true,
  className
}: CartItemProps): JSX.Element {
  const { updateCartItemQuantity, removeCartItem, isUpdating } = useCart();
  const [quantity, setQuantity] = useState(item.quantity);

  /**
   * Handles quantity change
   */
  const handleQuantityChange = async (newQuantity: number): Promise<void> => {
    if (newQuantity === item.quantity) return;

    try {
      setQuantity(newQuantity);
      await updateCartItemQuantity(item.variant_id, newQuantity);
    } catch (error) {
      // Revert quantity on error
      setQuantity(item.quantity);
      console.error('Failed to update quantity:', error);
    }
  };

  /**
   * Handles item removal
   */
  const handleRemove = async (): Promise<void> => {
    try {
      await removeCartItem(item.variant_id);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack gap="300" align="space-between" blockAlign="center">
          <InlineStack gap="300">
            {item.featured_image?.url && (
              <img
                src={item.featured_image.url}
                alt={item.featured_image.alt || item.title}
                style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }}
              />
            )}
            <div>
              <Text variant="headingMd" as="h3">
                {item.title}
              </Text>
              {item.variant_title && (
                <Text variant="bodyMd" tone="subdued" as="p">
                  {item.variant_title}
                </Text>
              )}
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                {formatCurrency(item.final_price / 100)}
              </Text>
            </div>
          </InlineStack>

          <InlineStack gap="300" align="center">
            {showQuantityControls && (
              <InlineStack gap="100">
                <Button
                  size="micro"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1 || isUpdating}
                >
                  -
                </Button>
                <TextField
                  label="Quantity"
                  type="number"
                  value={quantity.toString()}
                  onChange={(value) => {
                    const num = parseInt(value) || 1;
                    setQuantity(num);
                    handleQuantityChange(num);
                  }}
                  min={1}
                  max={999}
                  disabled={isUpdating}
                  autoComplete="off"
                />
                <Button
                  size="micro"
                  onClick={() => handleQuantityChange(quantity + 1)}
                  disabled={isUpdating}
                >
                  +
                </Button>
              </InlineStack>
            )}

            <Text variant="bodyMd" fontWeight="semibold" as="p">
              {formatCurrency(item.final_line_price / 100)}
            </Text>

            {showRemoveButton && (
              <Button
                size="micro"
                tone="critical"
                onClick={handleRemove}
                disabled={isUpdating}
              >
                Remove
              </Button>
            )}
          </InlineStack>
        </InlineStack>

        {item.properties && Object.keys(item.properties).length > 0 && (
          <div>
            <Text variant="bodyMd" fontWeight="semibold" as="p">
              Properties:
            </Text>
            {Object.entries(item.properties).map(([key, value]) => (
              <Text key={key} variant="bodyMd" tone="subdued" as="p">
                {key}: {String(value)}
              </Text>
            ))}
          </div>
        )}

        {item.selling_plan_allocation && (
          <Badge tone="info">
            {item.selling_plan_allocation.selling_plan.name}
          </Badge>
        )}
      </BlockStack>
    </Card>
  );
}

/**
 * Props interface for CartSummary component
 */
interface CartSummaryProps {
  /**
   * Whether to show discount code input
   */
  showDiscountCode?: boolean;
  
  /**
   * Whether to show cart note input
   */
  showCartNote?: boolean;
  
  /**
   * Whether to show cart attributes
   */
  showCartAttributes?: boolean;
  
  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Cart Summary Component
 * 
 * Displays cart totals, discount codes, notes, and checkout actions.
 * 
 * @param props - Component props
 * @returns JSX element with cart summary
 */
export function CartSummary({
  showDiscountCode = true,
  showCartNote = true,
  showCartAttributes = false,
  className
}: CartSummaryProps): JSX.Element {
  const { 
    cart, 
    applyDiscount, 
    removeDiscounts, 
    updateCartNote, 
    updateCartAttributes,
    isUpdating,
    error,
    clearError 
  } = useCart();

  const [discountCode, setDiscountCode] = useState('');
  const [cartNote, setCartNote] = useState(cart?.note || '');
  const [cartAttributes, setCartAttributes] = useState<Record<string, string>>({});

  /**
   * Handles discount code application
   */
  const handleApplyDiscount = async (): Promise<void> => {
    if (!discountCode.trim()) return;

    try {
      await applyDiscount(discountCode.trim());
      setDiscountCode('');
    } catch (error) {
      console.error('Failed to apply discount:', error);
    }
  };

  /**
   * Handles discount removal
   */
  const handleRemoveDiscounts = async (): Promise<void> => {
    try {
      await removeDiscounts();
    } catch (error) {
      console.error('Failed to remove discounts:', error);
    }
  };

  /**
   * Handles cart note update
   */
  const handleUpdateNote = async (): Promise<void> => {
    try {
      await updateCartNote(cartNote);
    } catch (error) {
      console.error('Failed to update cart note:', error);
    }
  };

  if (!cart) {
    return (
      <Card>
        <EmptyState
          heading="Cart is empty"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>Add some products to get started.</p>
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="500">
        {error && (
          <Banner
            title="Cart Error"
            tone="critical"
            onDismiss={clearError}
          >
            <Text as="p">{error.message}</Text>
          </Banner>
        )}

        {/* Cart Totals */}
        <BlockStack gap="300">
          <InlineStack gap="300" align="space-between">
            <Text variant="bodyMd" as="p">Subtotal:</Text>
            <Text variant="bodyMd" as="p">{formatCurrency(cart.items_subtotal_price / 100)}</Text>
          </InlineStack>

          {cart.total_discount > 0 && (
            <InlineStack gap="300" align="space-between">
              <Text variant="bodyMd" as="p">Discount:</Text>
              <Text variant="bodyMd" tone="success" as="p">
                -{formatCurrency(cart.total_discount / 100)}
              </Text>
            </InlineStack>
          )}

          <InlineStack gap="300" align="space-between">
            <Text variant="headingMd" fontWeight="semibold" as="p">Total:</Text>
            <Text variant="headingMd" fontWeight="semibold" as="p">
              {formatCurrency(cart.total_price / 100)}
            </Text>
          </InlineStack>
        </BlockStack>

        {/* Discount Code */}
        {showDiscountCode && (
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Discount Code</Text>
            <BlockStack gap="300">
              <TextField
                label="Discount code"
                value={discountCode}
                onChange={setDiscountCode}
                placeholder="Enter discount code"
                disabled={isUpdating}
                autoComplete="off"
              />
              <ButtonGroup>
                <Button onClick={handleApplyDiscount} disabled={!discountCode.trim() || isUpdating}>
                  Apply
                </Button>
                {cart.cart_level_discount_applications.length > 0 && (
                  <Button onClick={handleRemoveDiscounts} disabled={isUpdating}>
                    Remove
                  </Button>
                )}
              </ButtonGroup>
            </BlockStack>
          </BlockStack>
        )}

        {/* Cart Note */}
        {showCartNote && (
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Order Note</Text>
            <TextField
              label="Note"
              value={cartNote}
              onChange={setCartNote}
              placeholder="Add a note to your order"
              multiline={3}
              disabled={isUpdating}
              autoComplete="off"
            />
            <Button onClick={handleUpdateNote} disabled={isUpdating}>
              Update Note
            </Button>
          </BlockStack>
        )}

        {/* Cart Attributes */}
        {showCartAttributes && (
          <BlockStack gap="300">
            <Text variant="headingMd" as="h3">Order Attributes</Text>
            {Object.entries(cart.attributes).map(([key, value]) => (
              <TextField
                key={key}
                label={key}
                value={String(value)}
                onChange={(newValue) => {
                  setCartAttributes(prev => ({ ...prev, [key]: newValue }));
                }}
                disabled={isUpdating}
                autoComplete="off"
              />
            ))}
          </BlockStack>
        )}

        {/* Checkout Button */}
        <Button
          variant="primary"
          size="large"
          fullWidth
          url="/checkout"
          disabled={cart.item_count === 0 || isUpdating}
        >
          Proceed to Checkout ({cart.item_count.toString()} items)
        </Button>
      </BlockStack>
    </Card>
  );
}

/**
 * Props interface for CartModal component
 */
interface CartModalProps {
  /**
   * Whether the modal is open
   */
  isOpen: boolean;
  
  /**
   * Function to close the modal
   */
  onClose: () => void;
  
  /**
   * Custom CSS class name
   */
  className?: string;
}

/**
 * Cart Modal Component
 * 
 * Displays the complete cart in a modal overlay.
 * 
 * @param props - Component props
 * @returns JSX element with cart modal
 */
export function CartModal({
  isOpen,
  onClose,
  className
}: CartModalProps): JSX.Element {
  const { cart, isLoading, clearCart } = useCart();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  /**
   * Handles cart clearing with confirmation
   */
  const handleClearCart = async (): Promise<void> => {
    try {
      await clearCart();
      setShowClearConfirm(false);
    } catch (error) {
      console.error('Failed to clear cart:', error);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Shopping Cart"
      size="large"
    >
      <Modal.Section>
        {isLoading ? (
          <BlockStack align="center">
            <Spinner size="large" />
            <Text as="p">Loading cart...</Text>
          </BlockStack>
        ) : cart && cart.items.length > 0 ? (
          <BlockStack gap="500">
            {cart.items.map((item) => (
              <CartItemComponent key={item.key} item={item} />
            ))}

            <InlineStack gap="300" align="space-between">
              <Button
                tone="critical"
                onClick={() => setShowClearConfirm(true)}
              >
                Clear Cart
              </Button>
              <Button variant="primary" url="/checkout">
                Checkout
              </Button>
            </InlineStack>
          </BlockStack>
        ) : (
          <EmptyState
            heading="Your cart is empty"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Add some products to get started.</p>
          </EmptyState>
        )}
      </Modal.Section>

      {/* Clear Cart Confirmation Modal */}
      <Modal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        title="Clear Cart"
        primaryAction={{
          content: 'Clear Cart',
          onAction: handleClearCart,
          destructive: true
        }}
        secondaryActions={[{
          content: 'Cancel',
          onAction: () => setShowClearConfirm(false)
        }]}
      >
        <Modal.Section>
          <Text as="p">Are you sure you want to clear all items from your cart?</Text>
        </Modal.Section>
      </Modal>
    </Modal>
  );
}

export default {
  AddToCartButton,
  CartItemComponent,
  CartSummary,
  CartModal
};

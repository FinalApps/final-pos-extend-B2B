/**
 * Type definitions for B2B Wholesale POS Extension
 * 
 * Defines interfaces and types used throughout the B2B wholesale order management system
 * including customer data, order items, quantity rules, and pricing structures.
 */

/**
 * Customer information for B2B wholesale orders
 */
export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  createdAt?: string
  hasPosOrders?: boolean
  tier?: CustomerTier
  billingAddress?: Address
  shippingAddress?: Address
  creditLimit?: number
  paymentTerms?: string
  taxExempt?: boolean
}

/**
 * Customer tier levels for pricing and discount calculations
 */
export type CustomerTier = 'standard' | 'wholesale' | 'premium'

/**
 * Address information for billing and shipping
 */
export interface Address {
  company?: string
  address1: string
  address2?: string
  city: string
  province: string
  country: string
  zip: string
  phone?: string
}

/**
 * Order item with B2B-specific properties
 */
export interface OrderItem {
  id: string
  productId: string
  variantId: string
  name: string
  sku: string
  quantity: number
  price: number
  compareAtPrice?: number
  regularPrice?: number
  hasCatalogPrice?: boolean
  cost?: number
  weight?: number
  requiresShipping: boolean
  taxable: boolean
  taxCode?: string
  customAttributes?: Record<string, string>
  imageUrl?: string
}

/**
 * Quantity rules for products based on customer tier
 */
export interface QuantityRules {
  productId: string
  minQuantity: number
  maxQuantity?: number
  wholesaleMin?: number
  premiumMin?: number
  increment?: number
  bulkPricing?: BulkPricingTier[]
  priceBreaks?: PriceBreak[]
}

/**
 * Price break for quantity-based pricing
 */
export interface PriceBreak {
  minimumQuantity: number
  price: {
    amount: string
    currencyCode: string
  }
}

/**
 * Bulk pricing tier for volume discounts
 */
export interface BulkPricingTier {
  quantity: number
  price: number
  discount?: number
}

/**
 * Volume discount configuration
 */
export interface VolumeDiscount {
  tier: CustomerTier
  threshold: number
  rate: number
  maxDiscount?: number
}

/**
 * B2B order with wholesale-specific fields
 */
export interface B2BOrder {
  id?: string
  customerId: string
  customer?: Customer
  poNumber?: string
  deliveryDate?: string
  deliveryInstructions?: string
  tags: string[]
  items: OrderItem[]
  subtotal: number
  deliveryFee?: number
  volumeDiscount?: number
  tax: number
  total: number
  isDraft: boolean
  status: OrderStatus
  createdAt?: Date
  updatedAt?: Date
  notes?: string
  customFields?: Record<string, any>
  // Shopify draft order fields
  shopifyDraftOrderId?: string
  shopifyOrderId?: string
  shopifyOrderName?: string
  invoiceUrl?: string
}

/**
 * Order status for tracking and workflow management
 */
export type OrderStatus = 
  | 'draft' 
  | 'pending' 
  | 'approved' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'completed'
  | 'cancelled'

/**
 * Validation result for quantity rules and order validation
 */
export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Pricing configuration for different customer tiers
 */
export interface PricingConfig {
  standard: VolumeDiscount
  wholesale: VolumeDiscount
  premium: VolumeDiscount
}

/**
 * Order tag for categorization and reporting
 */
export interface OrderTag {
  id: string
  name: string
  color?: string
  description?: string
}

/**
 * Delivery options for B2B orders
 */
export interface DeliveryOptions {
  method: DeliveryMethod
  date: string
  timeSlot?: string
  instructions?: string
  specialRequirements?: string[]
  contactPerson?: string
  contactPhone?: string
}

/**
 * Available delivery methods
 */
export type DeliveryMethod = 
  | 'standard' 
  | 'express' 
  | 'scheduled' 
  | 'pickup' 
  | 'white-glove'

/**
 * Product catalog visibility rules
 */
export interface CatalogVisibility {
  productId: string
  isVisible: boolean
  customPricing?: boolean
  requiresApproval?: boolean
}

/**
 * Order minimum requirements
 */
export interface OrderMinimums {
  minimumAmount: number
  minimumQuantity?: number
  minimumItems?: number
}

/**
 * API response wrapper for order operations
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * Order creation request payload
 */
export interface CreateOrderRequest {
  customerId: string
  poNumber?: string
  deliveryOptions?: DeliveryOptions
  items: OrderItem[]
  tags?: string[]
  notes?: string
  isDraft?: boolean
}

/**
 * Order update request payload
 */
export interface UpdateOrderRequest {
  id: string
  poNumber?: string
  deliveryOptions?: DeliveryOptions
  items?: OrderItem[]
  tags?: string[]
  notes?: string
  status?: OrderStatus
}

/**
 * Checkout line item from Shopify checkout
 */
export interface CheckoutLineItem {
  id: string
  title: string
  quantity: number
  variant: {
    id: string
    title: string
  }
}

/**
 * Checkout data from Shopify
 */
export interface Checkout {
  id: string
  lineItems: CheckoutLineItem[]
}

/**
 * Product from Shopify
 */
export interface Product {
  id: string
  title: string
  handle?: string
  description?: string
  vendor?: string
  productType?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

/**
 * Pagination info for GraphQL queries
 */
export interface PageInfo {
  hasNextPage: boolean
  hasPreviousPage?: boolean
  startCursor?: string
  endCursor?: string
}

/**
 * Products response with pagination
 */
export interface ProductsResponse {
  products: Product[]
  pageInfo: PageInfo
}

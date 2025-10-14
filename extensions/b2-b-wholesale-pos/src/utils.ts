/**
 * Utility functions for B2B Wholesale POS Extension
 * 
 * Provides helper functions for order validation, pricing calculations,
 * quantity rule enforcement, and data formatting for the B2B wholesale system.
 */

import { 
  Customer, 
  CustomerTier, 
  OrderItem, 
  QuantityRules, 
  ValidationResult, 
  VolumeDiscount,
  PricingConfig,
  OrderMinimums,
  B2BOrder
} from './types'

/**
 * Default pricing configuration for different customer tiers
 * Defines volume discount thresholds and rates
 */
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  standard: { tier: 'standard', threshold: 1000, rate: 0.05, maxDiscount: 0.10 },
  wholesale: { tier: 'wholesale', threshold: 500, rate: 0.10, maxDiscount: 0.20 },
  premium: { tier: 'premium', threshold: 250, rate: 0.15, maxDiscount: 0.25 }
}

/**
 * Default order minimums
 */
export const DEFAULT_ORDER_MINIMUMS: OrderMinimums[] = [
  { minimumAmount: 100 },
  { minimumAmount: 500, minimumQuantity: 10 },
  { minimumAmount: 250, minimumQuantity: 5 }
]

/**
 * Validates quantity rules for order items
 * Ensures minimum/maximum quantities are met based on product rules
 * 
 * @param items - Array of order items to validate
 * @param quantityRules - Product quantity rules mapping
 * @returns Validation result with errors and warnings
 */
export function validateQuantityRules(
  items: OrderItem[], 
  quantityRules: Record<string, QuantityRules>
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  items.forEach(item => {
    const rules = quantityRules[item.productId]
    if (!rules) return
    
    // Check minimum quantity
    if (item.quantity < rules.minQuantity) {
      errors.push(`${item.name}: Minimum quantity is ${rules.minQuantity}`)
    }
    
    // Check maximum quantity
    if (rules.maxQuantity && item.quantity > rules.maxQuantity) {
      errors.push(`${item.name}: Maximum quantity is ${rules.maxQuantity}`)
    }
    
    // Check quantity increment
    if (rules.increment && item.quantity % rules.increment !== 0) {
      errors.push(`${item.name}: Quantity must be in increments of ${rules.increment}`)
    }
  })
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}



/**
 * Calculates volume discount based on order total and customer tier
 * Applies tiered pricing structure with configurable thresholds and rates
 * 
 * @param subtotal - Order subtotal before discounts
 * @param tier - Customer tier
 * @param config - Optional custom pricing configuration
 * @returns Calculated discount amount
 */
export function calculateVolumeDiscount(
  subtotal: number, 
  tier: CustomerTier, 
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): number {
  const tierConfig = config[tier]
  if (!tierConfig) return 0
  
  if (subtotal >= tierConfig.threshold) {
    const discount = subtotal * tierConfig.rate
    const maxDiscount = tierConfig.maxDiscount ? subtotal * tierConfig.maxDiscount : discount
    return Math.min(discount, maxDiscount)
  }
  
  return 0
}

/**
 * Calculates bulk pricing discount for individual items
 * Applies tiered pricing based on quantity thresholds
 * 
 * @param item - Order item with quantity and base price
 * @param bulkPricing - Bulk pricing tiers for the product
 * @returns Discount amount for this item
 */
export function calculateBulkPricingDiscount(
  item: OrderItem, 
  bulkPricing: { quantity: number; price: number; discount?: number }[]
): number {
  if (!bulkPricing || bulkPricing.length === 0) return 0
  
  // Sort by quantity descending to find the highest applicable tier
  const sortedTiers = bulkPricing.sort((a, b) => b.quantity - a.quantity)
  
  for (const tier of sortedTiers) {
    if (item.quantity >= tier.quantity) {
      const tierPrice = tier.price
      const originalTotal = item.quantity * item.price
      const tierTotal = item.quantity * tierPrice
      return originalTotal - tierTotal
    }
  }
  
  return 0
}

/**
 * Validates order minimums
 * Ensures order meets minimum amount, quantity, and item requirements
 * 
 * @param order - B2B order to validate
 * @param minimums - Order minimum requirements
 * @returns Validation result
 */
export function validateOrderMinimums(
  order: B2BOrder, 
  minimums: OrderMinimums[] = DEFAULT_ORDER_MINIMUMS
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Use the first minimum requirement (standard)
  const orderMinimums = minimums[0]
  if (!orderMinimums) return { isValid: true, errors, warnings }
  
  // Check minimum amount
  if (order.subtotal < orderMinimums.minimumAmount) {
    errors.push(`Order minimum is $${orderMinimums.minimumAmount}`)
  }
  
  // Check minimum quantity
  if (orderMinimums.minimumQuantity) {
    const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
    if (totalQuantity < orderMinimums.minimumQuantity) {
      errors.push(`Minimum quantity is ${orderMinimums.minimumQuantity}`)
    }
  }
  
  // Check minimum items
  if (orderMinimums.minimumItems && order.items.length < orderMinimums.minimumItems) {
    errors.push(`Minimum ${orderMinimums.minimumItems} different items required`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Formats currency values for display
 * 
 * @param amount - Amount to format
 * @param currency - Currency code (defaults to USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount)
}

/**
 * Formats date for display and input
 * 
 * @param date - Date to format
 * @param format - Format type ('display' or 'input')
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, format: 'display' | 'input' = 'display'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  if (format === 'input') {
    return dateObj.toISOString().split('T')[0] // YYYY-MM-DD format
  }
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * Generates a unique order number for B2B orders
 * 
 * @param prefix - Optional prefix for the order number
 * @returns Unique order number string
 */
export function generateOrderNumber(prefix: string = 'B2B'): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substr(2, 5)
  return `${prefix}-${timestamp}-${random}`.toUpperCase()
}

/**
 * Validates PO number format
 * 
 * @param poNumber - Purchase order number to validate
 * @returns True if valid format
 */
export function validatePONumber(poNumber: string): boolean {
  // Basic validation - alphanumeric, 3-20 characters
  const poRegex = /^[A-Z0-9]{3,20}$/i
  return poRegex.test(poNumber)
}

/**
 * Calculates order totals including discounts and taxes
 * 
 * @param items - Order items
 * @param volumeDiscount - Volume discount amount
 * @param taxRate - Tax rate (default 0.08 for 8%)
 * @returns Object with subtotal, discount, tax, and total
 */
export function calculateOrderTotals(
  items: OrderItem[], 
  volumeDiscount: number = 0, 
  taxRate: number = 0.08
): { subtotal: number; discount: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
  const discount = Math.min(volumeDiscount, subtotal)
  const taxableAmount = subtotal - discount
  const tax = taxableAmount * taxRate
  const total = taxableAmount + tax
  
  return {
    subtotal,
    discount,
    tax,
    total
  }
}

/**
 * Sorts customers by tier priority for display
 * 
 * @param customers - Array of customers to sort
 * @returns Sorted array with premium first, then wholesale, then standard
 */
export function sortCustomersByTier(customers: Customer[]): Customer[] {
  const tierPriority = { premium: 0, wholesale: 1, standard: 2 }
  
  return customers.sort((a, b) => {
    const aTier = a.tier || 'standard'
    const bTier = b.tier || 'standard'
    return tierPriority[aTier] - tierPriority[bTier]
  })
}



/**
 * Logs order operations for audit trail
 * 
 * @param operation - Operation being performed
 * @param orderId - Order ID
 * @param details - Additional details to log
 */
export function logOrderOperation(
  operation: string, 
  orderId: string, 
  details?: Record<string, any>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    orderId,
    details: details || {}
  }
  
  console.log('B2B Order Operation:', logEntry)
  
  // In a real application, this would send to your logging service
  // Example: sendToLoggingService(logEntry)
}

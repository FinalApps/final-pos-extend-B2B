# B2B POS Extension - Tax Flow Diagram

## 🏪 Store Setup Phase
```
App Startup
    ↓
fetchStoreTaxSettings()
    ↓
┌─────────────────────────────────────┐
│ Store Tax Configuration            │
│ • taxesIncluded: true/false        │
│ • taxShipping: true/false          │
│ • countryCode: "US"/"CA"/etc.      │
└─────────────────────────────────────┘
```

## 👤 Customer Selection Phase
```
Customer Selected
    ↓
fetchCustomerTaxStatus(customerId)
    ↓
┌─────────────────────────────────────┐
│ Customer Tax Status                │
│ • taxExempt: true/false            │
│ • taxExemptions: [array]           │
└─────────────────────────────────────┘
```

## 🏢 Location Selection Phase
```
Company Location Selected
    ↓
fetchTaxData(locationId)
    ↓
calculateEnhancedTax(subtotal, location, storeSettings, isCustomerExempt)
    ↓
┌─────────────────────────────────────┐
│ Enhanced Tax Calculation           │
│ • Province/State-specific rates    │
│ • Tax-included vs tax-excluded     │
│ • Shipping tax calculation         │
│ • Customer exemption handling      │
└─────────────────────────────────────┘
```

## 💰 Tax Calculation Flow

### For Tax-Excluded Pricing:
```
Order Subtotal: $100.00
    ↓
Tax Rate: 8.75% (CA)
    ↓
Product Tax: $100.00 × 0.0875 = $8.75
    ↓
Shipping: $25.00
    ↓
Shipping Tax: $25.00 × 0.0875 = $2.19 (if shippingTaxable = true)
    ↓
Final Total: $100.00 + $25.00 + $8.75 + $2.19 = $135.94
```

### For Tax-Included Pricing:
```
Order Total (tax-included): $108.75
    ↓
Tax Rate: 8.75% (CA)
    ↓
Tax-Excluded Subtotal: $108.75 ÷ 1.0875 = $100.00
    ↓
Tax Amount: $108.75 - $100.00 = $8.75
    ↓
Shipping: $25.00 (tax-included)
    ↓
Shipping Tax: $25.00 - ($25.00 ÷ 1.0875) = $2.19
    ↓
Final Total: $108.75 + $25.00 = $133.75 (tax already included)
```

## 🛒 Cart Review & Order Summary

### Tax-Exempt Customer:
```
┌─────────────────────────────────────┐
│ Order Summary                      │
│ • Subtotal: $100.00                │
│ • Tax: Exempt                      │
│ • Shipping: $25.00                 │
│ • Total: $125.00                   │
└─────────────────────────────────────┘
```

### Regular Customer (Tax-Excluded):
```
┌─────────────────────────────────────┐
│ Order Summary                      │
│ • Subtotal: $100.00                │
│ • CA Sales Tax (8.75%): $8.75      │
│ • Shipping Tax: $2.19              │
│ • Shipping: $25.00                 │
│ • Total: $135.94                   │
└─────────────────────────────────────┘
```

### Regular Customer (Tax-Included):
```
┌─────────────────────────────────────┐
│ Order Summary                      │
│ • Subtotal: $100.00                │
│ • CA Sales Tax (8.75%): $8.75      │
│ • Note: Prices include tax         │
│ • Shipping: $25.00                 │
│ • Total: $133.75                   │
└─────────────────────────────────────┘
```

## 📋 Draft Order Creation

### Line Items Structure:
```
┌─────────────────────────────────────┐
│ Draft Order Line Items             │
│                                     │
│ 1. Product A (Qty: 2)              │
│    - Price: $50.00 each            │
│    - Subtotal: $100.00             │
│                                     │
│ 2. CA Sales Tax                     │
│    - Price: $8.75                  │
│    - Type: Tax                     │
│    - Rate: 8.75%                   │
│                                     │
│ 3. CA Sales Tax (Shipping)         │
│    - Price: $2.19                  │
│    - Type: Shipping Tax            │
│                                     │
│ 4. Standard Delivery                │
│    - Price: $25.00                 │
│    - Type: Delivery Fee            │
└─────────────────────────────────────┘
```

## 🌍 Regional Tax Rates Supported

### United States:
- **California (CA)**: 8.75%
- **New York (NY)**: 8.00%
- **Texas (TX)**: 6.25%
- **Florida (FL)**: 6.00%
- **Washington (WA)**: 6.50%
- **Oregon (OR)**: 0.00% (no sales tax)
- **Default**: 7.00%

### Canada:
- **British Columbia (BC)**: 12.00% (HST)
- **Ontario (ON)**: 13.00% (HST)
- **Alberta (AB)**: 5.00% (GST)
- **Quebec (QC)**: 14.975% (GST+QST)
- **Default**: 10.00%

### International:
- **United Kingdom (GB)**: 20.00% (VAT)
- **Australia (AU)**: 10.00% (GST)

## 🔄 Real-Time Updates

### When Customer Changes:
```
Customer Selection Change
    ↓
fetchCustomerTaxStatus(newCustomerId)
    ↓
Update taxData.isExempt
    ↓
Recalculate all tax amounts
    ↓
Update Order Summary Display
```

### When Location Changes:
```
Location Selection Change
    ↓
fetchTaxData(newLocationId)
    ↓
calculateEnhancedTax(newLocation, storeSettings, customerExempt)
    ↓
Update tax rates and amounts
    ↓
Update Order Summary Display
```

## ⚡ Key Benefits

1. **Automatic Tax Calculation**: No manual tax entry required
2. **Multi-Region Support**: Handles US, Canada, UK, Australia
3. **Flexible Pricing**: Supports both tax-included and tax-excluded stores
4. **B2B Exemptions**: Automatically handles tax-exempt customers
5. **Shipping Tax**: Calculates tax on shipping when applicable
6. **Real-Time Updates**: Tax recalculates when customer/location changes
7. **Draft Order Ready**: Creates properly formatted draft orders for Shopify

## 🚀 Integration Points

- **Shopify Admin GraphQL API**: For fetching store settings and customer data
- **Shopify POS API**: For cart management and order creation
- **Draft Order API**: For creating B2B orders with proper tax lines
- **Payment Terms API**: For B2B payment terms integration

---

*This tax flow ensures accurate, compliant tax handling for B2B wholesale orders in your Shopify POS extension.*



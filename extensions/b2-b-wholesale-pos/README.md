# B2B Wholesale POS Extension

A comprehensive Shopify POS extension for managing B2B wholesale orders with advanced features for quantity rules, volume discounts, and customer-specific pricing.

## Features

### Core B2B Functionality
- **Customer Selection**: Choose from different customer tiers (Standard, Wholesale, Premium)
- **Quantity Rules**: Enforce minimum/maximum quantities based on customer tier
- **Volume Discounts**: Automatic tiered pricing with configurable thresholds
- **PO Number Support**: Track purchase order numbers for B2B transactions
- **Delivery Options**: Schedule delivery dates and add special instructions

### Order Management
- **Draft Orders**: Create unpaid orders for later processing
- **Order Tagging**: Add custom tags for tracking and reporting
- **Validation**: Comprehensive validation for quantity rules and order minimums
- **Pricing Summary**: Real-time calculation of discounts and totals

### Customer Tiers
- **Standard**: Basic pricing with $1000 minimum for 5% discount
- **Wholesale**: Enhanced pricing with $500 minimum for 10% discount
- **Premium**: Premium pricing with $250 minimum for 15% discount

## File Structure

```
src/
├── Tile.tsx          # POS home tile component
├── Modal.tsx         # Main B2B order management interface
├── types.ts          # TypeScript type definitions
└── utils.ts          # Utility functions for validation and calculations
```

## Key Components

### Tile Component
- Provides access to B2B wholesale features from POS home screen
- Clear branding and functionality description

### Modal Component
- Comprehensive order management interface
- Customer selection with tier-based pricing
- Real-time validation and discount calculation
- Order tagging and delivery options

### Type Definitions
- Complete TypeScript interfaces for all B2B entities
- Customer, Order, QuantityRules, and validation types
- Ensures type safety throughout the application

### Utility Functions
- Quantity rule validation
- Volume discount calculations
- Order minimum validation
- Currency and date formatting
- Order number generation

## Usage

1. **Select Customer**: Choose from available B2B customers
2. **Add Items**: Use "Add Sample Items" for demonstration or integrate with POS product selection
3. **Configure Order**: Add PO number, delivery date, and special instructions
4. **Add Tags**: Categorize orders for tracking and reporting
5. **Review Pricing**: See real-time volume discounts and totals
6. **Create Order**: Generate draft or paid orders with full validation

## Validation Rules

### Quantity Rules
- Minimum quantities enforced per customer tier
- Maximum quantities to prevent overselling
- Wholesale-specific minimums for bulk orders
- Quantity increments for certain products

### Order Minimums
- Standard: $100 minimum order
- Wholesale: $500 minimum, 10+ items
- Premium: $250 minimum, 5+ items

### PO Number Validation
- 3-20 alphanumeric characters
- Case-insensitive validation

## Integration Points

The extension is designed to integrate with:
- Shopify POS product selection
- Customer management systems
- Order processing workflows
- Reporting and analytics tools

## Development

Built with:
- React 18
- TypeScript
- Shopify UI Extensions
- Modern ES6+ features

## Security Features

- Input validation on all fields
- Secure order number generation
- Audit logging for order operations
- Type-safe data handling

## Future Enhancements

- Integration with Shopify Admin API
- Advanced reporting dashboard
- Multi-location support
- Custom pricing rules
- Automated order processing

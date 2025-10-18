import { useState, useEffect, useCallback } from 'react';

interface TaxData {
  rate: number;
  amount: number;
  title: string;
  isIncluded: boolean;
  shippingTaxable: boolean;
}

interface StoreTaxSettings {
  taxesIncluded: boolean;
  taxShipping: boolean;
  countryCode: string;
}

interface CartItem {
  productId: string;
  quantity: number;
  price: number;
}

interface Location {
  address?: {
    country: string;
    province: string;
  };
}

export const useTaxCalculation = (
  cartItems: CartItem[],
  b2bPricing: Record<string, any>,
  selectedLocation: Location | null,
  storeTaxSettings: StoreTaxSettings | null,
  customerTaxExempt: boolean,
  deliveryFee: number
) => {
  const [taxData, setTaxData] = useState<TaxData>({
    rate: 0,
    amount: 0,
    title: 'Tax',
    isIncluded: false,
    shippingTaxable: false
  });

  const calculateEnhancedTax = useCallback(() => {
    if (!selectedLocation || !storeTaxSettings || customerTaxExempt) {
      setTaxData({
        rate: 0,
        amount: 0,
        title: 'Tax Exempt',
        isIncluded: false,
        shippingTaxable: false
      });
      return;
    }

    const subtotal = cartItems.reduce((sum, item) => {
      const price = b2bPricing[item.productId]?.price || item.price;
      return sum + item.quantity * price;
    }, 0);

    let taxRate = 0;
    let taxTitle = 'Tax';

    const country = selectedLocation?.address?.country;
    const province = selectedLocation?.address?.province;

    if (country === 'US') {
      switch (province) {
        case 'CA': taxRate = 0.0875; taxTitle = 'CA Sales Tax'; break;
        case 'NY': taxRate = 0.08; taxTitle = 'NY Sales Tax'; break;
        case 'TX': taxRate = 0.0625; taxTitle = 'TX Sales Tax'; break;
        case 'FL': taxRate = 0.06; taxTitle = 'FL Sales Tax'; break;
        case 'WA': taxRate = 0.065; taxTitle = 'WA Sales Tax'; break;
        case 'OR': taxRate = 0.0; taxTitle = 'OR Sales Tax'; break;
        default: taxRate = 0.07; taxTitle = 'US Sales Tax';
      }
    } else if (country === 'CA') {
      switch (province) {
        case 'BC': taxRate = 0.12; taxTitle = 'BC HST'; break;
        case 'ON': taxRate = 0.13; taxTitle = 'ON HST'; break;
        case 'AB': taxRate = 0.05; taxTitle = 'AB GST'; break;
        case 'QC': taxRate = 0.14975; taxTitle = 'QC GST+QST'; break;
        default: taxRate = 0.10; taxTitle = 'Canada Tax';
      }
    } else if (country === 'GB') { 
      taxRate = 0.20; 
      taxTitle = 'UK VAT'; 
    } else if (country === 'AU') { 
      taxRate = 0.10; 
      taxTitle = 'AU GST'; 
    }

    setTaxData({
      rate: taxRate,
      amount: 0, // Will be calculated in useMemo
      title: taxTitle,
      isIncluded: storeTaxSettings.taxesIncluded,
      shippingTaxable: storeTaxSettings.taxShipping
    });
  }, [cartItems, b2bPricing, selectedLocation, storeTaxSettings, customerTaxExempt]);

  // Recalculate whenever dependencies change
  useEffect(() => {
    calculateEnhancedTax();
  }, [calculateEnhancedTax]);

  // Calculate tax amounts based on current tax data
  const taxAmount = taxData.isIncluded
    ? (() => {
        const taxIncludedTotal = cartItems.reduce((sum, item) => {
          const price = b2bPricing[item.productId]?.price || item.price;
          return sum + item.quantity * price;
        }, 0);
        const taxExcludedTotal = taxIncludedTotal / (1 + taxData.rate);
        return taxIncludedTotal - taxExcludedTotal;
      })()
    : cartItems.reduce((sum, item) => {
        const price = b2bPricing[item.productId]?.price || item.price;
        return sum + item.quantity * price;
      }, 0) * taxData.rate;

  const shippingTaxAmount = taxData.shippingTaxable && !customerTaxExempt
    ? taxData.isIncluded
      ? deliveryFee - deliveryFee / (1 + taxData.rate)
      : deliveryFee * taxData.rate
    : 0;

  const subtotal = cartItems.reduce((sum, item) => {
    const price = b2bPricing[item.productId]?.price || item.price;
    return sum + item.quantity * price;
  }, 0);

  const finalTotal = taxData.isIncluded
    ? subtotal + deliveryFee // Tax already included in prices
    : subtotal + deliveryFee + taxAmount + shippingTaxAmount;

  return { 
    taxData, 
    taxAmount, 
    shippingTaxAmount, 
    finalTotal,
    subtotal 
  };
};



/* eslint-disable */
import React, { useState, useEffect, useCallback, useMemo } from 'react'

import { 
  Text,
  Screen, 
  ScrollView, 
  Navigator, 
  reactExtension, 
  useApi,
  Button,
  TextField,
  Banner,
  Image,
  POSBlock,
  POSBlockRow
} from '@shopify/ui-extensions-react/point-of-sale'


import { 
  Customer, 
  OrderItem, 
  QuantityRules, 
  B2BOrder,
  ValidationResult,
  Checkout,
  CheckoutLineItem,
  Product,
  ProductsResponse,
  PageInfo
} from './types'

import { 
  validateQuantityRules, 
  calculateVolumeDiscount, 
  validateOrderMinimums,
  formatCurrency,
  formatDate,
  generateOrderNumber,
  validatePONumber,
  calculateOrderTotals,
  logOrderOperation
} from './utils'


// Custom hooks for better separation of concerns
const useCustomers = () => {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchCustomers = useCallback(async (limit: number = 50, cursor?: string) => {
    setIsLoading(true)
    try {
      const requestBody = {
        query: `
          query GetCustomers($first: Int!, $after: String) {
            customers(first: $first, after: $after) {
              edges {
                node {
                  id
                  firstName
                  lastName
                  email
                  phone
                  createdAt
                  lastOrder {
                    channelInformation {
                      displayName
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: { first: limit, after: cursor }
      }

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (result?.data?.customers?.edges) {
        const fetchedCustomers: Customer[] = result.data.customers.edges.map((edge: any) => {
          const node = edge.node
          return {
            id: node.id.split('/').pop() || 'unknown',
            name: `${node.firstName || ''} ${node.lastName || ''}`.trim() || 'Unknown Customer',
            email: node.email,
            phone: node.phone,
            createdAt: node.createdAt,
            hasPosOrders: node.lastOrder?.channelInformation?.displayName === 'Point of Sale'
          }
        })

        setCustomers(fetchedCustomers)
        return { customers: fetchedCustomers, pageInfo: result.data.customers.pageInfo }
      }
      
      return null
    } catch (error) {
      console.error('Error fetching customers:', error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { customers, isLoading, fetchCustomers }
}

// Shop currency detection hook
const useShopCurrency = () => {
  const [currency, setCurrency] = useState<string>('USD')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetchShopCurrency() {
      try {
        setLoading(true)
        
        const query = `
          query GetShopCurrency {
            shop {
              id
              currencyCode
              currencyFormats {
                moneyFormat
                moneyWithCurrencyFormat
              }
            }
          }
        `

        const response = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query })
        })

        const data = await response.json()
        const shop = data.data?.shop

        if (shop?.currencyCode) {
          setCurrency(shop.currencyCode)
          console.log('Shop currency detected:', {
            currencyCode: shop.currencyCode,
            moneyFormat: shop.currencyFormats?.moneyFormat,
            moneyWithCurrencyFormat: shop.currencyFormats?.moneyWithCurrencyFormat
          })
        }
      } catch (error) {
        console.error('Error fetching shop currency:', error)
        // Keep default USD if fetch fails
      } finally {
        setLoading(false)
      }
    }

    fetchShopCurrency()
  }, [])

  return { currency, loading }
}

// Simple B2B customer detection hook
const useB2BCustomerDetection = (customerId: string | null) => {
  const [isB2B, setIsB2B] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function detectB2BCustomer() {
      if (!customerId) {
        setIsB2B(null)
        return
      }

      try {
        setLoading(true)
        
        const customerQuery = `
          query getCustomerB2BStatus($id: ID!) {
            customer(id: $id) {
              id
              email
              taxExempt
              tags
              company {
                id
                name
              }
              companyContactProfiles {
                id
              }
            }
          }
        `

        const response = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: customerQuery,
            variables: { id: customerId }
          })
        })

        const data = await response.json()
        const customer = data.data?.customer

        if (customer) {
          // Determine if B2B based on multiple signals
          const isB2BCustomer = 
            customer.taxExempt ||
            customer.company ||
            customer.companyContactProfiles?.length > 0 ||
            (customer.tags || []).some((tag: string) =>
              ["B2B", "Wholesale", "Corporate", "Business"].includes(tag)
            )

          setIsB2B(isB2BCustomer)
          console.log('B2B Customer Detection:', {
            customerId: customer.id,
            email: customer.email,
            taxExempt: customer.taxExempt,
            hasCompany: !!customer.company,
            hasCompanyContact: customer.companyContactProfiles?.length > 0,
            tags: customer.tags,
            isB2B: isB2BCustomer
          })
        } else {
          setIsB2B(false)
        }
      } catch (error) {
        console.error('Error detecting B2B customer:', error)
        setIsB2B(false)
      } finally {
        setLoading(false)
      }
    }

    detectB2BCustomer()
  }, [customerId])

  return { isB2B, loading }
}

const useCompanyData = () => {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [priceListInfo, setPriceListInfo] = useState<{id: string, name: string, currency: string} | null>(null)
  const [locationCatalogInfo, setLocationCatalogInfo] = useState<{id: string, title: string, status: string, locationId?: string, companyName?: string, companyId?: string} | null>(null)
  const [availableCompanies, setAvailableCompanies] = useState<{id: string, name: string, shippingAddress?: {address1?: string, city?: string, country?: string}, billingAddress?: {address1?: string, address2?: string, city?: string, province?: string, country?: string, zip?: string}}[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companyAddresses, setCompanyAddresses] = useState<{[companyId: string]: {shippingAddress?: {address1?: string, city?: string, country?: string}, billingAddress?: {address1?: string, address2?: string, city?: string, province?: string, country?: string, zip?: string}, locationName?: string}}>({})

  const fetchCustomerCompany = useCallback(async (customerName: string): Promise<string | null> => {
    try {
      const query = `
        query GetCustomerCompanies($customerName: String!) {
          customers(first: 1, query: $customerName) {
            nodes {
              companyContactProfiles {
                company {
                  id
                  name
                  locations(first: 1) {
                    nodes {
                id
                name
                      catalogs(first: 1) {
                        nodes {
                      id
                      title
                          status
                    }
                  }
                }
              }
            }
          }
        }
      }
        }
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { customerName: `name:${customerName}` }
        })
      })

      if (!response.ok) return null

      const result = await response.json()
      
      if (result.data?.customers?.nodes?.length > 0) {
        const customer = result.data.customers.nodes[0]
        if (customer?.companyContactProfiles?.length > 0) {
          const company = customer.companyContactProfiles[0].company
          setCompanyId(company.id)
          setCompanyName(company.name)
          
          // Company info is now available for pricing
          
          return company.name
        }
      }
      
      return null
    } catch (error) {
      console.error('Error fetching customer company:', error)
      return null
    }
  }, [])

  const fetchCompanyLocationId = useCallback(async (companyName: string) => {
    try {
      // Use your specific query to fetch companies with their locations
      const companyQuery = `
        query GetCompaniesWithLocations {
          companies(first: 250) {
                edges {
                  node {
                    id
                name
                locations(first: 1) {
                  nodes {
                    id
                    }
                  }
                }
              }
            }
          }
      `

      const companyResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: companyQuery })
      })

      if (!companyResponse.ok) {
        console.error('Failed to fetch companies:', companyResponse.status)
        return null
      }

      const companyResult = await companyResponse.json()
      
      if (companyResult.errors) {
        console.error('GraphQL errors in companies query:', companyResult.errors)
        return null
      }

      const companies = companyResult.data?.companies?.edges?.map((edge: any) => edge.node) || []
      
      if (companies.length === 0) {
        console.log(`No companies found`)
      return null
      }

      // Find the exact company match
      const exactCompany = companies.find((company: any) => 
        company.name.toLowerCase() === companyName.toLowerCase()
      )
      
      if (!exactCompany) {
        console.error(`No exact match found for company: "${companyName}"`)
        return null
      }

      // Get the company location
      const companyLocation = exactCompany.locations?.nodes?.[0]
      
      if (!companyLocation) {
        return null
      }

      // Return the company location information
      const catalogInfo = {
        id: companyLocation.id,
        title: `${exactCompany.name} Company`,
        status: 'ACTIVE',
        locationId: companyLocation.id, // Use actual company location ID for contextual pricing
        companyName: exactCompany.name,
        companyId: exactCompany.id
      }
      
      setLocationCatalogInfo(catalogInfo)
      return catalogInfo
    } catch (error) {
      console.error('Error fetching company location:', error)
      return null
    }
  }, [])

  const fetchCustomerCompanies = useCallback(async (customerName: string) => {
    try {
      console.log(`Fetching company locations for customer: ${customerName}`)
      setCompaniesLoading(true)
      
      // First, get the customer ID by searching for the customer
      const customerSearchQuery = `
        query GetCustomerId($customerName: String!) {
          customers(first: 250, query: $customerName) {
                  edges {
                    node {
                      id
                displayName
                }
              }
            }
          }
        `

      const searchResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: customerSearchQuery,
          variables: { customerName: `name:${customerName}` }
        })
      })

      if (!searchResponse.ok) {
        console.error('Failed to search for customer:', searchResponse.status)
        return []
      }

      const searchResult = await searchResponse.json()
      
      if (searchResult.errors) {
        console.error('GraphQL errors in customer search:', searchResult.errors)
        return []
      }

      const customers = searchResult.data?.customers?.edges?.map((edge: any) => edge.node) || []
      console.log(`Found ${customers.length} customers matching "${customerName}"`)
      
      if (customers.length === 0) {
        console.log('No customers found')
        return []
      }

      // Find the exact customer match
      const exactCustomer = customers.find((customer: any) => 
        customer.displayName.toLowerCase() === customerName.toLowerCase()
      ) || customers[0]

      console.log(`Selected customer: ${exactCustomer.displayName} (ID: ${exactCustomer.id})`)

      if (!exactCustomer?.id) {
        console.error('Customer ID not found')
        return []
      }

      // Now fetch company locations assigned to this customer via role assignments
      const companyLocationsQuery = `
        query GetCustomerCompanyLocations($customerId: ID!) {
          customer(id: $customerId) {
            companyContactProfiles {
              id
              roleAssignments(first: 10) {
                nodes {
                  companyLocation {
                    id
                    name
                    shippingAddress {
                      address1
                      city
                      country
                    }
                    billingAddress {
                      address1
                      address2
                      city
                      province
                      country
                      zip
                    }
                  }
                }
              }
            }
          }
        }
      `

      const locationsResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: companyLocationsQuery,
          variables: { customerId: exactCustomer.id }
        })
      })

      if (!locationsResponse.ok) {
        console.error('Failed to fetch customer company locations:', locationsResponse.status)
        return []
      }

      const locationsResult = await locationsResponse.json()
      
      if (locationsResult.errors) {
        console.error('GraphQL errors in company locations query:', locationsResult.errors)
        return []
      }

      console.log('Company locations query result:', locationsResult.data)

      // Extract company locations from role assignments
      const companyLocations: any[] = []
      const customer = locationsResult.data?.customer
      
      if (customer?.companyContactProfiles) {
        console.log(`Found ${customer.companyContactProfiles.length} company contact profiles`)
        customer.companyContactProfiles.forEach((profile: any) => {
          if (profile.roleAssignments?.nodes) {
            console.log(`Profile ${profile.id} has ${profile.roleAssignments.nodes.length} role assignments`)
            profile.roleAssignments.nodes.forEach((assignment: any) => {
              if (assignment.companyLocation) {
                const location = assignment.companyLocation
                console.log(`Found company location: ${location.name} (${location.id})`)
                // Avoid duplicates by checking if location already exists
                const existingLocation = companyLocations.find(loc => loc.id === location.id)
                if (!existingLocation) {
                  companyLocations.push({
                    id: location.id,
                    name: location.name,
                    shippingAddress: location.shippingAddress,
                    billingAddress: location.billingAddress
                  })
                }
              }
            })
          }
        })
      } else {
        console.log('No company contact profiles found for customer')
      }
      
      console.log(`Total company locations found: ${companyLocations.length}`)
      setAvailableCompanies(companyLocations)
      return companyLocations
    } catch (error) {
      console.error('Error fetching customer company locations:', error)
      return []
    } finally {
      setCompaniesLoading(false)
    }
  }, [])

  const fetchAllCompanies = useCallback(async () => {
    try {
      
      const query = `
        query GetAllCompanies {
          companies(first: 250) {
                  edges {
                    node {
                id
                name
              }
            }
          }
        }
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        console.error('Failed to fetch all companies:', response.status)
        return []
      }

      const result = await response.json()
      
      if (result.errors) {
        console.error('GraphQL errors in all companies query:', result.errors)
        return []
      }

      const companies = result.data?.companies?.edges?.map((edge: any) => ({
        id: edge.node.id,
        name: edge.node.name
      })) || []
      
      return companies
    } catch (error) {
      console.error('Error fetching all companies:', error)
      return []
    }
  }, [])

  const fetchProductVariants = useCallback(async (productId: string) => {
    try {
      const query = `
        query GetProductVariants($productId: ID!) {
          product(id: $productId) {
                      id
                      title
            variants(first: 50) {
              nodes {
                        id
                        title
                        sku
                        price
                compareAtPrice
                image {
                  url
                    }
                  }
                }
              }
            }
          `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { 
            productId: `gid://shopify/Product/${productId}`
          }
        })
      })

      if (!response.ok) return null

      const result = await response.json()
      return result.data?.product
    } catch (error) {
      console.error('Error fetching product variants:', error)
      return null
    }
  }, [])

  const fetchContextualPricing = useCallback(async (variantId: string, companyLocationId: string) => {
    try {
      // Validate ID formats
      if (!variantId || typeof variantId !== 'string') {
        console.error('Invalid variant ID:', variantId)
        return null
      }
      
      if (!companyLocationId || typeof companyLocationId !== 'string') {
        console.error('Invalid company location ID:', companyLocationId)
        return null
      }
      
      if (!variantId.startsWith('gid://')) {
        console.error('Variant ID must start with gid://:', variantId)
        return null
      }
      
      if (!companyLocationId.startsWith('gid://')) {
        console.error('Company Location ID must start with gid://:', companyLocationId)
        return null
      }
      
      const query = `
        query GetContextualPricing($variantId: ID!, $companyLocationId: ID!) {
          productVariant(id: $variantId) {
                      product {
                        title
                      }
            contextualPricing(context: {companyLocationId: $companyLocationId}) {
              price {
                amount
                currencyCode
              }
              quantityPriceBreaks(first: 250) {
                nodes {
                  minimumQuantity
                  price {
                    amount
                    currencyCode
                  }
                }
              }
              quantityRule {
                minimum
                maximum
                increment
                  }
                }
              }
            }
          `

      const requestBody = { 
        query,
        variables: {
          variantId,
          companyLocationId 
        }
      }

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      // Check for GraphQL errors
      if (result.errors) {
        console.error('GraphQL errors in contextual pricing query:', result.errors)
        return null
      }
      
      if (result.data?.productVariant?.contextualPricing) {
        const pricing = result.data.productVariant.contextualPricing
        return pricing
      }
      
      return null
    } catch (error) {
      console.error('Error fetching contextual pricing:', error)
      return null
    }
  }, [])

  // Contextual pricing function removed - using price list approach instead

  const fetchCatalogData = useCallback(async (productIds: string[]) => {
    if (!companyId || productIds.length === 0) return { pricing: {}, rules: {} }

    try {
      // First get catalog and price list
      const catalogQuery = `
        query GetCompanyCatalog($companyId: ID!) {
          company(id: $companyId) {
            locations(first: 1) {
              nodes {
                catalog {
                  id
                  priceList {
                id
                name
                    currency
                    }
                  }
                }
              }
            }
          }
      `

      const catalogResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: catalogQuery,
          variables: { companyId }
        })
      })

      if (!catalogResponse.ok) return { pricing: {}, rules: {} }

      const catalogResult = await catalogResponse.json()
      
      let priceListId = null
      if (catalogResult.data?.company?.locations?.nodes?.[0]?.catalog?.priceList) {
        const priceList = catalogResult.data.company.locations.nodes[0].catalog.priceList
        priceListId = priceList.id
        setPriceListInfo({
          id: priceList.id,
          name: priceList.name,
          currency: priceList.currency
        })
      }

      if (!priceListId) return { pricing: {}, rules: {} }

      // Fetch prices from price list
      const priceQuery = `
        query GetPriceListPrices($priceListId: ID!) {
          priceList(id: $priceListId) {
            prices(first: 250) {
              nodes {
                price {
                  amount
                currencyCode
                }
                      variant {
                        id
                        title
                        sku
                      product {
                        id
                        title
                      }
                    }
                  }
                }
          }
        }
      `

      const productImagesQuery = `
        query GetProductVariantImages($productId: ID!) {
          product(id: $productId) {
            id
            title
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  media(first: 250) {
                    edges {
                      node {
                        mediaContentType
                        ... on MediaImage {
                          id
                          image {
                            url
                            altText
                          }
                        }
                      }
                    }
                  }
                  }
                }
              }
            }
          }
        `

      const priceResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: priceQuery,
          variables: { priceListId }
        })
      })

      if (!priceResponse.ok) return { pricing: {}, rules: {} }

      const priceResult = await priceResponse.json()
      
      const catalogPricing: Record<string, any> = {}
      const rules: Record<string, QuantityRules> = {}
      
      if (priceResult.data?.priceList?.prices?.nodes) {
        priceResult.data.priceList.prices.nodes.forEach((priceNode: any) => {
          const productId = priceNode.variant.product.id.split('/').pop()
          const variantId = priceNode.variant.id.split('/').pop()
          
          if (!catalogPricing[productId]) {
            catalogPricing[productId] = {
              title: priceNode.variant.product.title,
              variants: []
            }
          }
          
          catalogPricing[productId].variants.push({
            id: variantId,
            title: priceNode.variant.title,
            sku: priceNode.variant.sku,
            price: parseFloat(priceNode.price.amount),
            currency: priceNode.price.currencyCode
          })

          // Default quantity rules - these would come from a separate query in production
          if (!rules[productId]) {
            rules[productId] = {
              productId,
              minQuantity: 1,
              maxQuantity: undefined,
              increment: 1,
              wholesaleMin: 10,
              premiumMin: undefined,
              bulkPricing: []
            }
          }
        })
      }
      
      return { pricing: catalogPricing, rules }
    } catch (error) {
      console.error('Error fetching catalog data:', error)
      return { pricing: {}, rules: {} }
    }
  }, [companyId])

  const fetchCompanyAddresses = useCallback(async (companyId: string, companyName: string) => {
    try {
      
      const query = `
        query GetCompanyAddresses {
          companyLocations(first: 250) {
            edges {
              node {
                name
                billingAddress {
                  address1
                  city
                  country
                  zip
                }
                shippingAddress {
                  address1
                  city
                  country
                  zip
                }
              }
            }
          }
        }
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        console.error('Failed to fetch company addresses:', response.status)
        return null
      }

      const result = await response.json()
      
      if (result.errors) {
        console.error('GraphQL errors in company addresses query:', result.errors)
        return null
      }

      const locations = result.data?.companyLocations?.edges?.map((edge: any) => edge.node) || []
      
      // Find location that matches the company name
      const matchingLocation = locations.find((location: any) => 
        location.name && location.name.toLowerCase().includes(companyName.toLowerCase())
      ) || locations[0] // Fallback to first location if no match found
      
      if (matchingLocation) {
        const addressData = {
          shippingAddress: matchingLocation.shippingAddress,
          billingAddress: matchingLocation.billingAddress,
          locationName: matchingLocation.name
        }
        
        // Store the address data
        setCompanyAddresses(prev => {
          const newAddresses = {
            ...prev,
            [companyId]: addressData
          }
          return newAddresses
        })
        
        return addressData
      }

      return null
    } catch (error) {
      console.error('Error fetching company addresses:', error)
      return null
    }
  }, [])

  const calculateTax = useCallback(async (cartItems: any[], companyLocationId: string, companyId: string, companyContactId: string, shippingAddress: any, currency: string = 'USD') => {
    try {
      console.log('Calculating tax for:', { cartItems, companyLocationId, companyId, companyContactId, shippingAddress })
      
      if (!cartItems.length || !companyLocationId || !companyId || !companyContactId || !shippingAddress) {
        console.log('Missing required data for tax calculation')
        return { totalTax: 0, taxLines: [], subtotal: 0, total: 0 }
      }

      // Filter out items with invalid variant IDs
      const validCartItems = cartItems.filter(item => item.variantId && item.variantId !== '0' && item.variantId !== 0)
      
      if (!validCartItems.length) {
        console.log('No valid cart items with proper variant IDs for tax calculation')
        return { totalTax: 0, taxLines: [], subtotal: 0, total: 0 }
      }

      console.log('Valid cart items for tax calculation:', validCartItems.map(item => ({
        variantId: item.variantId,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      })))


      const mutation = `
        mutation DraftOrderCalculate($input: DraftOrderInput!) {
          draftOrderCalculate(input: $input) {
            calculatedDraftOrder {
              totalTaxSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              taxLines {
                title
                rate
                ratePercentage
                priceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              subtotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              purchasingEntity {
                ... on PurchasingCompany {
                  company {
                    name
                  }
                  location {
                    name
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `

      const variables = {
        input: {
          purchasingEntity: {
            purchasingCompany: {
              companyId: companyId.startsWith('gid://') ? companyId : `gid://shopify/Company/${companyId}`,
              companyLocationId: companyLocationId.startsWith('gid://') ? companyLocationId : `gid://shopify/CompanyLocation/${companyLocationId}`,
              companyContactId: companyContactId.startsWith('gid://') ? companyContactId : `gid://shopify/CompanyContact/${companyContactId}`
            }
          },
          shippingAddress: {
            address1: shippingAddress.address1 || '',
            city: shippingAddress.city || '',
            provinceCode: shippingAddress.provinceCode || '',
            countryCode: shippingAddress.countryCode || 'US',
            zip: shippingAddress.zip || ''
          },
          billingAddress: {
            address1: shippingAddress.address1 || '',
            city: shippingAddress.city || '',
            provinceCode: shippingAddress.provinceCode || '',
            countryCode: shippingAddress.countryCode || 'US',
            zip: shippingAddress.zip || ''
          },
          taxExempt: false,
          lineItems: validCartItems.map(item => ({
            variantId: item.variantId.startsWith('gid://') ? item.variantId : `gid://shopify/ProductVariant/${item.variantId}`,
            quantity: item.quantity,
            originalUnitPrice: item.price?.toString() || '0.00',
            taxable: true,
            requiresShipping: true
          })),
          presentmentCurrencyCode: currency
        }
      }

      console.log('Tax calculation input:', JSON.stringify(variables, null, 2))

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: mutation,
          variables 
        })
      })

      if (!response.ok) {
        console.error('Failed to calculate tax:', response.status)
        return { totalTax: 0, taxLines: [], subtotal: 0, total: 0 }
      }

      const result = await response.json()

      console.log('Tax calculation response:', JSON.stringify(result, null, 2))

      if (result.errors) {
        console.error('GraphQL errors in tax calculation:', result.errors)
        return { totalTax: 0, taxLines: [], subtotal: 0, total: 0 }
      }

      if (result.data?.draftOrderCalculate?.userErrors?.length > 0) {
        console.error('Tax calculation user errors:', result.data.draftOrderCalculate.userErrors)
        return { totalTax: 0, taxLines: [], subtotal: 0, total: 0 }
      }

      const calculatedOrder = result.data?.draftOrderCalculate?.calculatedDraftOrder
      
      if (!calculatedOrder) {
        console.log('No calculated order returned')
        return { totalTax: 0, taxLines: [], subtotal: 0, total: 0 }
      }

      const totalTax = parseFloat(calculatedOrder.totalTaxSet?.shopMoney?.amount || '0')
      const subtotal = parseFloat(calculatedOrder.subtotalPriceSet?.shopMoney?.amount || '0')
      const total = parseFloat(calculatedOrder.totalPriceSet?.shopMoney?.amount || '0')
      const taxLines = calculatedOrder.taxLines || []

      console.log('Tax calculation result:', { totalTax, subtotal, total, taxLines })

      return {
        totalTax,
        taxLines,
        subtotal,
        total
      }

    } catch (error) {
      console.error('Error calculating tax:', error)
      return { totalTax: 0, taxLines: [], subtotal: 0, total: 0 }
    }
  }, [])

              return {
    companyId,
    companyName,
    priceListInfo,
    locationCatalogInfo,
    availableCompanies,
    companiesLoading,
    companyAddresses,
    setCompanyAddresses,
    fetchCustomerCompany,
    fetchCatalogData,
    fetchCompanyLocationId,
    fetchCustomerCompanies,
    fetchAllCompanies,
    fetchProductVariants,
    fetchContextualPricing,
    fetchCompanyAddresses,
    calculateTax
  }
}

const useStoreLocations = () => {
  const [locations, setLocations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchLocations = useCallback(async () => {
    setIsLoading(true)
    try {
      const query = `
        query getLocations {
          locations(first: 250) {
            edges {
              node {
                id
                name
                address {
                  address1
                  city
                  province
                  country
                }
                isActive
                isPrimary
              }
            }
          }
        }
        `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({ query }),
      })

      const result = await response.json()
      
      if (result?.data?.locations?.edges) {
        const fetchedLocations = result.data.locations.edges
          .map((edge: any) => {
            const node = edge.node
            const address = node.address
            const fullAddress = address
              ? `${address.address1 || ''}, ${address.city || ''}, ${address.province || ''}, ${address.country || ''}`.trim()
              : 'No address available'
            
              return {
              id: node.id,
              name: node.name,
              address: fullAddress,
              isActive: node.isActive,
              isPrimary: node.isPrimary,
            }
          })
          .filter((location: any) => location.isActive)

        setLocations(fetchedLocations)
      } else {
        setLocations([])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      setLocations([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { locations, isLoading, fetchLocations }
}

const useCart = (apiData: any, fetchCartDetails?: (cartId: string) => Promise<any[]>) => {
  const [cartItems, setCartItems] = useState<OrderItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const processCartItems = useCallback(async (cart: any, pricingData: Record<string, any> = {}): Promise<OrderItem[]> => {
    if (!cart?.lineItems?.length) return []

    // Try to get cart details first for better product information
    let cartDetails: any[] = []
    if (cart.id && fetchCartDetails) {
      try {
        cartDetails = await fetchCartDetails(cart.id)
        console.log('Cart details fetched:', cartDetails)
      } catch (error) {
        console.log('Could not fetch cart details, using fallback method:', error)
      }
    }

    const items: OrderItem[] = await Promise.all(
      cart.lineItems.map(async (lineItem: any, index: number) => {
        // Try to find matching cart detail for better data
        const cartDetail = cartDetails.find((detail: any) => 
          detail.merchandise?.id === `gid://shopify/ProductVariant/${lineItem.variantId}` ||
          detail.merchandise?.id === lineItem.variantId
        )

        // Extract product and variant IDs more robustly
        const productId = String(lineItem.productId || lineItem.product?.id || cartDetail?.merchandise?.product?.id || `product-${index}`)
        let variantId = String(lineItem.variantId || lineItem.variant?.id || cartDetail?.merchandise?.id || `variant-${index}`)
        
        // If variantId doesn't look like a proper ID, try to extract from other fields
        if (variantId === `variant-${index}` && lineItem.variant) {
          variantId = String(lineItem.variant.id || lineItem.variant.variantId || variantId)
        }
        
        
        // Get catalog pricing
        let catalogPrice = parseFloat(String(lineItem.price || '0'))
        let compareAtPrice = 0
        let hasCatalogPrice = false
        
        if (pricingData[productId]) {
          const productPricing = pricingData[productId]
          const variant = productPricing.variants?.find((v: any) => v.id === variantId)
          if (variant) {
            catalogPrice = variant.price
            compareAtPrice = variant.compareAtPrice || 0
            hasCatalogPrice = true
          }
        }

        // Try to get SKU from multiple sources (prioritize cart details)
        let sku = cartDetail?.merchandise?.sku ||
                  lineItem.sku || 
                  lineItem.variant?.sku || 
                  lineItem.variant?.title ||
                  lineItem.product?.sku ||
                  null
        

        // Try to get image URL from multiple sources (prioritize cart details)
        let imageUrl = cartDetail?.merchandise?.product?.featuredImage?.url ||
                      lineItem.image?.url || 
                      lineItem.variant?.image?.url || 
                      lineItem.product?.featuredImage?.src ||
                      lineItem.featuredImage?.src ||
                      null
        
        // Temporarily disable fetchProductWithId due to API issues
        // if (!imageUrl && lineItem.productId && apiData?.productSearch) {
        if (false && !imageUrl && lineItem.productId && apiData?.productSearch) {
          try {
            // Ensure product ID is in the correct format for fetchProductWithId
            let productIdForSearch = String(lineItem.productId)
            
            console.log(`Original product ID for image fetching: ${productIdForSearch}`)
            
            // If it's already a GID, extract the numeric ID
            if (productIdForSearch.startsWith('gid://shopify/Product/')) {
              productIdForSearch = productIdForSearch.split('/').pop() || productIdForSearch
              console.log(`Extracted numeric ID from GID: ${productIdForSearch}`)
            }
            
            // If it's not a numeric ID, try to extract it
            if (!/^\d+$/.test(productIdForSearch)) {
              const extractedId = productIdForSearch.replace(/\D/g, '')
              if (extractedId) {
                productIdForSearch = extractedId
                console.log(`Extracted numeric ID from string: ${productIdForSearch}`)
              }
            }
            
            console.log(`Final product ID for fetchProductWithId: ${productIdForSearch}`)
            console.log(`Product ID type: ${typeof productIdForSearch}`)
            console.log(`Is numeric: ${/^\d+$/.test(productIdForSearch)}`)
            
            if (productIdForSearch && /^\d+$/.test(productIdForSearch)) {
              // Try different approaches for fetchProductWithId
              try {
                // First try with string
                const product = await apiData.productSearch.fetchProductWithId(productIdForSearch)
                if (product?.featuredImage?.src) {
                  imageUrl = product.featuredImage.src
                  console.log(`Successfully fetched product image: ${imageUrl}`)
                }
              } catch (stringError) {
                console.log('String ID failed, trying with number:', stringError)
                try {
                  // Try with number
                  const product = await apiData.productSearch.fetchProductWithId(parseInt(productIdForSearch))
                  if (product?.featuredImage?.src) {
                    imageUrl = product.featuredImage.src
                    console.log(`Successfully fetched product image with number: ${imageUrl}`)
                  }
                } catch (numberError) {
                  console.log('Number ID also failed:', numberError)
                  throw numberError
                }
              }
        } else {
              console.log(`Invalid product ID format for image fetching: ${productIdForSearch}`)
      }
    } catch (error) {
            console.log('Could not fetch product image:', error)
            // Don't throw the error, just log it and continue
          }
        }
            
          return {
              id: `item-${index}`,
          productId,
          variantId,
          name: lineItem.title || `Product ${index + 1}`,
          sku: sku || `SKU-${index + 1}`,
          quantity: lineItem.quantity || 1,
          price: catalogPrice,
          regularPrice: parseFloat(String(lineItem.price || '0')),
          compareAtPrice,
              requiresShipping: true,
          taxable: lineItem.taxable ?? true,
          imageUrl,
          hasCatalogPrice
        }
      })
    )
    
    return items
  }, [apiData, fetchCartDetails])

  const loadCartItems = useCallback(async (pricingData: Record<string, any> = {}) => {
    setIsLoading(true)
    try {
      if (apiData?.cart?.subscribable?.initial) {
        const cartData = apiData.cart.subscribable.initial
        const items = await processCartItems(cartData, pricingData)
        setCartItems(items)
        return items
      }
      return []
    } catch (error) {
      console.error('Error loading cart items:', error)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [apiData, processCartItems])

  const updateItemQuantity = useCallback((itemId: string, newQuantity: number) => {
    setCartItems(prevItems => 
      prevItems.map(item => 
        item.id === itemId ? { ...item, quantity: Math.max(1, newQuantity) } : item
      )
    )
  }, [])

  return {
    cartItems,
    isLoading,
    loadCartItems,
    updateItemQuantity,
    setCartItems
    }
  }

  /**
 * B2B Wholesale Order Management Modal
 */
const Modal = () => {
  const apiData = useApi()
  
  // Screen navigation
  const [currentScreen, setCurrentScreen] = useState<'customer' | 'location' | 'cart' | 'quantity' | 'product-detail' | 'delivery' | 'confirmation'>('customer')
  
  // Fetch cart details with product information
  const fetchCartDetails = useCallback(async (cartId: string) => {
    try {
      console.log(`Fetching cart details for cart: ${cartId}`)
      
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        query: `
            query GetCartDetails($cartId: ID!) {
              cart(id: $cartId) {
              id
                lines(first: 100) {
                edges {
                  node {
                    id
                    quantity
                      merchandise {
                        ... on ProductVariant {
                      id
                      title
                      sku
                    product {
                      id
                      title
                            vendor
                            featuredImage {
                              url
                              altText
                            }
                          }
                          price {
                            amount
                            currencyCode
                          }
                        }
                      }
                    }
                  }
              }
            }
          }
        `,
          variables: { cartId }
        })
      })

      const result = await response.json()
      console.log(`Cart details response for ${cartId}:`, result)

      if (result.data?.cart?.lines?.edges) {
        return result.data.cart.lines.edges.map((edge: any) => edge.node)
      }
      
      return []
    } catch (error) {
      console.error(`Error fetching cart details for ${cartId}:`, error)
      return []
    }
  }, [])

  // Custom hooks
  const { customers, isLoading: customersLoading, fetchCustomers } = useCustomers()
  const { locations, isLoading: locationsLoading, fetchLocations } = useStoreLocations()
  const { companyId, companyName, priceListInfo, locationCatalogInfo, availableCompanies, companiesLoading, companyAddresses, setCompanyAddresses, fetchCustomerCompany, fetchCatalogData, fetchCompanyLocationId, fetchCustomerCompanies, fetchAllCompanies, fetchProductVariants, fetchContextualPricing, fetchCompanyAddresses, calculateTax } = useCompanyData()
  const { cartItems, isLoading: cartLoading, loadCartItems, updateItemQuantity, setCartItems } = useCart(apiData, fetchCartDetails)
  const { currency: shopCurrency, loading: currencyLoading } = useShopCurrency()

  // State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<any>(null)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [poNumber, setPoNumber] = useState('')
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('pickup')
  const [taxInfo, setTaxInfo] = useState<{totalTax: number, taxLines: any[], subtotal: number, total: number} | null>(null)

  // B2B customer detection
  const { isB2B, loading: b2bDetectionLoading } = useB2BCustomerDetection(selectedCustomerId)

  // Currency formatting helper
  const formatCurrencyWithShop = useCallback((amount: number) => {
    return formatCurrency(amount, shopCurrency)
  }, [shopCurrency])

  // Filter customers based on search term
  const filteredCustomers = useMemo(() => {
    if (!customerSearchTerm.trim()) {
      return customers
    }
    
    const searchLower = customerSearchTerm.toLowerCase()
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(searchLower) ||
      (customer.email && customer.email.toLowerCase().includes(searchLower))
    )
  }, [customers, customerSearchTerm])
  
  const [economyFee, setEconomyFee] = useState('15.00')
  const [standardFee, setStandardFee] = useState('25.00')
  const [customDeliveryFee, setCustomDeliveryFee] = useState('0.00')
  const [customDeliveryName, setCustomDeliveryName] = useState('')
  const [customSurcharge, setCustomSurcharge] = useState('0.00')
  const [surchargeDescription, setSurchargeDescription] = useState('')
  const [quantityRules, setQuantityRules] = useState<Record<string, QuantityRules>>({})

  // Surcharge detection helper functions
  const isSurchargeItem = useCallback((item: any) => {
    // Check custom attributes for explicit surcharge marking
    if (item.customAttributes) {
      const surchargeAttr = item.customAttributes.find((attr: any) => 
        attr.key === "Type" && attr.value === "Surcharge"
      )
      if (surchargeAttr) return true
    }
    
    // Check for surcharge keywords in name/title (backup method)
    const surchargeKeywords = ['surcharge', 'fee', 'charge', 'delivery', 'handling', 'rush']
    const name = (item.name || item.title || '').toLowerCase()
    return surchargeKeywords.some(keyword => name.includes(keyword))
  }, [])

  const isTaxableSurcharge = useCallback((item: any) => {
    if (!isSurchargeItem(item)) return false
    
    // Check custom attributes for tax status
    if (item.customAttributes) {
      const taxableAttr = item.customAttributes.find((attr: any) => 
        attr.key === "Taxable"
      )
      if (taxableAttr) {
        return taxableAttr.value === "Yes" || taxableAttr.value === "true"
      }
    }
    
    // Default to taxable for surcharges (can be overridden)
    return true
  }, [isSurchargeItem])

  const getSurchargeType = useCallback((item: any) => {
    if (!isSurchargeItem(item)) return null
    
    // Check custom attributes for surcharge type
    if (item.customAttributes) {
      const typeAttr = item.customAttributes.find((attr: any) => 
        attr.key === "Type"
      )
      if (typeAttr) return typeAttr.value
    }
    
    // Determine type from name/title keywords
    const name = (item.name || item.title || '').toLowerCase()
    if (name.includes('delivery')) return 'Delivery Fee'
    if (name.includes('rush')) return 'Rush Order Fee'
    if (name.includes('handling')) return 'Handling Fee'
    return 'Custom Surcharge'
  }, [isSurchargeItem])
  // Separate cart items into products and surcharges
  const { productItems, surchargeItems } = useMemo(() => {
    const products = cartItems.filter(item => !isSurchargeItem(item))
    const surcharges = cartItems.filter(item => isSurchargeItem(item))
    
    return {
      productItems: products,
      surchargeItems: surcharges
    }
  }, [cartItems, isSurchargeItem])

  // Calculate surcharge totals
  const surchargeTotals = useMemo(() => {
    const taxableSurcharges = surchargeItems.filter(item => isTaxableSurcharge(item))
    const nonTaxableSurcharges = surchargeItems.filter(item => !isTaxableSurcharge(item))
    
    return {
      totalSurcharges: surchargeItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      taxableSurcharges: taxableSurcharges.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      nonTaxableSurcharges: nonTaxableSurcharges.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      surchargeItems: surchargeItems,
      taxableSurchargeItems: taxableSurcharges,
      nonTaxableSurchargeItems: nonTaxableSurcharges
    }
  }, [surchargeItems, isTaxableSurcharge])

  const [b2bPricing, setB2bPricing] = useState<Record<string, any>>({})
  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [paymentTerms, setPaymentTerms] = useState<any>(null)
  const [paymentTermsTemplates, setPaymentTermsTemplates] = useState<any[]>([])
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState<any>(null)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [productDetailSource, setProductDetailSource] = useState<'cart' | 'quantity'>('cart')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [orderNumber] = useState(generateOrderNumber())
  const [createdOrder, setCreatedOrder] = useState<B2BOrder | null>(null)
  const [storeTaxSettings, setStoreTaxSettings] = useState<{taxesIncluded: boolean, taxShipping: boolean, countryCode: string} | null>(null)
  const [customerTaxExempt, setCustomerTaxExempt] = useState<boolean>(false)
  const [locationData, setLocationData] = useState<any>(null)

  // Fetch store tax settings
  const fetchStoreTaxSettings = useCallback(async () => {
    try {
      console.log('Fetching store tax settings')
      
      const query = `
        query GetShopSettings {
          shop {
            id
            name
            taxesIncluded
            taxShipping
            countryCode
            currencyCode
            taxSettings {
              taxCalculationMethod
              taxIncluded
            }
          }
        }
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })

      const result = await response.json()
      console.log('Store tax settings response:', result)

      if (result.data?.shop) {
        const shop = result.data.shop
        const taxSettings = {
          taxesIncluded: shop.taxesIncluded || shop.taxSettings?.taxIncluded || false,
          taxShipping: shop.taxShipping || false,
          countryCode: shop.countryCode || 'US'
        }
        
        setStoreTaxSettings(taxSettings)
        console.log('Store tax settings loaded:', taxSettings)
        return taxSettings
      }
      
      return null
    } catch (error) {
      console.error('Error fetching store tax settings:', error)
      return null
    }
  }, [])

  // Fetch customer tax exemption status
  const fetchCustomerTaxStatus = useCallback(async (customerId: string) => {
    try {
      console.log(`Fetching tax status for customer: ${customerId}`)
      
      const query = `
        query GetCustomerTaxStatus($customerId: ID!) {
          customer(id: $customerId) {
            id
            taxExempt
            taxExemptions {
              id
              country
              region
              taxCode
            }
          }
        }
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { customerId: `gid://shopify/Customer/${customerId}` }
        })
      })

      const result = await response.json()
      console.log('Customer tax status response:', result)

      if (result.data?.customer) {
        const isTaxExempt = result.data.customer.taxExempt || false
        setCustomerTaxExempt(isTaxExempt)
        console.log('Customer tax exemption status:', isTaxExempt)
        return isTaxExempt
      }
      
      return false
    } catch (error) {
      console.error('Error fetching customer tax status:', error)
      return false
    }
  }, [])


  // Fetch location data for tax calculation
  const fetchLocationData = useCallback(async (locationId: string) => {
    try {
      console.log(`Fetching location data for tax calculation: ${locationId}`)
      
      const query = `
        query GetLocationTaxData($locationId: ID!) {
          location(id: $locationId) {
            id
            name
            address {
              city
              province
              country
              zip
            }
            taxSettings {
              taxCalculationMethod
              taxIncluded
            }
          }
        }
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { locationId }
        })
      })

      const result = await response.json()
      console.log(`Location data response for ${locationId}:`, result)

      if (result.data?.location) {
        const location = result.data.location
        console.log('Location data loaded:', location)
        return location
      }
      
      return null
    } catch (error) {
      console.error(`Error fetching location data for ${locationId}:`, error)
      return null
    }
  }, [])


  // Fetch payment terms for draft order
  const fetchPaymentTerms = useCallback(async (draftOrderId: string) => {
    try {
      console.log(`Fetching payment terms for draft order: ${draftOrderId}`)

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        query: `
            query GetDraftOrderPaymentTerms($draftOrderId: ID!) {
              draftOrder(id: $draftOrderId) {
                id
                paymentTerms {
                  id
                  paymentTermsType
                  paymentTermsName
                  dueInDays
                  paymentSchedules(first: 250) {
                edges {
                  node {
                        dueAt
                        issuedAt
                      }
                    }
                  }
              }
            }
          }
        `,
          variables: { draftOrderId }
        })
      })

      const result = await response.json()
      console.log(`Payment terms response for ${draftOrderId}:`, result)

      if (result.data?.draftOrder?.paymentTerms) {
        setPaymentTerms(result.data.draftOrder.paymentTerms)
        return result.data.draftOrder.paymentTerms
      }
      
      return null
    } catch (error) {
      console.error(`Error fetching payment terms for draft order ${draftOrderId}:`, error)
      return null
    }
  }, [])

  // Fetch payment terms templates
  const fetchPaymentTermsTemplates = useCallback(async () => {
    try {
      console.log('Fetching payment terms templates')

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetPaymentTermsTemplates {
              paymentTermsTemplates {
                id
                name
                paymentTermsType
                dueInDays
                description
                translatedName
              }
            }
          `
        })
      })

      const result = await response.json()
      console.log('Payment terms templates response:', result)

      if (result.data?.paymentTermsTemplates) {
        console.log('Payment terms templates loaded:', result.data.paymentTermsTemplates.length, 'templates')
        result.data.paymentTermsTemplates.forEach((template: any, index: number) => {
          console.log(`Template ${index + 1}:`, {
            name: template.name,
            type: template.paymentTermsType,
            dueInDays: template.dueInDays,
            description: template.description
          })
        })
        setPaymentTermsTemplates(result.data.paymentTermsTemplates)
        return result.data.paymentTermsTemplates
      }
      
      return null
    } catch (error) {
      console.error('Error fetching payment terms templates:', error)
      return null
    }
  }, [])



  // Complete draft order to make it appear in Orders section (payment pending by default)
  const completeDraftOrder = useCallback(async (draftOrderId: string) => {
    try {
      console.log(`Completing draft order: ${draftOrderId}`)
      
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation DraftOrderComplete($id: ID!) {
              draftOrderComplete(id: $id) {
                draftOrder {
                  id
                  order {
                    id
                    displayFinancialStatus
                    displayFulfillmentStatus
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          variables: { id: draftOrderId }
        })
      })

      const result = await response.json()
      console.log('Draft order complete response:', result)

      if (result.errors) {
        console.error('GraphQL errors:', result.errors)
        return null
      }

      if (result.data?.draftOrderComplete?.userErrors?.length > 0) {
        console.error('User errors:', result.data.draftOrderComplete.userErrors)
        return null
      }

      const completedOrder = result.data?.draftOrderComplete?.draftOrder?.order
      if (completedOrder) {
        console.log('Draft order completed successfully:', completedOrder.id)
        console.log('Financial Status:', completedOrder.displayFinancialStatus)
        console.log('Fulfillment Status:', completedOrder.displayFulfillmentStatus)
        return completedOrder
      }
      
      return null
    } catch (error) {
      console.error('Error completing draft order:', error)
      return null
    }
  }, [])

  // Create fulfillment for the order to mark it as "Fulfilled"
  const createFulfillment = useCallback(async (orderId: string) => {
    try {
      console.log(`Creating fulfillment for order: ${orderId}`)
      
      // First, get the fulfillment orders for this order
      const fulfillmentOrdersQuery = `
        query GetFulfillmentOrders($orderId: ID!) {
          order(id: $orderId) {
            id
            fulfillmentOrders(first: 10) {
              edges {
                node {
                  id
                  status
                  lineItems(first: 50) {
                    edges {
                      node {
                        id
                        quantity
                        remainingQuantity
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `

      const fulfillmentOrdersResponse = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: fulfillmentOrdersQuery,
          variables: { orderId }
        })
      })

      const fulfillmentOrdersResult = await fulfillmentOrdersResponse.json()
      console.log('Fulfillment orders response:', fulfillmentOrdersResult)

      if (fulfillmentOrdersResult.errors) {
        console.error('GraphQL errors fetching fulfillment orders:', fulfillmentOrdersResult.errors)
        return null
      }

      const fulfillmentOrders = fulfillmentOrdersResult.data?.order?.fulfillmentOrders?.edges || []
      
      if (fulfillmentOrders.length === 0) {
        console.log('No fulfillment orders found for this order')
        return null
      }

      // Create fulfillment for each fulfillment order
      for (const fulfillmentOrderEdge of fulfillmentOrders) {
        const fulfillmentOrder = fulfillmentOrderEdge.node
        
        // Prepare line items for fulfillment
        const fulfillmentLineItems = fulfillmentOrder.lineItems.edges.map((edge: any) => ({
          id: edge.node.id,
          quantity: edge.node.remainingQuantity || edge.node.quantity
        })).filter((item: any) => item.quantity > 0)

        if (fulfillmentLineItems.length === 0) {
          console.log('No items to fulfill for fulfillment order:', fulfillmentOrder.id)
          continue
        }

        const fulfillmentMutation = `
          mutation CreateFulfillment($input: FulfillmentCreateInput!) {
            fulfillmentCreate(input: $input) {
              fulfillment {
                id
                status
                trackingInfo {
                  number
                  url
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `

        const fulfillmentInput = {
          fulfillmentOrderId: fulfillmentOrder.id,
          lineItems: fulfillmentLineItems,
          notifyCustomer: false, // Don't notify customer for B2B orders
          trackingInfo: {
            number: `B2B-${orderNumber}`,
            url: null
          }
        }

        const fulfillmentResponse = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: fulfillmentMutation,
            variables: { input: fulfillmentInput }
          })
        })

        const fulfillmentResult = await fulfillmentResponse.json()
        console.log('Fulfillment creation response:', fulfillmentResult)

        if (fulfillmentResult.errors) {
          console.error('GraphQL errors creating fulfillment:', fulfillmentResult.errors)
          continue
        }

        if (fulfillmentResult.data?.fulfillmentCreate?.userErrors?.length > 0) {
          console.error('Fulfillment creation user errors:', fulfillmentResult.data.fulfillmentCreate.userErrors)
          continue
        }

        const fulfillment = fulfillmentResult.data?.fulfillmentCreate?.fulfillment
        if (fulfillment) {
          console.log('Fulfillment created successfully:', fulfillment.id)
        }
      }

      return true
    } catch (error) {
      console.error('Error creating fulfillment:', error)
      return null
    }
  }, [orderNumber])




  // Fetch product images using the standard Shopify Admin GraphQL API
  const fetchProductImages = useCallback(async (items: any[]) => {
    const imageMap: Record<string, string> = {}
    
    for (const item of items) {
      try {
        // Convert productId to proper GID format if needed
        let productGid = item.productId
        if (!productGid.startsWith('gid://shopify/Product/')) {
          productGid = `gid://shopify/Product/${item.productId}`
        }
        
        console.log(`Fetching images for product: ${productGid}`)
        
        const response = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
        query: `
              query GetProductImages($productId: ID!) {
                product(id: $productId) {
                  id
                  title
                  images(first: 5) {
            edges {
              node {
                          id
                        originalSrc
                            altText
                          }
                        }
                  }
                }
              }
            `,
            variables: { productId: productGid }
          })
        })

        const result = await response.json()
        console.log(`Product images response for ${productGid}:`, result)

        if (result.data?.product?.images?.edges) {
          const imageEdges = result.data.product.images.edges
          if (imageEdges.length > 0) {
            const firstImage = imageEdges[0].node
            console.log(`Processing image node:`, firstImage)
            
            if (firstImage.originalSrc) {
              imageMap[item.productId] = firstImage.originalSrc
              console.log(`Found image for product ${productGid}: ${firstImage.originalSrc}`)
              console.log(`Image alt text: ${firstImage.altText || 'No alt text'}`)
            } else {
              console.log(`Image node missing originalSrc:`, firstImage)
            }
          } else {
            console.log(`No images found for product ${productGid}`)
          }
        } else {
          console.log(`No images data in response for product ${productGid}:`, result.data)
        }
    } catch (error) {
        console.error(`Error fetching images for product ${item.productId}:`, error)
      }
    }
    
    setProductImages(imageMap)
    return imageMap
  }, [])

  // Computed values
  const deliveryFee = useMemo(() => {
    let fee = 0
    switch (deliveryMethod) {
      case 'pickup': 
        fee = 0
        break
      default: 
        fee = parseFloat(customDeliveryFee) || 0
    }
    return fee
  }, [deliveryMethod, customDeliveryFee])

  // Custom surcharge calculation
  const surchargeAmount = useMemo(() => {
    return parseFloat(customSurcharge) || 0
  }, [customSurcharge])

  // Total fees (delivery + surcharge)
  const totalFees = useMemo(() => {
    return deliveryFee + surchargeAmount
  }, [deliveryFee, surchargeAmount])

  // Log B2B detection for debugging
  useEffect(() => {
    console.log('B2B Detection updated:', {
      isB2B,
      b2bDetectionLoading,
      totalFees,
      surchargeTotals,
      productItemsCount: productItems.length,
      surchargeItemsCount: surchargeItems.length,
      cartItemsCount: cartItems.length
    })
  }, [isB2B, b2bDetectionLoading, totalFees, surchargeTotals, productItems.length, surchargeItems.length, cartItems.length])

  // Reactive tax validation - automatically validate when B2B detection changes
  useEffect(() => {
    if (isB2B) {
      console.log('B2B customer detected - tax will be handled externally')
    } else {
      console.log('Retail customer - Shopify will apply taxes at checkout')
    }
  }, [isB2B])

  // Reactive order summary - automatically updates when cart changes
  const orderSummary = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => {
      const contextualPricing = b2bPricing[item.productId]
      const price = contextualPricing?.price || item.price
      return sum + (price * item.quantity)
    }, 0)

    return {
    subtotal: subtotal,
    deliveryFee: deliveryFee,
      surchargeAmount: surchargeAmount,
      totalFees: totalFees,
      finalTotal: subtotal + totalFees,
      isB2B: isB2B
    }
  }, [cartItems, b2bPricing, deliveryFee, surchargeAmount, totalFees, isB2B])

  // Reactive draft order preparation - automatically updates when cart changes
  const draftOrderData = useMemo(() => {
    if (!selectedCustomer || !selectedLocation || cartItems.length === 0) {
      return null
    }

    return {
      lineItems: [
        // Product items
        ...cartItems.map(item => {
          const contextualPricing = b2bPricing[item.productId]
          const b2bPrice = contextualPricing?.price || item.price
          return {
            title: item.name,
            originalUnitPrice: b2bPrice.toString(),
            quantity: item.quantity,
            customAttributes: [
              { key: "SKU", value: item.sku || "N/A" },
              { key: "Product ID", value: item.productId },
              { key: "Variant ID", value: item.variantId },
              { key: "B2B Price", value: contextualPricing ? "Yes" : "No" }
            ]
          }
        }),
        // Delivery fee
        ...(deliveryFee > 0 ? [{
          title: deliveryMethod === 'economy' ? 'Economy Delivery' : 
                 deliveryMethod === 'standard' ? 'Standard Delivery' : 
                 'Delivery Fee',
          originalUnitPrice: deliveryFee.toString(),
          quantity: 1,
          customAttributes: [
            { key: "Type", value: "Delivery Fee" },
            { key: "Method", value: deliveryMethod },
            { key: "Taxable", value: isB2B ? "No" : "Yes" }
          ]
        }] : [])
      ],
      totals: {
        subtotal: orderSummary.subtotal,
        deliveryFee: deliveryFee,
        totalFees: totalFees,
        finalTotal: orderSummary.finalTotal,
        isB2B: isB2B
      }
    }
  }, [cartItems, b2bPricing, deliveryFee, deliveryMethod, orderSummary, totalFees, isB2B, selectedCustomer, selectedLocation])

  const volumeDiscount = useMemo(() => 
    calculateVolumeDiscount(orderSummary.subtotal, selectedCustomer?.tier || 'standard')
  , [orderSummary.subtotal, selectedCustomer?.tier])

  const quantityValidation = useMemo((): ValidationResult => 
    validateQuantityRules(cartItems, quantityRules)
  , [cartItems, quantityRules])

  // Format Net Terms display
  const formatNetTerms = (template: any) => {
    if (template.paymentTermsType === 'NET' && template.dueInDays) {
      return `Net ${template.dueInDays} (due in ${template.dueInDays} days)`
    }
    return template.name || template.translatedName || 'Custom Terms'
  }

  // Effects
  useEffect(() => {
    fetchLocations()
    loadCartItems()
    fetchPaymentTermsTemplates()
    fetchStoreTaxSettings()
  }, [fetchLocations, loadCartItems, fetchPaymentTermsTemplates, fetchStoreTaxSettings])

  // Auto-select first Net Terms template when templates are loaded
  useEffect(() => {
    if (paymentTermsTemplates.length > 0 && !selectedPaymentTerms) {
      const netTermsTemplate = paymentTermsTemplates.find(template => template.paymentTermsType === 'NET')
      if (netTermsTemplate) {
        setSelectedPaymentTerms(netTermsTemplate)
      }
    }
  }, [paymentTermsTemplates, selectedPaymentTerms])

  useEffect(() => {
    setValidationErrors(quantityValidation.isValid ? [] : quantityValidation.errors)
  }, [quantityValidation])

  // Auto-load customers when customer screen is shown
  useEffect(() => {
    if (currentScreen === 'customer' && customers.length === 0 && !customersLoading) {
      fetchCustomers(50)
    }
  }, [currentScreen, customers.length, customersLoading, fetchCustomers])

  // Fetch customer tax status when customer is selected
  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerTaxStatus(selectedCustomerId)
    }
  }, [selectedCustomerId, fetchCustomerTaxStatus])

  // Fetch location data when location is selected
  useEffect(() => {
    if (selectedLocation?.id) {
      fetchLocationData(selectedLocation.id).then((location) => {
        if (location) {
          setLocationData(location)
        }
      })
    }
  }, [selectedLocation?.id, fetchLocationData])

  // Auto-load companies when location screen is shown
  useEffect(() => {
    console.log('Location screen useEffect triggered:', {
      currentScreen,
      availableCompaniesLength: availableCompanies.length,
      companiesLoading,
      selectedCustomer: selectedCustomer?.name
    })
    
    if (currentScreen === 'location' && availableCompanies.length === 0 && !companiesLoading && selectedCustomer) {
      console.log(`Triggering fetchCustomerCompanies for: ${selectedCustomer.name}`)
      fetchCustomerCompanies(selectedCustomer.name)
    }
  }, [currentScreen, availableCompanies.length, companiesLoading, selectedCustomer, fetchCustomerCompanies])


  // Handlers
  const fetchB2BPricingForCart = useCallback(async (catalogInfo: any) => {
    try {
      const pricing: { [key: string]: any } = {}
      const rules: { [key: string]: any } = {}
      
      // Use the locationId from the catalog info
      const locationId = catalogInfo.locationId
      
      if (!locationId) {
        console.error('No location ID found in catalog info')
        return { pricing, rules }
      }
      
      for (const item of cartItems) {
        if (item.variantId) {
          // Convert variant ID to proper GID format if needed
          const variantGid = item.variantId.startsWith('gid://') 
            ? item.variantId 
            : `gid://shopify/ProductVariant/${item.variantId}`
          
          const contextualPricing = await fetchContextualPricing(variantGid, locationId);
          
          if (contextualPricing) {
            pricing[item.productId] = {
              price: parseFloat(contextualPricing.price.amount),
              currency: contextualPricing.price.currencyCode,
              compareAtPrice: item.compareAtPrice
            }
            
            // Store quantity rules
            rules[item.productId] = {
              minQuantity: contextualPricing.quantityRule.minimum,
              maxQuantity: contextualPricing.quantityRule.maximum,
              increment: contextualPricing.quantityRule.increment,
              priceBreaks: contextualPricing.quantityPriceBreaks.nodes
            }
          }
        }
      }
      
      return { pricing, rules }
    } catch (error) {
      console.error('Error fetching B2B pricing for cart:', error)
      return { pricing: {}, rules: {} }
    }
  }, [cartItems, fetchContextualPricing])

  const handleCustomerSelection = useCallback(async (customer: Customer) => {
    console.log(`Customer selected: ${customer.name}`)
    setSelectedCustomer(customer)
    setSelectedCustomerId(customer.id)
    
    // Navigate immediately for better UX
    setCurrentScreen('location')
    
    // Do heavy operations in background
    try {
      console.log('Fetching company locations for selected customer')
      await fetchCustomerCompanies(customer.name)
      
      const company = await fetchCustomerCompany(customer.name)
      
      if (company) {
        const locationCatalog = await fetchCompanyLocationId(company)
        
        if (locationCatalog) {
          const { pricing, rules } = await fetchB2BPricingForCart(locationCatalog)
          setB2bPricing(pricing)
          setQuantityRules(rules)
          
          const items = await loadCartItems(pricing)
          if (items && items.length > 0) {
            await fetchProductImages(items)
          }
      } else {
          const productIds = cartItems.map(item => item.productId)
          const { pricing, rules } = await fetchCatalogData(productIds)
          setB2bPricing(pricing)
          setQuantityRules(rules)
          const items = await loadCartItems(pricing)
          if (items && items.length > 0) {
            await fetchProductImages(items)
          }
        }
      } else {
        const items = await loadCartItems({})
        if (items && items.length > 0) {
          await fetchProductImages(items)
        }
      }
    } catch (error) {
      console.error('Error handling customer selection:', error)
    }
  }, [cartItems, fetchCustomerCompany, fetchCatalogData, loadCartItems, fetchCompanyLocationId, fetchB2BPricingForCart, fetchCustomerCompanies])

  const createB2BOrder = useCallback(async () => {
    try {
      if (!selectedCustomer || !selectedLocation) {
        setValidationErrors(['⚠️ Please select both customer and company location to proceed'])
        return
      }

      if (!poNumber || poNumber.trim() === '') {
        setValidationErrors(['📋 Purchase Order Number is required for B2B orders'])
        return
      }

      if (!validatePONumber(poNumber)) {
        setValidationErrors(['❌ Invalid PO number format. Please use alphanumeric characters'])
        return
      }

      if (!quantityValidation.isValid) {
        setValidationErrors(quantityValidation.errors)
        return
      }

      // Use B2B detection for tax handling
      console.log('Creating B2B order with customer type:', {
        isB2B,
        b2bDetectionLoading,
        orderSummary
      })

      // Prepare line items for the draft order
      const lineItems = cartItems.map(item => {
        const isSurcharge = isSurchargeItem(item)
        const contextualPricing = b2bPricing[item.productId]
        const b2bPrice = contextualPricing?.price || item.price
        
        if (isSurcharge) {
          // Handle surcharge items with explicit custom attributes
          return {
            title: item.name,
            originalUnitPrice: b2bPrice.toString(),
            quantity: 1, // Surcharges always have quantity 1
            customAttributes: [
              { key: "Type", value: "Surcharge" },
              { key: "SurchargeType", value: getSurchargeType(item) || "Custom Surcharge" },
              { key: "Taxable", value: isTaxableSurcharge(item) ? "Yes" : "No" },
              { key: "Description", value: surchargeDescription || "Additional fee" }
            ]
          }
        } else {
          // Handle regular product items
          return {
            title: item.name,
            originalUnitPrice: b2bPrice.toString(),
            quantity: item.quantity,
            customAttributes: [
              { key: "SKU", value: item.sku || "N/A" },
              { key: "Product ID", value: item.productId },
              { key: "Variant ID", value: item.variantId },
              { key: "B2B Price", value: contextualPricing ? "Yes" : "No" }
            ]
          }
        }
      })

      // Add delivery fee as a line item if applicable
      if (deliveryFee > 0) {
        const deliveryMethodName = deliveryMethod === 'economy' ? 'Economy Delivery' : 
                                 deliveryMethod === 'standard' ? 'Standard Delivery' : 
                                 'Delivery Fee'
        
        lineItems.push({
          title: deliveryMethodName,
          originalUnitPrice: deliveryFee.toString(),
          quantity: 1,
          customAttributes: [
            { key: "Type", value: "Delivery Fee" },
            { key: "Method", value: deliveryMethod },
            { key: "Taxable", value: isB2B ? "No" : "Yes" }
          ]
        })
      }

      // Add custom surcharge as a line item if applicable
      if (surchargeAmount > 0) {
        lineItems.push({
          title: surchargeDescription || 'Custom Surcharge',
          originalUnitPrice: surchargeAmount.toString(),
          quantity: 1,
          customAttributes: [
            { key: "Type", value: "Custom Surcharge" },
            { key: "Description", value: surchargeDescription || "Additional fee" },
            { key: "Taxable", value: isB2B ? "No" : "Yes" }
          ]
        })
      }
      
      // Create draft order using Shopify Admin GraphQL API
      const draftOrderMutation = `
        mutation CreateB2BDraftOrder($input: DraftOrderInput!) {
          draftOrderCreate(input: $input) {
            draftOrder {
              id
              name
                paymentTerms {
        id
        paymentTermsType
        dueInDays
      }
              status
              invoiceUrl
              totalPrice
              subtotalPrice
              totalTax
            
              tags
              customer {
                id
                displayName
              }
              lineItems(first: 250) {
                edges {
                  node {
                    id
                    title
                    quantity
                    originalUnitPrice
                    customAttributes {
                      key
                      value
                    }
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `

      // Note: Tax handling is done via line items in DraftOrderInput
      // The taxLines field is not supported in DraftOrderInput type

      const input: any = {
        note: `B2B Wholesale Order - ${orderNumber}${poNumber ? ` | PO: ${poNumber}` : ''}${isB2B ? ' | Tax handled externally' : ''}`,
        email: selectedCustomer.email || undefined,
        tags: isB2B ? ['B2B', 'Wholesale', 'POS-Extension', 'TaxExempt'] : ['B2B', 'Wholesale', 'POS-Extension'],
        lineItems: lineItems,
        taxExempt: isB2B, // ✅ Set taxExempt based on B2B detection
        customAttributes: [
          { key: "Order Number", value: orderNumber },
          { key: "Company", value: companyName || 'N/A' },
          { key: "Location", value: selectedLocation?.name || selectedLocation?.address?.name || 'Unknown Location' },
          { key: "Created By", value: "B2B POS Extension" },
          { key: "Customer Type", value: isB2B ? "B2B (Tax Exempt)" : "B2B (Tax Included)" },
          { key: "Tax Amount", value: isB2B ? "Handled externally" : (taxInfo ? `$${taxInfo.totalTax.toFixed(2)}` : '$0.00') }
        ],
        metafields: [
          {
            namespace: "b2b_wholesale",
            key: "order_type",
            type: "single_line_text_field",
            value: "wholesale"
          },
          {
            namespace: "b2b_wholesale", 
            key: "company_location",
            type: "single_line_text_field",
            value: selectedLocation?.name || selectedLocation?.address?.name || 'Unknown Location'
          }
        ]
      }

      // Add PO number as metafield if provided
      if (poNumber) {
        input.metafields.push({
          namespace: "b2b_wholesale",
          key: "po_number", 
          type: "single_line_text_field",
          value: poNumber
        })
      }

      console.log('Creating draft order with input:', JSON.stringify(input, null, 2))

      // Try to create draft order with payment terms first
      let inputWithPaymentTerms = { ...input }
      if (selectedPaymentTerms) {
        inputWithPaymentTerms.paymentTerms = {
          paymentTermsTemplateId: selectedPaymentTerms.id
        }
      }

      let response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: draftOrderMutation,
          variables: { input: inputWithPaymentTerms }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      let result = await response.json()
      
      console.log('Draft order creation response:', JSON.stringify(result, null, 2))
      
      // Check if payment terms permission error occurred
      const hasPaymentTermsError = result.data?.draftOrderCreate?.userErrors?.some((error: any) => 
        error.message.includes('payment terms') || error.message.includes('Payment terms')
      )

      // If payment terms failed due to permissions, retry without payment terms
      if (hasPaymentTermsError && selectedPaymentTerms) {
        console.log('Payment terms permission denied, retrying without payment terms...')
        
        const inputWithoutPaymentTerms = { ...input }
        delete inputWithoutPaymentTerms.paymentTerms
        
        response = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: draftOrderMutation,
            variables: { input: inputWithoutPaymentTerms }
          })
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        result = await response.json()
        console.log('Draft order creation retry response:', JSON.stringify(result, null, 2))
      }
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors)
        throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`)
      }

      if (result.data?.draftOrderCreate?.userErrors?.length > 0) {
        console.error('Draft order creation user errors:', result.data.draftOrderCreate.userErrors)
        throw new Error(`Draft order creation failed: ${result.data.draftOrderCreate.userErrors.map((e: any) => e.message).join(', ')}`)
      }

      const draftOrder = result.data?.draftOrderCreate?.draftOrder
      
      if (!draftOrder) {
        console.error('No draft order returned from API. Full response:', result)
        throw new Error('No draft order returned from API')
      }

      console.log('Draft order created successfully:', draftOrder)

      // Create local order data for confirmation screen using hook values
      const orderData: B2BOrder = {
        customerId: selectedCustomer.id,
        customer: selectedCustomer,
        poNumber: poNumber || undefined,
        tags: ['B2B', 'Wholesale'],
        items: cartItems,
        subtotal: orderSummary.subtotal, // From order summary
        deliveryFee: deliveryFee,
        surcharge: surchargeAmount, // Add surcharge to order data
        surchargeDescription: surchargeDescription || undefined,
        volumeDiscount: 0, // No volume discount as requested
        tax: isB2B ? 0 : 0, // Tax handled externally for B2B, calculated at checkout for retail
        total: orderSummary.finalTotal, // From order summary - accurate total
        isDraft: true,
        status: 'draft',
        shopifyDraftOrderId: draftOrder?.id || 'Unknown',
        shopifyOrderName: draftOrder?.name || 'Unknown',
        invoiceUrl: draftOrder.invoiceUrl
      }

      logOrderOperation('create_b2b_draft_order', orderNumber, {
        customerId: selectedCustomer.id,
        itemCount: cartItems.length,
        total: orderData.total,
        location: selectedLocation?.name || selectedLocation?.address?.name || 'Unknown Location',
        shopifyDraftOrderId: draftOrder?.id || 'Unknown',
        shopifyOrderName: draftOrder?.name || 'Unknown'
      })

      setCreatedOrder(orderData)
      setValidationErrors([])
      
      // Fetch payment terms for the created draft order
      if (draftOrder.id) {
        await fetchPaymentTerms(draftOrder.id)
      }
      
      // Complete the draft order to make it appear in Orders section (payment pending by default)
      if (draftOrder.id) {
        const completedOrder = await completeDraftOrder(draftOrder.id)
        if (completedOrder) {
          // Update the order data with the completed order ID
          setCreatedOrder(prev => prev ? {
            ...prev,
            shopifyOrderId: completedOrder.id,
            isDraft: false,
            status: 'completed' as const
          } : prev)

          // Create fulfillment to mark the order as "Fulfilled"
          console.log('Creating fulfillment for completed order:', completedOrder.id)
          const fulfillmentResult = await createFulfillment(completedOrder.id)
          if (fulfillmentResult) {
            console.log('Order marked as fulfilled successfully')
          } else {
            console.log('Failed to create fulfillment, but order was completed')
          }
        }
      }
      
      setCurrentScreen('confirmation')
        } catch (error) {
      console.error('Error creating B2B draft order:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setValidationErrors([`❌ Failed to create order: ${errorMessage}. Please try again or contact support.`])
    }
  }, [selectedCustomer, selectedLocation, poNumber, quantityValidation, cartItems, orderSummary, orderNumber, deliveryFee, deliveryMethod, surchargeAmount, surchargeDescription, isB2B, createFulfillment])

  // Navigation handlers
  const goToNextScreen = useCallback(() => {
    const screenFlow = {
      customer: 'location',
      location: 'cart',
      cart: quantityValidation.isValid ? 'delivery' : 'quantity',
      quantity: 'delivery',
      delivery: 'confirmation'
    } as const

    const nextScreen = screenFlow[currentScreen as keyof typeof screenFlow]
    if (nextScreen) {
      setCurrentScreen(nextScreen)
    }
  }, [currentScreen, quantityValidation.isValid])

  const goToPreviousScreen = useCallback(() => {
    const screenFlow = {
      location: 'customer',
      cart: 'location',
      quantity: 'cart',
      delivery: quantityValidation.isValid ? 'cart' : 'quantity',
      confirmation: 'delivery'
    } as const

    const prevScreen = screenFlow[currentScreen as keyof typeof screenFlow]
    if (prevScreen) {
      setCurrentScreen(prevScreen)
    }
  }, [currentScreen, quantityValidation.isValid])

  const resetOrder = useCallback(() => {
        setCurrentScreen('customer')
    setSelectedCustomer(null)
    setSelectedCustomerId(null)
    setSelectedLocation(null)
    setCartItems([])
    setPoNumber('')
    setCreatedOrder(null)
    setValidationErrors([])
  }, [setCartItems])

  // Screen renderers
  const renderCustomerScreen = () => (
    <>
      <Text variant="headingLarge">Customer Selection</Text>
      <Text>Select the business client for this wholesale transaction</Text>
      <Text> </Text>
      
      <TextField
        label="Client Search"
        placeholder="Enter client name or email address..."
        value={customerSearchTerm}
        onChange={setCustomerSearchTerm}
      />
      <Text> </Text>
      
      {customersLoading ? (
        <Text>Retrieving client database...</Text>
      ) : filteredCustomers.length > 0 ? (
        <ScrollView>
          {filteredCustomers.map(customer => {
            // Show full customer information - Button component handles centering automatically
            const name = (customer.name || 'Unknown Client').trim()
            const email = (customer.email || 'No email address').trim()
            const posOrders = customer.hasPosOrders ? 'Previous POS Transactions' : ''
            
            return (
              <POSBlock key={customer.id}>
                <POSBlockRow>
                  <Text variant="headingLarge">{name}</Text>
                  <Button
                    title={selectedCustomerId === customer.id ? "✓" : "○"}
                    onPress={() => {
                      setSelectedCustomer(customer)
                      setSelectedCustomerId(customer.id)
                    }}
                    type={selectedCustomerId === customer.id ? 'primary' : 'basic'}
                  />
                </POSBlockRow>
                <POSBlockRow>
                  <Text variant="body">{email}</Text>
                </POSBlockRow>
                {posOrders && (
                  <POSBlockRow>
                    <Text variant="body">POS Transactions</Text>
                  </POSBlockRow>
                )}
              </POSBlock>
            )
          })}
        </ScrollView>
      ) : (
        <Text>{customerSearchTerm ? 'No clients match your search criteria' : 'No clients available in the system'}</Text>
      )}
      
      {selectedCustomer && (
        <>
          <Text> </Text>
          <Button
            title="Proceed to Company Selection"
            onPress={() => handleCustomerSelection(selectedCustomer)}
          />
        </>
      )}
    </>
  )

  const formatBillingAddress = (billingAddress: any) => {
    if (!billingAddress) return 'No billing address available'
    
    const parts = [
      billingAddress.address1,
      billingAddress.address2,
      billingAddress.city,
      billingAddress.province,
      billingAddress.zip,
      billingAddress.country
    ].filter(Boolean)
    
    return parts.length > 0 ? parts.join(', ') : 'No billing address available'
  }

  const renderLocationScreen = () => (
    <>
      <Text variant="headingLarge">Company Location Selection</Text>
      <Text>Select the business location for this wholesale transaction</Text>
      <Text> </Text>
      
      {availableCompanies.length > 0 ? (
        <ScrollView>
          {availableCompanies.map((location, index) => {
            const billingAddress = formatBillingAddress(location.billingAddress)
            const buttonTitle = `${location.name}\n${billingAddress}`
            
            return (
            <>
              <Button
                  key={location.id}
                  title={buttonTitle}
                  type={selectedCompany === location.id ? 'primary' : 'basic'}
                onPress={async () => {
                    setSelectedCompany(location.id)
                  try {
                      // Set the selected location directly since we have the location data
                      const newLocation = {
                        id: location.id,
                        name: location.name,
                        companyName: location.name,
                        companyId: location.id,
                        shippingAddress: location.shippingAddress,
                        billingAddress: location.billingAddress
                      }
                      
                      setSelectedLocation(newLocation)
                      
                      // Store the address data for this location
                      setCompanyAddresses(prev => ({
                        ...prev,
                        [location.id]: {
                          billingAddress: location.billingAddress,
                          shippingAddress: location.shippingAddress,
                          locationName: location.name
                        }
                      }))
                      
                      // Fetch location data for tax calculation
                      const locationData = await fetchLocationData(location.id)
                      if (locationData) {
                        setLocationData(locationData)
                      }
                      
                      // For B2B pricing, we'll need to create a catalog info object
                      const catalogInfo = {
                        locationId: location.id,
                        companyName: location.name,
                        companyId: location.id
                      }
                      
                      // Fetch B2B contextual pricing for the selected location
                      const { pricing, rules } = await fetchB2BPricingForCart(catalogInfo)
                      setB2bPricing(pricing)
                      setQuantityRules(rules)
                      
                      // Reload cart items with new pricing
                      const items = await loadCartItems(pricing)
                      if (items && items.length > 0) {
                        await fetchProductImages(items)
                    }
                  } catch (error) {
                      console.error(`Error selecting location ${location.name}:`, error)
                  }
                }}
              />
              <Text> </Text>
            </>
            )
          })}
        </ScrollView>
      ) : (
        <Text>
          {companiesLoading 
            ? "Retrieving company locations..." 
            : selectedCustomer 
              ? `No company locations associated with ${selectedCustomer.name}` 
              : "Please select a client first"
          }
        </Text>
      )}

      {selectedCompany && (
        <>
          <Text> </Text>
          <Text>✓ Location selected successfully</Text>
        </>
      )}

      <Text> </Text>
      <Button
        title="Proceed to Order Review"
        onPress={goToNextScreen}
        isDisabled={!selectedCompany || !selectedCustomer}
      />
      <Text> </Text>
      
      <Button title="Back" onPress={goToPreviousScreen} />
      <Text> </Text>
    </>
  )

  const renderCartScreen = () => (
    <>
      <Button
          title="← Return to Location Selection"
        type="basic"
        onPress={() => setCurrentScreen('location')}
      />
      <Text> </Text>
      
      <POSBlock>
        <POSBlockRow>
          <Text variant="headingLarge">Transaction Review</Text>
          <Text variant="headingLarge">Review order details before proceeding to fulfillment</Text>
        </POSBlockRow>
      </POSBlock>
      
      <Text> </Text>
      
      <Text variant="headingLarge">Client Information</Text>
      <Text>Client: {selectedCustomer?.name || 'No client selected'}</Text>
      <Text>Company Entity: {companyName || 'No company selected'}</Text>
      
      <Text> </Text>
      
      
      <Text variant="headingLarge">Billing Information</Text>
      <Text>Company Entity: {companyName || 'No company selected'}</Text>
      <Text>Address: {(() => {
        if (!selectedLocation?.companyId || !companyAddresses[selectedLocation.companyId]?.billingAddress) {
          return 'Address information not available'
        }
        const billing = companyAddresses[selectedLocation.companyId].billingAddress!
        const addressParts = [
          billing.address1,
          billing.city,
          billing.country
        ].filter(part => part && part.trim())
        return addressParts.join(', ') || 'Address information not available'
      })()}</Text>
      <Text> </Text>
      
      <Button
        title="Modify Company Location"
        onPress={() => setCurrentScreen('location')}
      />
      <Text> </Text>

      <Text variant="headingLarge">Order Items ({cartItems.reduce((total, item) => total + item.quantity, 0)} units)</Text>
      <Text> </Text>
      
      {cartItems.length > 0 ? (
        <>
          {cartItems.map((item, index) => {
            const isSurcharge = isSurchargeItem(item)
            const rules = quantityRules[item.productId]
            const contextualPricing = b2bPricing[item.productId]
            const b2bPrice = contextualPricing?.price
            const itemSubtotal = b2bPrice ? item.quantity * b2bPrice : item.quantity * item.price
            const serialNumber = index + 1
            
            return (
              <ScrollView key={index}>
                <Text variant="headingSmall">{serialNumber}. {item.name}</Text>
                <Text> </Text>
                
                {!isSurcharge && productImages[item.productId] && (
                  <Image src={productImages[item.productId]} />
                )}
                <Text> </Text>
                
                {isSurcharge ? (
                  <>
                    <Text>Service Type: {getSurchargeType(item)}</Text>
                    <Text>Amount: {formatCurrencyWithShop(item.price)}</Text>
                    <Text>Taxable: {isTaxableSurcharge(item) ? 'Yes' : 'No'}</Text>
                    <Text>Service charges cannot be modified</Text>
                  </>
                ) : (
                  <>
                    <Text>Quantity: {item.quantity} | {b2bPrice ? `Wholesale Price: ${formatCurrencyWithShop(b2bPrice)}` : `Standard Price: ${formatCurrencyWithShop(item.price)}`} | Line Total: {formatCurrencyWithShop(itemSubtotal)}</Text>
                    {rules && (
                      <Text>Minimum: {rules.minQuantity}{rules.maxQuantity ? ` | Maximum: ${rules.maxQuantity}` : ''}</Text>
                    )}
                    <Text> </Text>
                    
                    <Button
                      title="Modify Quantity"
                      onPress={() => {
                        setSelectedProduct(item)
                        setProductDetailSource('cart')
                        setCurrentScreen('product-detail')
                      }}
                    />
                  </>
                )}
                <Text> </Text>
                
                <Text> </Text>
              </ScrollView>
            )
          })}
          
          {quantityValidation.isValid ? null : (
            <>
              <Text> </Text>
              <Text variant="headingLarge">{quantityValidation.errors.length} items below minimum quantity requirements</Text>
              <Text> </Text>
              <Button
                title="Resolve Quantity Issues"
                onPress={() => setCurrentScreen('quantity')}
                
              />
              <Text> </Text>
            </>
          )}
        </>
      ) : (
        <Text>No items in transaction</Text>
      )}

      <Text> </Text>
      <Button
        title="Proceed to Fulfillment Details"
        onPress={goToNextScreen}
        isDisabled={cartItems.length === 0 || !quantityValidation.isValid}
      />
      <Text> </Text>
      
      <Button title="Back" onPress={goToPreviousScreen} />
      <Text> </Text>
    </>
  )

  const renderQuantityScreen = () => (
    <>
      <Button
        title="← Back"
        type="basic"
        onPress={() => setCurrentScreen('cart')}
      />
      <Text> </Text>
      
      <Text variant="headingLarge">Quantity Requirements</Text>
      <Text> </Text>

      {(() => {
        const itemsWithIssues = cartItems.filter(item => {
        const rules = quantityRules[item.productId]
          if (!rules) return false
          
          const { minQuantity, maxQuantity, increment } = rules
          const quantity = item.quantity
          
          // Check if quantity meets minimum requirement
          if (quantity < minQuantity) return true
          
          // Check if quantity exceeds maximum requirement
          if (maxQuantity && quantity > maxQuantity) return true
          
          // Check if quantity follows increment rule
          if (increment && (quantity - minQuantity) % increment !== 0) return true
          
          return false
        })
        
        if (itemsWithIssues.length === 0) {
        return (
            <>
            <Text> </Text>
            <Text>All items meet quantity requirements!</Text>
            <Text> </Text>
            </>
          )
        }
        
        return (
          <>
            <Text> </Text>
            <Text>{itemsWithIssues.length === 1 ? '1 Item Below Minimum Quantity' : `${itemsWithIssues.length} Items Below Minimum Quantity`}</Text>
            <Text> </Text>
            
            {itemsWithIssues.map((item, index) => {
          const rules = quantityRules[item.productId]
          const contextualPricing = b2bPricing[item.productId]
          const b2bPrice = contextualPricing?.price
          const itemSubtotal = b2bPrice ? item.quantity * b2bPrice : item.quantity * item.price
          const serialNumber = index + 1
          
          return (
            <ScrollView key={item.id}>
              <Text>{serialNumber}. {item.name}</Text>
              <Text> </Text>
              
              {productImages[item.productId] && (
                <Image src={productImages[item.productId]} />
              )}
              <Text> </Text>
              
              <Text>
                B2B Price: {b2bPrice ? formatCurrencyWithShop(b2bPrice) : 'N/A'} | 
                Min: {rules?.minQuantity || 1} | 
                Max: {rules?.maxQuantity || 'No limit'}
          </Text>
              
              <Text>
                Current Qty: {item.quantity} | 
                Total Price: {formatCurrencyWithShop(itemSubtotal)}
              </Text>
              <Text> </Text>
              
              <Button
                title="Adjust Quantity"
                onPress={() => {
                  setSelectedProduct(item)
                  setProductDetailSource('quantity')
                  setCurrentScreen('product-detail')
                }}
              />
              <Text> </Text>
              
              {index < itemsWithIssues.length - 1 && (
                <Text> </Text>
              )}
            </ScrollView>
          )
        })}
          </>
        )
      })()}

      <Text> </Text>
      <Button
        title="Continue"
        onPress={goToNextScreen}
        isDisabled={!quantityValidation.isValid}
      />
      <Text> </Text>
      
      <Button title="Back" onPress={goToPreviousScreen} />
      <Text> </Text>
    </>
  )

  const renderProductDetailScreen = () => {
    if (!selectedProduct) return null
    
    const rules = quantityRules[selectedProduct.productId]
    const contextualPricing = b2bPricing[selectedProduct.productId]
    const b2bPrice = contextualPricing?.price
    
    // Calculate dynamic price based on quantity and price breaks
    const calculateDynamicPrice = (quantity: number) => {
      if (!rules?.priceBreaks || rules.priceBreaks.length === 0) {
        return b2bPrice || selectedProduct.price
      }
      
      // Sort price breaks by minimum quantity (ascending)
      const sortedBreaks = [...rules.priceBreaks].sort((a, b) => a.minimumQuantity - b.minimumQuantity)
      
      // Find the appropriate price break for the current quantity
      let applicableBreak = sortedBreaks[0] // Default to first break
      for (const priceBreak of sortedBreaks) {
        if (quantity >= priceBreak.minimumQuantity) {
          applicableBreak = priceBreak
        } else {
          break
        }
      }
      
      return parseFloat(applicableBreak.price.amount)
    }
    
    const dynamicPrice = calculateDynamicPrice(selectedProduct.quantity)
    const displayPrice = dynamicPrice
    
    return (
      <>
        <Button
          title="← Back"
          type="basic"
          onPress={() => {
            if (productDetailSource === 'cart') {
              setCurrentScreen('cart')
            } else {
              setCurrentScreen('quantity')
            }
          }}
        />
        <Text> </Text>
        
        <Text variant="headingLarge">{selectedProduct.name}</Text>
        <Text> </Text>
        
        {productImages[selectedProduct.productId] && (
          <Image src={productImages[selectedProduct.productId]} />
        )}
        <Text> </Text>
        
        <Text> </Text>
        
        <Text variant="headingLarge">B2B Pricing</Text>
        <Text>B2B Price: {b2bPrice ? formatCurrencyWithShop(b2bPrice) : 'N/A'}</Text>
        <Text>Min Quantity: {rules?.minQuantity || 1}</Text>
        <Text>Max Quantity: {rules?.maxQuantity || 'No limit'}</Text>
        <Text>Increment: {rules?.increment || 1}</Text>
        <Text> </Text>
        
        {rules?.priceBreaks && rules.priceBreaks.length > 0 && (
          <>
            <Text variant="headingLarge">Price Breaks</Text>
            {rules.priceBreaks
              .sort((a: any, b: any) => a.minimumQuantity - b.minimumQuantity)
              .map((priceBreak: any, index: number) => (
                <Text key={index}>
                  {priceBreak.minimumQuantity}+ units: {formatCurrencyWithShop(parseFloat(priceBreak.price.amount))}
                </Text>
              ))}
            <Text> </Text>
          </>
        )}
        
        <Text variant="headingLarge">Quantity Controls</Text>
        <Text>Current Quantity: {selectedProduct.quantity}</Text>
        <Text> </Text>
        
        <Button
          title="−"
          onPress={() => {
            const newQty = Math.max(selectedProduct.quantity - (rules?.increment || 1), rules?.minQuantity || 1)
            updateItemQuantity(selectedProduct.id, newQty)
            const updatedProduct = {...selectedProduct, quantity: newQty}
            setSelectedProduct(updatedProduct)
          }}
        />
        <Text> </Text>
        
        <Button
          title={`${selectedProduct.quantity}`}
          type="primary"
          onPress={() => {
            console.log('Quantity button pressed:', selectedProduct.quantity)
          }}
        />
        <Text> </Text>
        
        <Button
          title="+"
          onPress={() => {
            const increment = rules?.increment || 1
            const maxQty = rules?.maxQuantity
            const newQty = selectedProduct.quantity + increment
            if (!maxQty || newQty <= maxQty) {
              updateItemQuantity(selectedProduct.id, newQty)
              const updatedProduct = {...selectedProduct, quantity: newQty}
              setSelectedProduct(updatedProduct)
            }
          }}
          isDisabled={rules?.maxQuantity ? selectedProduct.quantity >= rules.maxQuantity : false}
        />
        <Text> </Text>
        
        <Text variant="headingLarge">Subtotal: {formatCurrencyWithShop(displayPrice * selectedProduct.quantity)}</Text>
        <Text> </Text>
        
        <Button
          title="Update Cart"
          onPress={() => {
            if (productDetailSource === 'cart') {
              setCurrentScreen('cart')
            } else {
              setCurrentScreen('quantity')
            }
          }}
        />
        <Text> </Text>
        
        <Button
          title="Remove from Cart"
          onPress={() => {
            // Remove item from cart
            const updatedCartItems = cartItems.filter(item => item.id !== selectedProduct.id)
            setCartItems(updatedCartItems)
            
            // Update cart in Shopify
            if (apiData?.cart?.updateCart) {
              const lineItems = updatedCartItems.map(item => ({
                id: item.variantId,
                quantity: item.quantity
              }))
              
              apiData.cart.updateCart({
                lineItems: lineItems
              }).then(() => {
                console.log('Item removed from cart successfully')
              }).catch((error: any) => {
                console.error('Error removing item from cart:', error)
              })
            }
            
            // Navigate back to the source page
            if (productDetailSource === 'cart') {
              setCurrentScreen('cart')
            } else {
              setCurrentScreen('quantity')
            }
          }}
        />
        <Text> </Text>
        
      </>
    )
  }

  const renderDeliveryScreen = () => (
    <>
      <Button
          title="← Return to Transaction Review"
        type="basic"
        onPress={() => setCurrentScreen(quantityValidation.isValid ? 'cart' : 'quantity')}
      />
      <Text> </Text>
      
      <Text variant="headingLarge">Fulfillment & Transaction Details</Text>
      <Text>Configure delivery method and transaction documentation</Text>
      <Text> </Text>
      
      <TextField
        label="Purchase Order Reference *"
        value={poNumber}
        onChange={setPoNumber}
        placeholder="Enter PO reference number..."
        error={!poNumber ? "Purchase Order reference is required" : undefined}
      />
      <Text> </Text>

      <Text variant="headingLarge">Fulfillment Method:</Text>
      <Text> </Text>
      
      <ScrollView>
      <Button 
          title={`Company Pickup - Complimentary${deliveryMethod === 'pickup' ? ' ✓' : ''}`}
          type={deliveryMethod === 'pickup' ? 'primary' : 'basic'}
          onPress={() => setDeliveryMethod('pickup')} 
      />
      <Text> </Text>
        
      <Button 
          title="Custom Fulfillment Method"
          type={deliveryMethod !== 'pickup' ? 'primary' : 'basic'}
          onPress={() => setDeliveryMethod('custom')} 
      />
      <Text> </Text>
      </ScrollView>

      {deliveryMethod !== 'pickup' && (
      <>
        <TextField
            label="Fulfillment Method Name"
            value={customDeliveryName}
            onChange={setCustomDeliveryName}
            placeholder="e.g., Express Delivery, White Glove Service..."
          />
        <Text> </Text>

        <TextField
            label="Fulfillment Fee Amount"
            value={customDeliveryFee}
            onChange={setCustomDeliveryFee}
            placeholder="Enter fulfillment fee amount..."
          />
        <Text> </Text>
      </>
      )}

      <Text variant="headingLarge">Additional Service Charges</Text>
      <Text> </Text>
      
      <TextField
        label="Custom Service Charge"
        value={customSurcharge}
        onChange={setCustomSurcharge}
        placeholder="Enter additional service fee amount..."
      />
      <Text> </Text>
      
      <TextField
        label="Service Description (Optional)"
        value={surchargeDescription}
        onChange={setSurchargeDescription}
        placeholder="e.g., Rush processing fee, Special handling service..."
      />
      <Text> </Text>

      <Text variant="headingLarge">Transaction Summary</Text>
      <Text>Total Units: {cartItems.reduce((total, item) => total + item.quantity, 0)}</Text>
      <Text>Subtotal: {formatCurrencyWithShop(orderSummary.subtotal)}</Text>
      
      {deliveryMethod === 'pickup' ? (
        <Text>Fulfillment Method: Company Pickup - Complimentary</Text>
      ) : (
        <Text>Fulfillment Method: {customDeliveryName || 'Custom Fulfillment'}</Text>
      )}
      
      {deliveryFee > 0 && (
        <Text>{customDeliveryName || 'Custom Fulfillment'}: {formatCurrencyWithShop(deliveryFee)}</Text>
      )}
      
      {surchargeAmount > 0 && (
        <>
          <Text>Service Charge: {formatCurrencyWithShop(surchargeAmount)}</Text>
          {surchargeDescription && (
            <Text>({surchargeDescription})</Text>
          )}
        </>
      )}
      
      {totalFees > 0 && (
        <Text>Total Service Fees: {formatCurrencyWithShop(totalFees)}</Text>
      )}
      
      <Text>Tax: $0.00</Text>
      
      <Text variant="headingLarge">Transaction Total: {formatCurrencyWithShop(orderSummary.finalTotal)}</Text>
      <Text>Payment Terms: {selectedPaymentTerms ? formatNetTerms(selectedPaymentTerms) : 'Standard Terms'}</Text>
      <Text> </Text>

      {validationErrors.length > 0 && (
        <>
          <Text> </Text>
          {validationErrors.map((error, index) => (
            <Text variant="headingLarge">{error}</Text>
          ))}
          <Text> </Text>
        </>
      )}

      <Text> </Text>
      <Button
        title="Process Transaction"
        onPress={createB2BOrder}
        isDisabled={cartItems.length === 0 || !quantityValidation.isValid || !poNumber || poNumber.trim() === ''}
      />
      <Text> </Text>
      
      <Button title="Back" onPress={goToPreviousScreen} />
      <Text> </Text>
    </>
  )

  const renderConfirmationScreen = () => (
    <>
      <Button
          title="← Return to Fulfillment Details"
        type="basic"
        onPress={() => setCurrentScreen('delivery')}
      />
      <Text> </Text>
      
      <Text variant="headingLarge">Transaction Processed Successfully</Text>
      <Text>Your wholesale transaction has been created and is ready for fulfillment</Text>
      <Text> </Text>
      
      {createdOrder && (
        <>
          <Text variant="headingLarge">Transaction Details</Text>
          <Text>Transaction ID: {createdOrder.shopifyOrderName || orderNumber}</Text>
          <Text>Reference Number: {orderNumber}</Text>
          <Text>Client: {createdOrder.customer?.name}</Text>
          <Text>Company Entity: {companyName || 'N/A'}</Text>
          <Text>Purchase Order Reference: {createdOrder.poNumber || poNumber}</Text>
          <Text> </Text>
          
          <Text variant="headingLarge">Financial Summary</Text>
          <Text>Total Units: {cartItems.reduce((total, item) => total + item.quantity, 0)}</Text>
          <Text>Subtotal: {formatCurrencyWithShop(orderSummary.subtotal)}</Text>
          
          {deliveryMethod === 'pickup' ? (
            <Text>Fulfillment Method: Company Pickup - Complimentary</Text>
          ) : (
            <Text>Fulfillment Method: {customDeliveryName || 'Custom Fulfillment'}</Text>
          )}
          
          <Text>Tax: $0.00</Text>
          
          <Text>Fulfillment Fee: {formatCurrencyWithShop(createdOrder.deliveryFee ?? 0)}</Text>
          
          {createdOrder.surcharge && createdOrder.surcharge > 0 && (
            <>
              <Text>Service Charge: {formatCurrencyWithShop(createdOrder.surcharge)}</Text>
              {createdOrder.surchargeDescription && (
                <Text>({createdOrder.surchargeDescription})</Text>
              )}
            </>
          )}
          
          <Text variant="headingLarge">Transaction Total: {formatCurrencyWithShop(createdOrder.total)}</Text>
          <Text>Payment Terms: {selectedPaymentTerms ? formatNetTerms(selectedPaymentTerms) : 'Standard Terms'}</Text>
          {selectedPaymentTerms && (
            <Text>Payment Type: {selectedPaymentTerms.paymentTermsType}</Text>
          )}
          <Text> </Text>
          
          {createdOrder.shopifyOrderName && (
            <>
              <Text variant="headingLarge">Next Steps</Text>
              <Text>• Transaction appears in your Orders management system</Text>
              <Text>• Invoice will be automatically generated and sent to client</Text>
              <Text>• Fulfillment team will be notified for processing</Text>
              <Text> </Text>
            </>
          )}
        </>
      )}

      <Text> </Text>
      <Button
        title="Create New Transaction"
        onPress={resetOrder}
      />
      <Text> </Text>
    </>
  )



  return (
    <Navigator>
      <Screen name="B2BWholesale" title="Transaction Management">
        <ScrollView>
         
          
          {(() => {
            switch (currentScreen) {
              case 'customer': return renderCustomerScreen()
              case 'location': return renderLocationScreen()
              case 'cart': return renderCartScreen()
              case 'quantity': return renderQuantityScreen()
              case 'product-detail': return renderProductDetailScreen()
                case 'delivery': return renderDeliveryScreen()
                case 'confirmation': return renderConfirmationScreen()
                default: return renderCustomerScreen()
            }
          })()}
        </ScrollView>
      </Screen>
    </Navigator>
  )
}

export default reactExtension('pos.home.modal.render', () => <Modal />)
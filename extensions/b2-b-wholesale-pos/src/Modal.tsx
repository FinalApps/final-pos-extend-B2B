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
  Image
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

const useCompanyData = () => {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [priceListInfo, setPriceListInfo] = useState<{id: string, name: string, currency: string} | null>(null)
  const [locationCatalogInfo, setLocationCatalogInfo] = useState<{id: string, title: string, status: string, locationId?: string, companyName?: string, companyId?: string} | null>(null)
  const [availableCompanies, setAvailableCompanies] = useState<{id: string, name: string}[]>([])
  const [companiesLoading, setCompaniesLoading] = useState(false)
  const [companyAddresses, setCompanyAddresses] = useState<{[companyId: string]: {shippingAddress?: {address1: string, city: string, country: string, zip: string}, billingAddress?: {address1: string, city: string, country: string, zip: string}, locationName?: string}}>({})

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
      setCompaniesLoading(true)
      
      const query = `
        query GetCustomerCompanies($customerName: String!) {
          customers(first: 250, query: $customerName) {
                  edges {
                    node {
                      id
                displayName
                companyContactProfiles {
                  company {
                id
                name
                    locations(first: 1) {
              edges {
                node {
                  id
                  name
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

      if (!response.ok) {
        console.error('Failed to fetch customer companies:', response.status)
        return []
      }

      const result = await response.json()
      
      if (result.errors) {
        console.error('GraphQL errors in customer companies query:', result.errors)
        return []
      }

      const customers = result.data?.customers?.edges?.map((edge: any) => edge.node) || []
      
      if (customers.length === 0) {
        return []
      }

      // Find the exact customer match
      const exactCustomer = customers.find((customer: any) => 
        customer.displayName.toLowerCase() === customerName.toLowerCase()
      ) || customers[0]

      // Extract companies from customer's company contact profiles
      const companies = exactCustomer.companyContactProfiles?.map((profile: any) => ({
        id: profile.company.id,
        name: profile.company.name,
        hasLocation: profile.company.locations?.edges?.length > 0
      })).filter((company: any) => company.hasLocation) || []
      
      setAvailableCompanies(companies)
      return companies
    } catch (error) {
      console.error('Error fetching customer companies:', error)
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

              return {
    companyId,
    companyName,
    priceListInfo,
    locationCatalogInfo,
    availableCompanies,
    companiesLoading,
    companyAddresses,
    fetchCustomerCompany,
    fetchCatalogData,
    fetchCompanyLocationId,
    fetchCustomerCompanies,
    fetchAllCompanies,
    fetchProductVariants,
    fetchContextualPricing,
    fetchCompanyAddresses
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
  const { companyId, companyName, priceListInfo, locationCatalogInfo, availableCompanies, companiesLoading, companyAddresses, fetchCustomerCompany, fetchCatalogData, fetchCompanyLocationId, fetchCustomerCompanies, fetchAllCompanies, fetchProductVariants, fetchContextualPricing, fetchCompanyAddresses } = useCompanyData()
  const { cartItems, isLoading: cartLoading, loadCartItems, updateItemQuantity, setCartItems } = useCart(apiData, fetchCartDetails)

  // State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [selectedLocation, setSelectedLocation] = useState<any>(null)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [poNumber, setPoNumber] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('pickup')
  
  const [economyFee, setEconomyFee] = useState('15.00')
  const [standardFee, setStandardFee] = useState('25.00')
  const [quantityRules, setQuantityRules] = useState<Record<string, QuantityRules>>({})
  const [b2bPricing, setB2bPricing] = useState<Record<string, any>>({})
  const [productImages, setProductImages] = useState<Record<string, string>>({})
  const [paymentTerms, setPaymentTerms] = useState<any>(null)
  const [paymentTermsTemplates, setPaymentTermsTemplates] = useState<any[]>([])
  const [selectedPaymentTerms, setSelectedPaymentTerms] = useState<any>(null)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [productDetailSource, setProductDetailSource] = useState<'cart' | 'quantity'>('cart')
  const [productDescription, setProductDescription] = useState<string>('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [orderNumber] = useState(generateOrderNumber())
  const [createdOrder, setCreatedOrder] = useState<B2BOrder | null>(null)
  const [taxData, setTaxData] = useState<{rate: number, amount: number, title: string} | null>(null)

  // Fetch tax data for the selected location
  const fetchTaxData = useCallback(async (locationId: string) => {
    try {
      console.log(`Fetching tax data for location: ${locationId}`)
      
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
      console.log(`Tax data response for location ${locationId}:`, result)

      if (result.data?.location) {
        const location = result.data.location
        console.log('Location tax settings:', location.taxSettings)
        
        // For now, we'll use a default tax rate based on location
        // In a real implementation, you'd calculate this based on the location's tax settings
        let taxRate = 0
        let taxTitle = 'Tax'
        
        if (location.address?.country === 'US') {
          // Example US tax rates by state
          switch (location.address?.province) {
            case 'CA':
              taxRate = 0.0875 // 8.75% California
              taxTitle = 'CA Sales Tax'
              break
            case 'NY':
              taxRate = 0.08 // 8% New York
              taxTitle = 'NY Sales Tax'
              break
            case 'TX':
              taxRate = 0.0625 // 6.25% Texas
              taxTitle = 'TX Sales Tax'
              break
            default:
              taxRate = 0.07 // 7% default US
              taxTitle = 'Sales Tax'
          }
        } else if (location.address?.country === 'CA') {
          // Example Canadian tax rates by province
          switch (location.address?.province) {
            case 'BC':
              taxRate = 0.12 // 12% BC (5% GST + 7% PST)
              taxTitle = 'BC HST'
              break
            case 'ON':
              taxRate = 0.13 // 13% Ontario HST
              taxTitle = 'ON HST'
              break
            case 'AB':
              taxRate = 0.05 // 5% Alberta GST
              taxTitle = 'AB GST'
              break
            default:
              taxRate = 0.10 // 10% default Canada
              taxTitle = 'GST/HST'
          }
        }
        
        const taxData = {
          rate: taxRate,
          amount: 0, // Will be calculated when order total is known
          title: taxTitle
        }
        
        setTaxData(taxData)
        console.log('Tax data set:', taxData)
        return taxData
      }
      
      return null
    } catch (error) {
      console.error(`Error fetching tax data for location ${locationId}:`, error)
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



  // Fetch product description
  const fetchProductDescription = useCallback(async (productId: string) => {
    try {
      console.log(`Fetching product description for: ${productId}`)
      
      // Convert productId to proper GID format if needed
      let productGid = productId
      if (!productGid.startsWith('gid://shopify/Product/')) {
        productGid = `gid://shopify/Product/${productId}`
      }
      
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query GetProductDescription($productId: ID!) {
              product(id: $productId) {
                id
                title
                description
              }
            }
          `,
          variables: { productId: productGid }
        })
      })

      const result = await response.json()
      console.log(`Product description response for ${productGid}:`, result)

      if (result.data?.product?.description) {
        setProductDescription(result.data.product.description)
        return result.data.product.description
      }
      
      setProductDescription('')
      return ''
    } catch (error) {
      console.error(`Error fetching product description for ${productId}:`, error)
      setProductDescription('')
      return ''
    }
  }, [])

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
  const orderTotal = useMemo(() => 
    cartItems.reduce((sum, item) => {
      const contextualPricing = b2bPricing[item.productId]
      const b2bPrice = contextualPricing?.price
      const itemPrice = b2bPrice || item.price
      return sum + (item.quantity * itemPrice)
    }, 0)
  , [cartItems, b2bPricing])

  const deliveryFee = useMemo(() => {
    let fee = 0
    switch (deliveryMethod) {
      case 'pickup': 
        fee = 0
        break
      case 'economy': 
        fee = parseFloat(economyFee) || 0
        break
      case 'standard': 
        fee = parseFloat(standardFee) || 0
        break
      default: 
        fee = 0
    }
    return fee
  }, [deliveryMethod, economyFee, standardFee])

  const taxAmount = useMemo(() => 
    taxData ? orderTotal * taxData.rate : 0
  , [orderTotal, taxData])

  const finalTotal = useMemo(() => 
    orderTotal + deliveryFee + taxAmount
  , [orderTotal, deliveryFee, taxAmount])

  const volumeDiscount = useMemo(() => 
    calculateVolumeDiscount(orderTotal, selectedCustomer?.tier || 'standard')
  , [orderTotal, selectedCustomer?.tier])

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
  }, [fetchLocations, loadCartItems, fetchPaymentTermsTemplates])

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

  // Auto-load companies when location screen is shown
  useEffect(() => {
    if (currentScreen === 'location' && availableCompanies.length === 0 && !companiesLoading && selectedCustomer) {
      fetchCustomerCompanies(selectedCustomer.name)
    }
  }, [currentScreen, availableCompanies.length, companiesLoading, selectedCustomer, fetchCustomerCompanies])

  // Fetch product description when product detail screen is shown
  useEffect(() => {
    if (currentScreen === 'product-detail' && selectedProduct?.productId) {
      fetchProductDescription(selectedProduct.productId)
    }
  }, [currentScreen, selectedProduct?.productId, fetchProductDescription])

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
    setSelectedCustomer(customer)
    setSelectedCustomerId(customer.id)
    
    try {
      // First fetch the customer's company
      const company = await fetchCustomerCompany(customer.name)
      
      if (company) {
        // Fetch the company's location ID
        const locationCatalog = await fetchCompanyLocationId(company)
        
        if (locationCatalog) {
          // Fetch B2B contextual pricing using the company location
          const { pricing, rules } = await fetchB2BPricingForCart(locationCatalog)
          setB2bPricing(pricing)
          setQuantityRules(rules)
          
          // Reload cart items with new pricing
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
        // Use regular pricing without B2B discounts
        const items = await loadCartItems({})
        if (items && items.length > 0) {
          await fetchProductImages(items)
        }
      }
    } catch (error) {
      console.error('Error handling customer selection:', error)
    }
  }, [cartItems, fetchCustomerCompany, fetchCatalogData, loadCartItems, fetchCompanyLocationId, fetchB2BPricingForCart])

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

      // Prepare line items for the draft order
      const lineItems = cartItems.map(item => {
        const contextualPricing = b2bPricing[item.productId]
        const b2bPrice = contextualPricing?.price || item.price
        
        return {
          title: item.name,
          originalUnitPrice: b2bPrice.toString(),
          quantity: item.quantity,
          customAttributes: [
            { key: "SKU", value: item.sku || "N/A" },
            { key: "Product ID", value: item.productId },
            { key: "Variant ID", value: item.variantId }
          ]
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
            { key: "Method", value: deliveryMethod }
          ]
        })
      }

      // Add tax as a line item if applicable
      if (taxData && taxAmount > 0) {
        lineItems.push({
          title: taxData.title,
          originalUnitPrice: taxAmount.toString(),
          quantity: 1,
          customAttributes: [
            { key: "Type", value: "Tax" },
            { key: "Rate", value: `${Math.round(taxData.rate * 100)}%` },
            { key: "Location", value: selectedLocation?.name || 'Unknown' }
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

      const input: any = {
        note: `B2B Wholesale Order - ${orderNumber}${poNumber ? ` | PO: ${poNumber}` : ''}`,
        email: selectedCustomer.email || undefined,
        tags: ['B2B', 'Wholesale', 'POS-Extension'],
        lineItems: lineItems,
        // Note: Payment terms will be set after draft order creation
        // We cannot use PaymentTermTemplate IDs directly in draft orders
        customAttributes: [
          { key: "Order Number", value: orderNumber },
          { key: "Company", value: selectedLocation.companyName || 'N/A' },
          { key: "Location", value: selectedLocation.name },
          { key: "Created By", value: "B2B POS Extension" }
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
            value: selectedLocation.name
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


      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: draftOrderMutation,
          variables: { input }
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (result.errors) {
        console.error('GraphQL errors:', result.errors)
        throw new Error('GraphQL errors occurred')
      }

      if (result.data?.draftOrderCreate?.userErrors?.length > 0) {
        console.error('Draft order creation errors:', result.data.draftOrderCreate.userErrors)
        throw new Error(result.data.draftOrderCreate.userErrors[0].message)
      }

      const draftOrder = result.data?.draftOrderCreate?.draftOrder
      if (!draftOrder) {
        throw new Error('Failed to create draft order')
      }

      // Create local order data for confirmation screen
      const orderData: B2BOrder = {
        customerId: selectedCustomer.id,
        customer: selectedCustomer,
        poNumber: poNumber || undefined,
        tags: ['B2B', 'Wholesale'],
        items: cartItems,
        subtotal: orderTotal,
        deliveryFee: deliveryFee,
        volumeDiscount: 0, // No volume discount as requested
        tax: taxAmount,
        total: finalTotal, // This should match the delivery options total
        isDraft: true,
        status: 'draft',
        shopifyDraftOrderId: draftOrder.id,
        shopifyOrderName: draftOrder.name,
        invoiceUrl: draftOrder.invoiceUrl
      }

      logOrderOperation('create_b2b_draft_order', orderNumber, {
        customerId: selectedCustomer.id,
        itemCount: cartItems.length,
        total: orderData.total,
        location: selectedLocation.name,
        shopifyDraftOrderId: draftOrder.id,
        shopifyOrderName: draftOrder.name
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
        }
      }
      
      setCurrentScreen('confirmation')
        } catch (error) {
      console.error('Error creating B2B draft order:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setValidationErrors([`❌ Failed to create order: ${errorMessage}. Please try again or contact support.`])
    }
  }, [selectedCustomer, selectedLocation, poNumber, quantityValidation, cartItems, orderTotal, b2bPricing, orderNumber, deliveryFee, deliveryMethod, finalTotal])

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
      <Text variant="headingLarge">Select Your Customer</Text>
      <Text>Choose the customer for this B2B wholesale order</Text>
      <Text> </Text>
      
      {customersLoading ? (
        <>
          <Text>Loading customers...</Text>
          <Text>Please wait while we fetch your customer list</Text>
        </>
      ) : customers.length > 0 ? (
        <ScrollView>
          {customers.map(customer => (
            <>
            <Button
                key={customer.id}
                title={`${customer.name}${customer.email ? `\nEmail: ${customer.email}` : ''}${customer.hasPosOrders ? '\nPrevious POS Orders' : ''}`}
              onPress={() => {
                  handleCustomerSelection(customer)
                }}
                type={selectedCustomerId === customer.id ? 'primary' : 'basic'}
              />
              <Text> </Text>
            </>
          ))}
        </ScrollView>
      ) : (
        <>
          <Text>No customers found</Text>
          <Text>Please ensure customers are available in your store</Text>
        </>
      )}
      
      {selectedCustomer && (
        <>
          <Text>Selected: {selectedCustomer.name}</Text>
          <Button title="Continue to Company Selection" onPress={goToNextScreen} />
        </>
        )}
    </>
  )

  const renderLocationScreen = () => (
    <>
      <Text variant="headingLarge">Select Company Location</Text>
      <Text>Choose the company location for B2B pricing and fulfillment</Text>
      <Text> </Text>
      
      {availableCompanies.length > 0 ? (
        <ScrollView>
          {availableCompanies.map((company, index) => (
            <>
              <Button
                key={company.id}
                title={company.name}
                type={selectedCompany === company.id ? 'primary' : 'basic'}
                onPress={async () => {
                  setSelectedCompany(company.id)
                  try {
                    const catalogInfo = await fetchCompanyLocationId(company.name)
                    
                    if (catalogInfo) {
                      const newLocation = {
                        id: catalogInfo.locationId,
                        name: `${company.name} - ${catalogInfo.companyName}`,
                        companyName: catalogInfo.companyName,
                        companyId: catalogInfo.companyId
                      }
                      
                      setSelectedLocation(newLocation)
                      
                      // Fetch company addresses
                      await fetchCompanyAddresses(catalogInfo.companyId, company.name)
                      
                      // Fetch tax data for the selected location
                      await fetchTaxData(catalogInfo.locationId)
                      
                      // Fetch B2B contextual pricing for the selected company
                      const { pricing, rules } = await fetchB2BPricingForCart(catalogInfo)
                      setB2bPricing(pricing)
                      setQuantityRules(rules)
                      
                      // Reload cart items with new pricing
                      const items = await loadCartItems(pricing)
                      if (items && items.length > 0) {
                        await fetchProductImages(items)
                      }
                    } else {
                      console.error(`Failed to fetch ${company.name} location`)
                    }
                  } catch (error) {
                    console.error(`Error selecting company ${company.name}:`, error)
                  }
                }}
              />
              <Text> </Text>
            </>
          ))}
        </ScrollView>
      ) : (
        <Text>
          {companiesLoading 
            ? "Loading companies..." 
            : selectedCustomer 
              ? `No companies found for customer: ${selectedCustomer.name}` 
              : "Please select a customer first"
          }
        </Text>
      )}

      {selectedCompany && (
        <>
          <Text>Company Selected</Text>
          <Text>B2B pricing and location data loaded</Text>
        </>
      )}

      <Button
        title="Continue to Cart Review"
        onPress={goToNextScreen}
        isDisabled={!selectedCompany || !selectedCustomer}
      />
      
      <Text> </Text>
      
      <Button title="Back to Customer Selection" onPress={goToPreviousScreen} />
    </>
  )

  const renderCartScreen = () => (
    <>
      {/* Back Arrow Label */}
      <Button
        title="← Back to Company Selection"
        type="basic"
        onPress={() => setCurrentScreen('location')}
      />
      <Text> </Text>
      
      {/* Header */}
      <Text variant="headingLarge">Cart Review & Verification</Text>
      <Text>Review your order details and verify B2B pricing</Text>
      <Text> </Text>
      
      {/* Company Information */}
      <Text variant="headingLarge">Order Information</Text>
      <Text>Customer: {selectedCustomer?.name || 'No customer selected'}</Text>
      <Text>Company: {companyName || 'No company selected'}</Text>
      <Text> </Text>
      
      {/* Billing Address Information */}
      <Text variant="headingLarge">Billing Address</Text>
      <Text>Company: {selectedLocation?.companyName || 'No company selected'}</Text>
      <Text>Address: {(() => {
        if (!selectedLocation?.companyId || !companyAddresses[selectedLocation.companyId]?.billingAddress) {
          return 'Address not available'
        }
        const billing = companyAddresses[selectedLocation.companyId].billingAddress!
        const addressParts = [
          billing.address1,
          billing.city,
          billing.country,
          billing.zip
        ].filter(part => part && part.trim())
        return addressParts.join(', ') || 'Address not available'
      })()}</Text>
      <Text> </Text>
      
      <Button
        title="Change Company Location"
        onPress={() => setCurrentScreen('location')}
      />
      <Text> </Text>

      {/* Cart Items */}
      <Text variant="headingLarge">Cart Items ({cartItems.reduce((total, item) => total + item.quantity, 0)} items)</Text>
      <Text> </Text>
      
      {cartItems.length > 0 ? (
        <>
          {cartItems.map((item, index) => {
            const rules = quantityRules[item.productId]
            const contextualPricing = b2bPricing[item.productId]
            const b2bPrice = contextualPricing?.price
            const itemSubtotal = b2bPrice ? item.quantity * b2bPrice : item.quantity * item.price
            const serialNumber = index + 1
            
            return (
              <ScrollView key={index}>
                <Text>{serialNumber}. {item.name}</Text>
                <Text> </Text>
                
                {/* Product Image */}
                {productImages[item.productId] && (
                  <Image
                    src={productImages[item.productId]}
                  />
                )}
                <Text> </Text>
                
                <Text>Qty: {item.quantity} | {b2bPrice ? `B2B: ${formatCurrency(b2bPrice)}` : `Price: ${formatCurrency(item.price)}`} | Total: {formatCurrency(itemSubtotal)}</Text>
                {rules && (
                  <Text>Min: {rules.minQuantity}{rules.maxQuantity ? ` | Max: ${rules.maxQuantity}` : ''}</Text>
                )}
                <Text> </Text>
                
                <Button
                  title="View Details & Adjust"
                  onPress={() => {
                    setSelectedProduct(item)
                    setProductDetailSource('cart')
                    setCurrentScreen('product-detail')
                  }}
                />
                <Text> </Text>
                
                {/* Separator between products (except for last item) */}
                {index < cartItems.length - 1 && (
                  <>
                    <Text>────────────────────────────────────────────────────────</Text>
                    <Text> </Text>
                  </>
                )}
              </ScrollView>
            )
          })}
          
          {/* Quantity Validation Warning */}
          {!quantityValidation.isValid && (
            <>
              <Text> </Text>
            <Text>{quantityValidation.errors.length} items below minimum quantities</Text>
              <Text>Please adjust quantities to meet B2B requirements</Text>
              <Text> </Text>
            </>
          )}
          
          {!quantityValidation.isValid && (
            <Button
              title="Fix Quantity Issues"
              onPress={() => setCurrentScreen('quantity')}
            />
          )}
        </>
      ) : (
        <>
        <Text>No items in cart</Text>
          <Text>Add products to create your B2B order</Text>
          <Text> </Text>
        </>
      )}

      <Text> </Text>

      <Button
        title="Proceed to Delivery Options"
        onPress={goToNextScreen}
        isDisabled={cartItems.length === 0 || !quantityValidation.isValid}
      />
      <Text> </Text>
      
      <Button title="Back to Company Selection" onPress={goToPreviousScreen} />
    </>
  )

  const renderQuantityScreen = () => (
    <>
      {/* Back Arrow Label */}
      <Button
        title="← Back to Cart Review"
        type="basic"
        onPress={() => setCurrentScreen('cart')}
      />
      <Text> </Text>
      
      {/* Header */}
      <Text variant="headingLarge">Quantity Requirements</Text>
      <Text>Adjust quantities to meet B2B wholesale requirements</Text>
      <Text> </Text>

      {/* Quantity Issues List - Only show items with validation errors */}
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
            <Text>All items meet quantity requirements!</Text>
              <Text>Your order is ready to proceed</Text>
              <Text> </Text>
            </>
          )
        }
        
        return (
          <>
            {/* Items Below Minimum Quantity Heading */}
            <Text>{itemsWithIssues.length === 1 ? '1 Item Below Minimum Quantity' : `${itemsWithIssues.length} Items Below Minimum Quantity`}</Text>
            <Text>Please adjust quantities to meet B2B requirements</Text>
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
              
              {/* Product Image */}
              {productImages[item.productId] && (
                <>
                <Image
                  src={productImages[item.productId]}
                />
                  <Text> </Text>
                </>
              )}
              
              <Text>
                B2B Price: {b2bPrice ? formatCurrency(b2bPrice) : 'N/A'} | 
                Min: {rules?.minQuantity || 1} | 
                Max: {rules?.maxQuantity || 'No limit'}
          </Text>
              
              <Text> </Text>
              
              <Text>
                Current Qty: {item.quantity} | 
                Total Price: {formatCurrency(itemSubtotal)}
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
            </ScrollView>
          )
        })}
          </>
        )
      })()}

      <Text> </Text>

      <Button
        title="Continue to Delivery Options"
        onPress={goToNextScreen}
        isDisabled={!quantityValidation.isValid}
      />
      
      <Text> </Text>
      
      <Button title="Back to Cart Review" onPress={goToPreviousScreen} />
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
        {/* Back Arrow Label */}
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
        
        {/* Product Information */}
        <Text variant="headingLarge">{selectedProduct.name}</Text>
        
        <Text> </Text>
        
        {/* Product Image */}
        {productImages[selectedProduct.productId] && (
          <Image
            src={productImages[selectedProduct.productId]}
          />
        )}
        
        <Text> </Text>
        
        {/* Product Description */}
        {productDescription && (
          <>
            <Text>{productDescription}</Text>
        <Text> </Text>
          </>
        )}
        
        {/* B2B Pricing Information */}
        <Text variant="headingLarge">B2B Pricing Information</Text>
        <Text> </Text>
        
        <Text>B2B Price: {b2bPrice ? formatCurrency(b2bPrice) : 'N/A'}</Text>
        <Text>Min Quantity: {rules?.minQuantity || 1}</Text>
        <Text>Max Quantity: {rules?.maxQuantity || 'No limit'}</Text>
        <Text>Increment: {rules?.increment || 1}</Text>
        
        <Text> </Text>
        <Text> </Text>
        
        {/* Price Breaks Section */}
        {rules?.priceBreaks && rules.priceBreaks.length > 0 && (
          <>
            <Text variant="headingLarge">Available Price Breaks</Text>
            <Text> </Text>
            {rules.priceBreaks
              .sort((a: any, b: any) => a.minimumQuantity - b.minimumQuantity)
              .map((priceBreak: any, index: number) => (
                <Text key={index}>
                  {priceBreak.minimumQuantity}+ units: {formatCurrency(parseFloat(priceBreak.price.amount))}
                </Text>
              ))}
            <Text> </Text>
            <Text> </Text>
          </>
        )}
        
        
        {/* Quantity Adjustment Controls */}
        <Text> </Text>
        
        {/* Quantity Controls - Horizontal Layout */}
        <Text> </Text>
        
        {/* Quantity Display and Controls in Horizontal Layout */}
        <Text>Current Quantity: {selectedProduct.quantity}</Text>
        <Text> </Text>
        
        {/* Decrease Button */}
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
        
        {/* Quantity Number Button */}
        <Button
          title={`${selectedProduct.quantity}`}
          type="primary"
          onPress={() => {
            // Quantity button - could be used for direct quantity input in the future
            console.log('Quantity button pressed:', selectedProduct.quantity)
          }}
        />
        
        <Text> </Text>
        
        {/* Increase Button */}
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
        
        {/* Subtotal Display */}
        <Text variant="headingLarge">Subtotal: {formatCurrency(displayPrice * selectedProduct.quantity)}</Text>
        <Text> </Text>
        
        {/* Primary Action Buttons */}
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
        <Text> </Text>
        
        {/* Secondary Action Buttons */}
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
        
      </>
    )
  }

  const renderDeliveryScreen = () => (
    <>
      {/* Back Arrow Label */}
      <Button
        title="← Back to Cart Review"
        type="basic"
        onPress={() => setCurrentScreen(quantityValidation.isValid ? 'cart' : 'quantity')}
      />
      <Text> </Text>
      
      <Text variant="headingLarge">Delivery & Order Details</Text>
      <Text>Complete your B2B wholesale order with delivery options</Text>
      <Text> </Text>
      
      <TextField
        label="Purchase Order Number *"
        value={poNumber}
        onChange={setPoNumber}
        placeholder="Enter your PO number..."
        error={!poNumber ? "PO Number is required for B2B orders" : undefined}
      />

      <Text>Select Delivery Method:</Text>
      
      <ScrollView>
      <Button 
          title={`Store Pickup - FREE${deliveryMethod === 'pickup' ? ' ✓' : ''}`}
          onPress={() => setDeliveryMethod('pickup')} 
      />
        
      <Button 
          title={`Economy Delivery - $${economyFee}${deliveryMethod === 'economy' ? ' ✓' : ''}`}
          onPress={() => setDeliveryMethod('economy')} 
      />
        
      <Button 
          title={`Standard Delivery - $${standardFee}${deliveryMethod === 'standard' ? ' ✓' : ''}`}
          onPress={() => setDeliveryMethod('standard')} 
      />
      </ScrollView>

      {deliveryMethod === 'economy' && (
      <TextField
          label="Economy Delivery Fee ($)"
          value={economyFee}
          onChange={setEconomyFee}
          placeholder="Enter economy delivery fee..."
        />
      )}

      {deliveryMethod === 'standard' && (
      <TextField
          label="Standard Delivery Fee ($)"
          value={standardFee}
          onChange={setStandardFee}
          placeholder="Enter standard delivery fee..."
        />
      )}

      <Text variant="headingLarge">Order Summary</Text>
      <Text>Total Items: {cartItems.reduce((total, item) => total + item.quantity, 0)}</Text>
      <Text>Subtotal: {formatCurrency(orderTotal)}</Text>
      <Text>{taxData?.title || 'Tax'} ({taxData ? Math.round(taxData.rate * 100) : 0}%): {formatCurrency(taxAmount)}</Text>
      <Text>Shipping: {formatCurrency(deliveryFee)}</Text>
      <Text variant="headingLarge">Total: {formatCurrency(finalTotal)}</Text>
      <Text>Net Terms: {selectedPaymentTerms ? formatNetTerms(selectedPaymentTerms) : 'N/A'}</Text>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <>
          <Text> </Text>
          {validationErrors.map((error, index) => (
            <Text key={index} variant="headingLarge">{error}</Text>
          ))}
          <Text> </Text>
        </>
      )}

      <Button
        title="Create B2B Order"
        onPress={createB2BOrder}
        isDisabled={cartItems.length === 0 || !quantityValidation.isValid || !poNumber || poNumber.trim() === ''}
      />
      
      <Button title="Back to Cart Review" onPress={goToPreviousScreen} />
    </>
  )

  const renderConfirmationScreen = () => (
    <>
      {/* Back Arrow Label */}
      <Button
        title="← Back to Delivery Options"
        type="basic"
        onPress={() => setCurrentScreen('delivery')}
      />
      <Text> </Text>
      
      <Text variant="headingLarge">Order Created Successfully!</Text>
      <Text>Your B2B wholesale order has been processed</Text>
      <Text> </Text>
      
      {createdOrder && (
        <>
          <Text variant="headingLarge">Order Details</Text>
          <Text>Order Name: {createdOrder.shopifyOrderName || orderNumber}</Text>
          <Text>Order #: {orderNumber}</Text>
          <Text>Customer: {createdOrder.customer?.name}</Text>
          <Text>Company: {companyName || 'N/A'}</Text>
          <Text>PO Number: {createdOrder.poNumber || poNumber}</Text>
          
          <Text> </Text>
          <Text variant="headingLarge">Order Summary</Text>
          <Text>Total Items: {cartItems.reduce((total, item) => total + item.quantity, 0)}</Text>
          <Text>Subtotal: {formatCurrency(createdOrder.subtotal)}</Text>
          <Text>{taxData?.title || 'Tax'} ({taxData ? Math.round(taxData.rate * 100) : 0}%): {formatCurrency(createdOrder.tax ?? 0)}</Text>
          <Text>Shipping: {formatCurrency(createdOrder.deliveryFee ?? 0)}</Text>
          <Text variant="headingLarge">Total: {formatCurrency(createdOrder.total)}</Text>
          <Text>Net Terms: {selectedPaymentTerms ? formatNetTerms(selectedPaymentTerms) : 'N/A'}</Text>
          {selectedPaymentTerms && (
            <Text>Payment Type: {selectedPaymentTerms.paymentTermsType}</Text>
          )}
          
          {createdOrder.shopifyOrderName && (
            <>
              <Text> </Text>
              <Text>Order appears in your Orders section</Text>
              <Text>Invoice will be sent to customer</Text>
            </>
          )}
        </>
      )}

      <Text> </Text>
      <Text> </Text>

      <Button
        title="Create Another Order"
        onPress={resetOrder}
      />
    </>
  )



  return (
    <Navigator>
      <Screen name="B2BWholesale" title="B2B Wholesale Orders">
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
import React, { useState, useEffect, useCallback } from 'react'
import { 
  Text, 
  Button,
  ScrollView
} from '@shopify/ui-extensions-react/point-of-sale'
import DataTable, { Column } from './DataTable'

// Types for our data tables
export interface ProductData {
  id: string
  title: string
  vendor: string
  productType: string
  status: string
  createdAt: string
  updatedAt: string
  totalInventory: number
  price: string
  compareAtPrice?: string
}

export interface OrderData {
  id: string
  name: string
  customer: string
  email: string
  financialStatus: string
  fulfillmentStatus: string
  totalPrice: string
  createdAt: string
  tags: string[]
  poNumber?: string
}

export interface CustomerData {
  id: string
  name: string
  email: string
  phone: string
  createdAt: string
  lastOrderDate?: string
  totalSpent: string
  orderCount: number
  company?: string
  tags: string[]
}

// Products Data Table Component
export const ProductsTable = ({ onProductSelect }: { onProductSelect?: (product: ProductData) => void }) => {
  const [products, setProducts] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(false)

  const fetchProducts = useCallback(async (first: number = 50, after?: string) => {
    setLoading(true)
    try {
      const query = `
        query GetProducts($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                title
                vendor
                productType
                status
                createdAt
                updatedAt
                totalInventory
                priceRangeV2 {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                  maxVariantPrice {
                    amount
                    currencyCode
                  }
                }
                compareAtPriceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                  maxVariantPrice {
                    amount
                    currencyCode
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
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { first, after }
        })
      })

      const result = await response.json()
      
      if (result?.data?.products?.edges) {
        const fetchedProducts: ProductData[] = result.data.products.edges.map((edge: any) => {
          const node = edge.node
          return {
            id: node.id.split('/').pop() || 'unknown',
            title: node.title,
            vendor: node.vendor || 'N/A',
            productType: node.productType || 'N/A',
            status: node.status,
            createdAt: new Date(node.createdAt).toLocaleDateString(),
            updatedAt: new Date(node.updatedAt).toLocaleDateString(),
            totalInventory: node.totalInventory || 0,
            price: `${node.priceRangeV2?.minVariantPrice?.amount || '0'} ${node.priceRangeV2?.minVariantPrice?.currencyCode || 'USD'}`,
            compareAtPrice: node.compareAtPriceRange?.minVariantPrice?.amount 
              ? `${node.compareAtPriceRange.minVariantPrice.amount} ${node.compareAtPriceRange.minVariantPrice.currencyCode}`
              : undefined
          }
        })
        setProducts(fetchedProducts)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const columns: Column<ProductData>[] = [
    {
      key: 'title',
      label: 'Product Name',
      sortable: true,
      render: (value, item) => (
        <Text>{String(value).substring(0, 30)}{String(value).length > 30 ? '...' : ''}</Text>
      )
    },
    {
      key: 'vendor',
      label: 'Vendor',
      sortable: true
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true
    },
    {
      key: 'totalInventory',
      label: 'Stock',
      sortable: true,
      render: (value) => (
        <Text>{value > 0 ? `${value} in stock` : 'Out of stock'}</Text>
      )
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <Text>{String(value).toUpperCase()}</Text>
      )
    }
  ]

  return (
    <>
      <Text variant="headingLarge">Products</Text>
      <Text> </Text>
      <DataTable
        data={products}
        columns={columns}
        searchable={true}
        searchFields={['title', 'vendor', 'productType']}
        pageSize={10}
        onRowClick={onProductSelect}
        emptyMessage="No products found"
        loading={loading}
      />
    </>
  )
}

// Orders Data Table Component
export const OrdersTable = ({ onOrderSelect }: { onOrderSelect?: (order: OrderData) => void }) => {
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(false)

  const fetchOrders = useCallback(async (first: number = 50, after?: string) => {
    setLoading(true)
    try {
      const query = `
        query GetOrders($first: Int!, $after: String) {
          orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                customer {
                  displayName
                  email
                }
                displayFinancialStatus
                displayFulfillmentStatus
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                createdAt
                tags
                customAttributes {
                  key
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { first, after }
        })
      })

      const result = await response.json()
      
      if (result?.data?.orders?.edges) {
        const fetchedOrders: OrderData[] = result.data.orders.edges.map((edge: any) => {
          const node = edge.node
          const poNumber = node.customAttributes?.find((attr: any) => attr.key === 'PO Number')?.value
          
          return {
            id: node.id.split('/').pop() || 'unknown',
            name: node.name,
            customer: node.customer?.displayName || 'Guest',
            email: node.customer?.email || 'N/A',
            financialStatus: node.displayFinancialStatus,
            fulfillmentStatus: node.displayFulfillmentStatus,
            totalPrice: `${node.totalPriceSet?.shopMoney?.amount || '0'} ${node.totalPriceSet?.shopMoney?.currencyCode || 'USD'}`,
            createdAt: new Date(node.createdAt).toLocaleDateString(),
            tags: node.tags || [],
            poNumber
          }
        })
        setOrders(fetchedOrders)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  const columns: Column<OrderData>[] = [
    {
      key: 'name',
      label: 'Order #',
      sortable: true
    },
    {
      key: 'customer',
      label: 'Customer',
      sortable: true
    },
    {
      key: 'totalPrice',
      label: 'Total',
      sortable: true
    },
    {
      key: 'financialStatus',
      label: 'Payment',
      sortable: true,
      render: (value) => (
        <Text>{String(value).toUpperCase()}</Text>
      )
    },
    {
      key: 'fulfillmentStatus',
      label: 'Fulfillment',
      sortable: true,
      render: (value) => (
        <Text>{String(value).toUpperCase()}</Text>
      )
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true
    }
  ]

  return (
    <>
      <Text variant="headingLarge">Orders</Text>
      <Text> </Text>
      <DataTable
        data={orders}
        columns={columns}
        searchable={true}
        searchFields={['name', 'customer', 'email']}
        pageSize={10}
        onRowClick={onOrderSelect}
        emptyMessage="No orders found"
        loading={loading}
      />
    </>
  )
}

// Customers Data Table Component
export const CustomersTable = ({ onCustomerSelect }: { onCustomerSelect?: (customer: CustomerData) => void }) => {
  const [customers, setCustomers] = useState<CustomerData[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCustomers = useCallback(async (first: number = 50, after?: string) => {
    setLoading(true)
    try {
      const query = `
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
                  createdAt
                }
                totalSpent
                ordersCount
                tags
                companyContactProfiles {
                  company {
                    name
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
      `

      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { first, after }
        })
      })

      const result = await response.json()
      
      if (result?.data?.customers?.edges) {
        const fetchedCustomers: CustomerData[] = result.data.customers.edges.map((edge: any) => {
          const node = edge.node
          const company = node.companyContactProfiles?.[0]?.company?.name
          
          return {
            id: node.id.split('/').pop() || 'unknown',
            name: `${node.firstName || ''} ${node.lastName || ''}`.trim() || 'Unknown Customer',
            email: node.email || 'N/A',
            phone: node.phone || 'N/A',
            createdAt: new Date(node.createdAt).toLocaleDateString(),
            lastOrderDate: node.lastOrder?.createdAt ? new Date(node.lastOrder.createdAt).toLocaleDateString() : undefined,
            totalSpent: `${node.totalSpent || '0'} USD`,
            orderCount: node.ordersCount || 0,
            company,
            tags: node.tags || []
          }
        })
        setCustomers(fetchedCustomers)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  const columns: Column<CustomerData>[] = [
    {
      key: 'name',
      label: 'Customer Name',
      sortable: true
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true
    },
    {
      key: 'company',
      label: 'Company',
      sortable: true,
      render: (value) => (
        <Text>{value || 'N/A'}</Text>
      )
    },
    {
      key: 'orderCount',
      label: 'Orders',
      sortable: true
    },
    {
      key: 'totalSpent',
      label: 'Total Spent',
      sortable: true
    },
    {
      key: 'lastOrderDate',
      label: 'Last Order',
      sortable: true,
      render: (value) => (
        <Text>{value || 'Never'}</Text>
      )
    }
  ]

  return (
    <>
      <Text variant="headingLarge">Customers</Text>
      <Text> </Text>
      <DataTable
        data={customers}
        columns={columns}
        searchable={true}
        searchFields={['name', 'email', 'company']}
        pageSize={10}
        onRowClick={onCustomerSelect}
        emptyMessage="No customers found"
        loading={loading}
      />
    </>
  )
}

export default { ProductsTable, OrdersTable, CustomersTable }

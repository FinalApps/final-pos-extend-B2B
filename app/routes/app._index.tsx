import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Box,
  List,
  Link,
  InlineStack,
  Badge,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
};


export default function Index() {
  return (
    <Page>
      <TitleBar title="B2B Wholesale POS Extension" />
      
      <BlockStack gap="800">
        {/* Hero Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="300">
                  <Text as="h1" variant="headingXl">
                    B2B Wholesale POS Extension
                  </Text>
                  <Text variant="bodyLg" as="p" tone="subdued">
                    Streamline your wholesale operations with advanced B2B order management, 
                    volume pricing, and corporate customer support directly in Shopify POS.
                  </Text>
                  <InlineStack gap="200">
                    <Badge tone="success">POS Extension</Badge>
                    <Badge tone="info">B2B Ready</Badge>
                    <Badge tone="attention">Volume Pricing</Badge>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Key Features Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Key Features
                </Text>
                <Layout>
                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="400">
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          🏢 Corporate Customer Management
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Seamlessly manage corporate customers with multiple locations, 
                          billing addresses, and contact profiles directly from POS.
                        </Text>
                      </BlockStack>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          💰 Dynamic Volume Pricing
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Implement tiered pricing with quantity breaks, minimum order 
                          quantities, and custom pricing rules for wholesale customers.
                        </Text>
                      </BlockStack>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          📦 Advanced Order Management
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Create draft orders, manage fulfillment, and track wholesale 
                          transactions with comprehensive order lifecycle support.
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="400">
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          🎯 Location-Based Pricing
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Configure different pricing strategies based on corporate 
                          locations with automatic tax calculation and shipping rules.
                        </Text>
                      </BlockStack>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          🔄 Real-Time Inventory Sync
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Keep inventory levels synchronized across all channels with 
                          real-time stock updates and availability checking.
                        </Text>
                      </BlockStack>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          📊 B2B Analytics & Reporting
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Track wholesale performance with detailed analytics, 
                          customer insights, and sales reporting capabilities.
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* How It Works Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  How It Works
                </Text>
                <Layout>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                        <Text as="h3" variant="headingMd" alignment="center">
                          1. Customer Selection
                        </Text>
                        <Text variant="bodyMd" as="p" alignment="center">
                          Select corporate customers from your B2B customer base 
                          with automatic company profile detection.
                        </Text>
                      </Box>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                        <Text as="h3" variant="headingMd" alignment="center">
                          2. Location Configuration
                        </Text>
                        <Text variant="bodyMd" as="p" alignment="center">
                          Choose corporate locations with specific billing addresses 
                          and pricing rules for accurate order processing.
                        </Text>
                      </Box>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                        <Text as="h3" variant="headingMd" alignment="center">
                          3. Order Processing
                        </Text>
                        <Text variant="bodyMd" as="p" alignment="center">
                          Process wholesale orders with volume pricing, tax calculation, 
                          and automatic fulfillment routing.
                        </Text>
                      </Box>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Configuration Options */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Configuration Options
                </Text>
                <Layout>
                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingMd">
                        Pricing Configuration
                      </Text>
                      <List>
                        <List.Item>Volume discount tiers</List.Item>
                        <List.Item>Minimum order quantities</List.Item>
                        <List.Item>Quantity increment rules</List.Item>
                        <List.Item>Location-specific pricing</List.Item>
                        <List.Item>Customer group pricing</List.Item>
                      </List>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingMd">
                        Order Management
                      </Text>
                      <List>
                        <List.Item>Draft order creation</List.Item>
                        <List.Item>Fulfillment automation</List.Item>
                        <List.Item>Tax calculation rules</List.Item>
                        <List.Item>Shipping method selection</List.Item>
                        <List.Item>Payment term management</List.Item>
                      </List>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Why Choose This App */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Why Choose B2B Wholesale POS?
                </Text>
                <Layout>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        🚀 Native POS Integration
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Built specifically for Shopify POS with seamless integration 
                        and native UI components for optimal user experience.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        ⚡ Real-Time Performance
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Lightning-fast order processing with real-time inventory 
                        updates and instant pricing calculations.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        🔒 Enterprise Security
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Secure customer data handling with enterprise-grade security 
                        and compliance with Shopify's data protection standards.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
                <Divider />
                <Layout>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        📈 Scalable Architecture
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Designed to handle high-volume wholesale operations with 
                        scalable infrastructure and performance optimization.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        🛠️ Easy Setup & Maintenance
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Simple configuration with minimal setup required and 
                        comprehensive documentation for easy maintenance.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        💬 Dedicated Support
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Professional support team with expertise in B2B operations 
                        and Shopify POS integration.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Technical Specifications & Getting Started */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Technical Specifications
                </Text>
                <Layout>
                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                          Framework
                        </Text>
                        <Link
                          url="https://remix.run"
                          target="_blank"
                          removeUnderline
                        >
                          Remix
                        </Link>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                          Database
                        </Text>
                        <Link
                          url="https://www.prisma.io/"
                          target="_blank"
                          removeUnderline
                        >
                          Prisma
                        </Link>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                          UI Framework
                        </Text>
                        <span>
                          <Link
                            url="https://polaris.shopify.com"
                            target="_blank"
                            removeUnderline
                          >
                            Polaris
                          </Link>
                          {", "}
                          <Link
                            url="https://shopify.dev/docs/apps/tools/app-bridge"
                            target="_blank"
                            removeUnderline
                          >
                            App Bridge
                          </Link>
                        </span>
                      </InlineStack>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                          API Integration
                        </Text>
                        <Link
                          url="https://shopify.dev/docs/api/admin-graphql"
                          target="_blank"
                          removeUnderline
                        >
                          GraphQL API
                        </Link>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                          Extension Type
                        </Text>
                        <Text as="span" variant="bodyMd">
                          POS UI Extension
                        </Text>
                      </InlineStack>
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd">
                          API Version
                        </Text>
                        <Text as="span" variant="bodyMd">
                          2025-07
                        </Text>
                      </InlineStack>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Getting Started
                </Text>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Quick Setup
                  </Text>
                  <List>
                    <List.Item>
                      Install the extension in your POS
                    </List.Item>
                    <List.Item>
                      Configure B2B customer groups
                    </List.Item>
                    <List.Item>
                      Set up volume pricing rules
                    </List.Item>
                    <List.Item>
                      Test with sample orders
                    </List.Item>
                  </List>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

      </BlockStack>
    </Page>
  );
}
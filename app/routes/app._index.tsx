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
                    Streamline your wholesale operations with B2B customer management, 
                    corporate location selection, and draft order creation directly in Shopify POS.
                  </Text>
                  <InlineStack gap="200">
                    <Badge tone="success">POS Extension</Badge>
                    <Badge tone="info">B2B Ready</Badge>
                    <Badge tone="attention">Draft Orders</Badge>
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
                          🏢 B2B Customer Management
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Search and select corporate customers with automatic B2B detection 
                          based on customer tags and company profiles.
                        </Text>
                      </BlockStack>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          📍 Corporate Location Selection
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Choose corporate locations with full billing addresses 
                          for accurate order processing and customer management.
                        </Text>
                      </BlockStack>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          🛒 Cart Management
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Add products to cart, update quantities, and manage 
                          wholesale orders with quantity validation rules.
                        </Text>
                      </BlockStack>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneHalf">
                    <BlockStack gap="400">
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          📋 Draft Order Creation
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Create draft orders for B2B customers with automatic 
                          completion and fulfillment capabilities.
                        </Text>
                      </BlockStack>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          🔢 Quantity Rules
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Set minimum and maximum quantities with increment 
                          rules for wholesale order validation.
                        </Text>
                      </BlockStack>
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd">
                          ✅ Order Fulfillment
                        </Text>
                        <Text variant="bodyMd" as="p">
                          Complete orders and create fulfillments directly 
                          from POS for streamlined wholesale operations.
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
                          Search and select B2B customers with automatic detection 
                          based on customer tags and company profiles.
                        </Text>
                      </Box>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                        <Text as="h3" variant="headingMd" alignment="center">
                          2. Location & Cart Setup
                        </Text>
                        <Text variant="bodyMd" as="p" alignment="center">
                          Choose corporate locations with billing addresses, 
                          then add products to cart with quantity validation.
                        </Text>
                      </Box>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                        <Text as="h3" variant="headingMd" alignment="center">
                          3. Order Creation
                        </Text>
                        <Text variant="bodyMd" as="p" alignment="center">
                          Create draft orders, complete them, and generate 
                          fulfillments for streamlined B2B operations.
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
                        Customer Management
                      </Text>
                      <List>
                        <List.Item>B2B customer detection</List.Item>
                        <List.Item>Customer search functionality</List.Item>
                        <List.Item>Company profile integration</List.Item>
                        <List.Item>Customer tag-based identification</List.Item>
                        <List.Item>POS order history tracking</List.Item>
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
                        <List.Item>Order completion</List.Item>
                        <List.Item>Fulfillment generation</List.Item>
                        <List.Item>Quantity validation rules</List.Item>
                        <List.Item>Corporate location selection</List.Item>
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
                        🏢 B2B Customer Focus
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Designed specifically for wholesale operations with 
                        corporate customer management and location-based workflows.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        📋 Streamlined Workflow
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Simple 3-step process from customer selection to order 
                        fulfillment with minimal clicks and maximum efficiency.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
                <Divider />
                <Layout>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        🔒 Secure & Reliable
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Built on Shopify's secure infrastructure with enterprise-grade 
                        security and reliable order processing capabilities.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        🛠️ Easy Setup
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Quick installation with minimal configuration required. 
                        Works out of the box with existing B2B customer data.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                  <Layout.Section variant="oneThird">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">
                        💰 Cost Effective
                      </Text>
                      <Text variant="bodyMd" as="p">
                        Reduce manual order processing time and errors while 
                        maintaining professional B2B customer relationships.
                      </Text>
                    </BlockStack>
                  </Layout.Section>
                </Layout>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Getting Started */}
        <Layout>
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
                      Set up quantity validation rules
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
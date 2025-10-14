import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/additional">Additional page</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  const boundaryHeaders = boundary.headers(headersArgs);
  
  // Add cache-control headers to fix missing header warning
  boundaryHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
  boundaryHeaders.set("Pragma", "no-cache");
  boundaryHeaders.set("Expires", "0");
  
  // Add security headers
  boundaryHeaders.set("X-Content-Type-Options", "nosniff");
  boundaryHeaders.set("X-Frame-Options", "DENY");
  boundaryHeaders.set("X-XSS-Protection", "1; mode=block");
  boundaryHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  boundaryHeaders.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  
  return boundaryHeaders;
};

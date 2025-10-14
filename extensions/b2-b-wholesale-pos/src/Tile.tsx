

import React from 'react'

import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale'

/**
 * B2B Wholesale POS Tile Component
 * 
 * Provides access to B2B wholesale order management features including:
 * - Quantity rules and volume discounts
 * - Customer-specific pricing
 * - PO number and delivery options
 * - Draft order creation for wholesale customers
 * 
 * @returns JSX element for the POS home tile
 */
const TileComponent = () => {
  const api = useApi()
  
  const handlePress = () => {
    try {
      console.log('B2B Wholesale tile pressed, presenting modal...')
      api.action.presentModal()
    } catch (error) {
      console.error('Error presenting modal:', error)
    }
  }
  
  return (
    <Tile
      title="B2B Wholesale"
      subtitle="Create wholesale orders with volume discounts"
      onPress={handlePress}
      enabled
    />
  )
}

export default reactExtension('pos.home.tile.render', () => {
  return <TileComponent />
})
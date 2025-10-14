import React, { useState, useMemo } from 'react'
import { 
  Text, 
  Button,
  TextField,
  ScrollView
} from '@shopify/ui-extensions-react/point-of-sale'

export interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
  render?: (value: any, item: T) => React.ReactNode
  width?: string
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchFields?: (keyof T)[]
  pageSize?: number
  onRowClick?: (item: T) => void
  emptyMessage?: string
  loading?: boolean
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = true,
  searchFields,
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No data available',
  loading = false
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm || !searchable) return data

    const searchFieldsToUse = searchFields || columns.map(col => col.key)
    
    return data.filter(item =>
      searchFieldsToUse.some(field => {
        const value = item[field]
        return value && String(value).toLowerCase().includes(searchTerm.toLowerCase())
      })
    )
  }, [data, searchTerm, searchable, searchFields, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortField) return filteredData

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      
      if (aValue === bValue) return 0
      
      const comparison = aValue < bValue ? -1 : 1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sortField, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return sortedData.slice(startIndex, endIndex)
  }, [sortedData, currentPage, pageSize])

  const totalPages = Math.ceil(sortedData.length / pageSize)

  const handleSort = (field: keyof T) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // Reset to first page when searching
  }

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  if (loading) {
    return (
      <>
        <Text>Loading data...</Text>
      </>
    )
  }

  return (
    <>
      {/* Search Bar */}
      {searchable && (
        <>
          <TextField
            label="Search"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search data..."
          />
          <Text> </Text>
        </>
      )}

      {/* Table Header */}
      <Text>────────────────────────────────────────────────────────</Text>
      {columns.map((column, index) => (
        <ScrollView key={index}>
          {column.sortable ? (
            <Button
              title={`${column.label}${sortField === column.key ? (sortDirection === 'asc' ? ' ↑' : ' ↓') : ''}`}
              onPress={() => handleSort(column.key)}
              type="basic"
            />
          ) : (
            <Text>{column.label}</Text>
          )}
        </ScrollView>
      ))}
      <Text>────────────────────────────────────────────────────────</Text>

      {/* Table Body */}
      {paginatedData.length > 0 ? (
        <>
          {paginatedData.map((item, rowIndex) => (
            <ScrollView key={rowIndex}>
              {columns.map((column, colIndex) => (
                <Text key={colIndex}>
                  {column.render 
                    ? column.render(item[column.key], item)
                    : String(item[column.key] || '')
                  }
                </Text>
              ))}
              {onRowClick && (
                <Button
                  title="View Details"
                  onPress={() => onRowClick(item)}
                  type="basic"
                />
              )}
              <Text>────────────────────────────────────────────────────────</Text>
            </ScrollView>
          ))}
        </>
      ) : (
        <Text>{emptyMessage}</Text>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <>
          <Text> </Text>
          <Text>Page {currentPage} of {totalPages}</Text>
          <Text>Showing {paginatedData.length} of {sortedData.length} items</Text>
          <Text> </Text>
          
          <Button
            title="← Previous"
            onPress={() => goToPage(currentPage - 1)}
            isDisabled={currentPage === 1}
          />
          
          <Text> </Text>
          
          <Button
            title="Next →"
            onPress={() => goToPage(currentPage + 1)}
            isDisabled={currentPage === totalPages}
          />
        </>
      )}
    </>
  )
}

export default DataTable

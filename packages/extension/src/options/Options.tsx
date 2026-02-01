/**
 * Options Page
 * Main options/settings page with PDF translation feature
 */

import React, { useState, useEffect } from 'react'
import PdfViewer from './PdfViewer'
import SettingsPage from './SettingsPage'

type Page = 'settings' | 'pdf'

const Options: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('settings')
  const [pdfUrl, setPdfUrl] = useState<string>('')

  useEffect(() => {
    // Parse URL parameters
    const params = new URLSearchParams(window.location.search)
    const page = params.get('page')
    const fileUrl = params.get('fileUrl')

    if (page === 'pdf') {
      setCurrentPage('pdf')
      if (fileUrl) {
        setPdfUrl(decodeURIComponent(fileUrl))
      }
    }
  }, [])

  if (currentPage === 'pdf') {
    return <PdfViewer initialUrl={pdfUrl} onBack={() => setCurrentPage('settings')} />
  }

  return <SettingsPage onOpenPdf={() => setCurrentPage('pdf')} />
}

export default Options

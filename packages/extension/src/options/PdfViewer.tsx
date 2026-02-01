/**
 * PDF Viewer Component
 * Displays PDF documents with translation panel
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useTranslate } from '@/hooks/useTranslate'
import Storage from '@/services/storage'
import { ArrowLeft, Upload, Copy, Trash2, FileText, Languages } from 'lucide-react'

const LANGUAGES = [
  { value: 'zh', label: 'Chinese' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
]

interface PdfViewerProps {
  initialUrl?: string
  onBack: () => void
}

const PdfViewer: React.FC<PdfViewerProps> = ({ initialUrl, onBack }) => {
  const [pdfUrl, setPdfUrl] = useState(initialUrl || '')
  const [targetLanguage, setTargetLanguage] = useState('zh')
  const [continuousMode, setContinuousMode] = useState(false)
  const [inputText, setInputText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [notification, setNotification] = useState('')

  const { translate, isLoading } = useTranslate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const translationBuffer = useRef('')

  // Load saved target language
  useEffect(() => {
    Storage.get('targetLanguage', 'zh').then(setTargetLanguage)
  }, [])

  // Show notification
  const showNotification = useCallback((message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(''), 2000)
  }, [])

  // Handle file upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.name.toLowerCase().endsWith('.pdf')) {
        showNotification('Please select a PDF file')
        return
      }

      const url = URL.createObjectURL(file)
      setPdfUrl(url)
    },
    [showNotification]
  )

  // Handle text selection from PDF
  const handlePdfMessage = useCallback(
    async (event: MessageEvent) => {
      const { data, source } = event

      // Check if message is from our iframe
      if ((source as Window)?.name !== 'pdfFrame') return

      if (data?.type === 'selection' && data?.text) {
        const selectedText = data.text.trim()

        if (!selectedText) return

        // In continuous mode, append to existing text
        if (continuousMode) {
          const newText = translationBuffer.current
            ? `${translationBuffer.current} ${selectedText}`
            : selectedText

          if (newText.length > 5000) {
            showNotification('Text limit reached (5000 characters)')
            return
          }

          translationBuffer.current = newText
          setInputText(newText)
        } else {
          translationBuffer.current = selectedText
          setInputText(selectedText)
        }

        // Trigger translation
        await handleTranslate(translationBuffer.current)
      }
    },
    [continuousMode, showNotification]
  )

  // Listen for messages from PDF iframe
  useEffect(() => {
    window.addEventListener('message', handlePdfMessage)
    return () => window.removeEventListener('message', handlePdfMessage)
  }, [handlePdfMessage])

  // Handle translation
  const handleTranslate = useCallback(
    async (text: string) => {
      if (!text.trim()) return

      const result = await translate(text, targetLanguage)
      if (result) {
        setTranslatedText(result.translatedText)
      }
    },
    [translate, targetLanguage]
  )

  // Handle input text change with debounce
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setInputText(text)
    translationBuffer.current = text
  }, [])

  // Handle manual translation trigger
  const handleManualTranslate = useCallback(() => {
    handleTranslate(inputText)
  }, [handleTranslate, inputText])

  // Handle language change
  const handleLanguageChange = useCallback(
    async (value: string) => {
      setTargetLanguage(value)
      await Storage.set('targetLanguage', value)

      // Re-translate if we have text
      if (inputText) {
        handleTranslate(inputText)
      }
    },
    [inputText, handleTranslate]
  )

  // Clear all
  const handleClear = useCallback(() => {
    setInputText('')
    setTranslatedText('')
    translationBuffer.current = ''
  }, [])

  // Copy to clipboard
  const handleCopy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text)
        showNotification('Copied to clipboard')
      } catch {
        showNotification('Failed to copy')
      }
    },
    [showNotification]
  )

  // PDF viewer URL (using browser's built-in PDF viewer or pdf.js)
  const getPdfViewerUrl = useCallback((url: string) => {
    // For now, use the browser's built-in PDF viewer
    // In production, you might want to use pdf.js for more features
    return url
  }, [])

  // Upload screen
  if (!pdfUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">PDF Translator</h1>
            <p className="text-muted-foreground">Upload a PDF document to translate</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload area */}
            <div
              className="relative border-2 border-dashed border-blue-200 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer bg-blue-50/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-12 h-12 mx-auto text-blue-400 mb-4" />
              <p className="text-lg font-medium text-blue-700">Click to upload or drag and drop</p>
              <p className="text-sm text-muted-foreground mt-1">PDF files only</p>
            </div>

            {/* Instructions */}
            <div className="bg-amber-50 rounded-lg p-4">
              <h3 className="font-medium text-amber-800 mb-2">💡 How to use</h3>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• Upload a PDF file to view it</li>
                <li>• Select text in the PDF to translate</li>
                <li>• Use continuous mode to combine multiple selections</li>
                <li>• Or type/paste text directly for translation</li>
              </ul>
            </div>

            {/* Back button */}
            <Button variant="outline" onClick={onBack} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // PDF viewer with translation panel
  return (
    <div className="h-screen flex">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
          {notification}
        </div>
      )}

      {/* PDF Area */}
      <div className="flex-1 bg-gray-100">
        <iframe
          ref={iframeRef}
          name="pdfFrame"
          src={getPdfViewerUrl(pdfUrl)}
          className="w-full h-full border-0"
          title="PDF Viewer"
        />
      </div>

      {/* Translation Panel */}
      <div className="w-[420px] bg-gradient-to-b from-blue-50 to-white border-l flex flex-col">
        {/* Header */}
        <div className="p-4 border-b bg-white/80 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPdfUrl('')
                handleClear()
              }}
            >
              <Upload className="w-4 h-4 mr-1" />
              New PDF
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Language selector */}
            <Select value={targetLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32">
                <Languages className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Continuous mode */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Continuous</span>
              <Switch checked={continuousMode} onCheckedChange={setContinuousMode} />
            </div>
          </div>
        </div>

        {/* Translation Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Translated text */}
          <Card>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
              <span className="font-medium text-sm text-blue-700">
                {isLoading ? 'Translating...' : 'Translation'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(translatedText)}
                disabled={!translatedText}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  Translating...
                </div>
              ) : translatedText ? (
                <p className="text-base leading-relaxed">{translatedText}</p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Select text in the PDF or type below to translate
                </p>
              )}
            </CardContent>
          </Card>

          {/* Source text */}
          <Card>
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
              <span className="font-medium text-sm">Original Text</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(inputText)}
                  disabled={!inputText}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClear} disabled={!inputText}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <Textarea
                value={inputText}
                onChange={handleInputChange}
                placeholder="Select text from PDF or type here..."
                rows={6}
                className="resize-none"
              />
              <Button
                className="w-full mt-3"
                onClick={handleManualTranslate}
                disabled={!inputText || isLoading}
              >
                {isLoading ? 'Translating...' : 'Translate'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default PdfViewer

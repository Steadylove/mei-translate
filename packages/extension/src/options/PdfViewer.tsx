/**
 * PDF Viewer Component
 * Displays PDF documents with split-panel translation
 * - Top: Editable original text
 * - Bottom: Translation result
 * - Draggable divider to resize panels
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useTranslate, DualTranslationResult } from '@/hooks/useTranslate'
import { useTTS } from '@/hooks/useTTS'
import { useRefine } from '@/hooks/useRefine'
import Storage from '@/services/storage'
import {
  ArrowLeft,
  Upload,
  Copy,
  Trash2,
  FileText,
  Volume2,
  Check,
  GripHorizontal,
  Sparkles,
  Send,
  X,
  Info,
  Zap,
} from 'lucide-react'

const LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
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
  const [dualResult, setDualResult] = useState<DualTranslationResult | null>(null)
  const [notification, setNotification] = useState('')
  const [copiedType, setCopiedType] = useState<'original' | 'machine' | 'llm' | null>(null)

  // Split panel state
  const [topPanelHeight, setTopPanelHeight] = useState(40) // percentage
  const [isDragging, setIsDragging] = useState(false)
  const panelContainerRef = useRef<HTMLDivElement>(null)

  const { dualTranslate, isLoading } = useTranslate()
  const { speak, stop, isSpeaking } = useTTS()
  const {
    messages: refineMessages,
    refine,
    isRefining,
    error: refineError,
    reset: resetRefine,
  } = useRefine()
  const [speakingType, setSpeakingType] = useState<'original' | 'machine' | 'llm' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const appIconUrl = chrome.runtime.getURL('assets/icon128.png')

  // Refine state
  const [showRefine, setShowRefine] = useState(false)
  const [refineInput, setRefineInput] = useState('')
  const [adoptedId, setAdoptedId] = useState<string | null>(null)
  const refineMessagesEndRef = useRef<HTMLDivElement>(null)

  const presetCommands = [
    {
      label: 'More Natural',
      instruction: 'Make the translation more colloquial and natural-sounding',
    },
    { label: 'More Formal', instruction: 'Make the translation more formal and professional' },
    {
      label: 'More Concise',
      instruction:
        'Make the translation more concise, remove redundancy while keeping the core meaning',
    },
    {
      label: 'Keep Terms',
      instruction: 'Keep all technical terms and proper nouns untranslated, use the original terms',
    },
  ]

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

  // Listen for messages from PDF viewer iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Ignore messages without proper data structure
      if (!event.data || typeof event.data !== 'object') return

      const { type, text } = event.data

      if (type === 'pdf-selection' && typeof text === 'string' && text.trim()) {
        console.log('[PdfViewer] Received selection from iframe:', text.substring(0, 50))

        setInputText((prev) => {
          if (continuousMode && prev) {
            return prev + '\n' + text.trim()
          }
          return text.trim()
        })

        showNotification('Text selected from PDF')
      } else if (type === 'pdf-viewer-ready') {
        console.log('[PdfViewer] PDF.js viewer ready')
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [continuousMode, showNotification])

  // Get PDF viewer URL - use official PDF.js viewer
  const getPdfViewerUrl = useCallback((url: string) => {
    // Use Mozilla's PDF.js viewer with our selection script injected
    const viewerUrl = chrome.runtime.getURL('pdfjs/web/viewer.html')
    return `${viewerUrl}?file=${encodeURIComponent(url)}`
  }, [])

  // Handle translation
  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) return

    const result = await dualTranslate(inputText, targetLanguage)
    if (result) {
      setDualResult(result)
    }
  }, [dualTranslate, inputText, targetLanguage])

  // Auto-translate when input changes (debounced)
  const translateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (!inputText.trim()) {
      setDualResult(null)
      return
    }

    // Clear previous timeout
    if (translateTimeoutRef.current) {
      clearTimeout(translateTimeoutRef.current)
    }

    // Debounce translation
    translateTimeoutRef.current = setTimeout(() => {
      handleTranslate()
    }, 500)

    return () => {
      if (translateTimeoutRef.current) {
        clearTimeout(translateTimeoutRef.current)
      }
    }
  }, [inputText, handleTranslate])

  // Handle language change
  const handleLanguageChange = useCallback(
    async (value: string) => {
      setTargetLanguage(value)
      await Storage.set('targetLanguage', value)

      // Re-translate if we have text
      if (inputText) {
        const result = await dualTranslate(inputText, value)
        if (result) {
          setDualResult(result)
        }
      }
    },
    [inputText, dualTranslate]
  )

  // Clear all
  const handleClear = useCallback(() => {
    setInputText('')
    setDualResult(null)
  }, [])

  // Copy to clipboard
  const handleCopy = useCallback(
    async (text: string, type: 'original' | 'machine' | 'llm') => {
      try {
        await navigator.clipboard.writeText(text)
        setCopiedType(type)
        setTimeout(() => setCopiedType(null), 1500)
      } catch {
        showNotification('Failed to copy')
      }
    },
    [showNotification]
  )

  // TTS handler
  const handleSpeak = useCallback(
    (text: string, lang: string, type: 'original' | 'machine' | 'llm') => {
      if (isSpeaking && speakingType === type) {
        stop()
        setSpeakingType(null)
      } else {
        stop()
        setSpeakingType(type)
        speak(text, { lang, rate: 0.9 })
      }
    },
    [speak, stop, isSpeaking, speakingType]
  )

  // Reset speaking state when speech ends
  useEffect(() => {
    if (!isSpeaking) {
      setSpeakingType(null)
    }
  }, [isSpeaking])

  // Handle refine request
  const handleRefine = useCallback(
    async (instruction: string) => {
      if (!instruction.trim() || !dualResult) return

      const currentTranslation =
        dualResult.llm.translatedText || dualResult.machine.translatedText || ''

      const refinedText = await refine(instruction, {
        originalText: inputText,
        currentTranslation,
        targetLang: targetLanguage,
        sourceLang: dualResult.sourceLanguage,
      })

      if (refinedText) {
        setRefineInput('')
      }
    },
    [dualResult, inputText, targetLanguage, refine]
  )

  const handleSendRefine = useCallback(() => {
    if (refineInput.trim()) {
      handleRefine(refineInput)
    }
  }, [refineInput, handleRefine])

  const handleAdopt = useCallback(
    (messageId: string, content: string) => {
      if (!dualResult) return
      setAdoptedId(messageId)
      setDualResult({
        ...dualResult,
        llm: {
          ...dualResult.llm,
          translatedText: content,
        },
      })
    },
    [dualResult]
  )

  // Auto-scroll refine messages
  useEffect(() => {
    if (refineMessagesEndRef.current) {
      refineMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [refineMessages])

  // Reset refine when input text changes
  useEffect(() => {
    if (showRefine) {
      resetRefine()
      setAdoptedId(null)
    }
  }, [inputText]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close refine modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showRefine) {
        setShowRefine(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showRefine])

  // Draggable divider handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelContainerRef.current) return

      const containerRect = panelContainerRef.current.getBoundingClientRect()
      const relativeY = e.clientY - containerRect.top
      const percentage = (relativeY / containerRect.height) * 100

      // Limit between 20% and 80%
      const clampedPercentage = Math.max(20, Math.min(80, percentage))
      setTopPanelHeight(clampedPercentage)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  // Upload screen
  if (!pdfUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fbfffd_0%,#f4fbf8_100%)] p-8">
        <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg shadow-slate-900/8">
          <div className="p-8 pb-6 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[24px] bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
              <img src={appIconUrl} alt="Mei Lingua" className="h-full w-full rounded-[20px]" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">PDF Translation</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Upload a document and translate selected text instantly
            </p>
          </div>
          <div className="px-8 pb-8 space-y-6">
            {/* Upload area */}
            <label
              htmlFor="pdf-file-input"
              className="block cursor-pointer rounded-3xl border-2 border-dashed border-teal-200 bg-teal-50/50 p-12 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-500 hover:bg-teal-50"
            >
              <input
                id="pdf-file-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                className="sr-only"
              />
              <Upload className="mx-auto mb-4 h-12 w-12 text-teal-700" />
              <p className="text-lg font-semibold text-teal-900">
                Click to upload or drag and drop
              </p>
              <p className="mt-1 text-sm font-medium text-slate-600">PDF files only</p>
            </label>

            {/* Instructions */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 flex items-center gap-2 font-semibold text-teal-900">
                <Info className="h-4 w-4 text-teal-600" />
                How to use
              </h3>
              <ul className="space-y-1 text-sm text-slate-600">
                <li>• Upload a PDF file to view it on the left</li>
                <li>• Select text in the PDF to auto-translate</li>
                <li>• Translation appears automatically on the right</li>
                <li>• Drag the divider to resize panels</li>
              </ul>
            </div>

            {/* Back button */}
            <Button variant="outline" onClick={onBack} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Settings
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // PDF viewer with split translation panel
  return (
    <div className="flex h-screen bg-slate-100">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {notification}
        </div>
      )}

      {/* PDF Area */}
      <div className="flex-1 bg-slate-700">
        <iframe
          src={getPdfViewerUrl(pdfUrl)}
          className="w-full h-full border-0"
          title="PDF Viewer"
        />
      </div>

      {/* Translation Panel - Split View */}
      <div className="flex w-[500px] flex-col border-l border-slate-200 bg-slate-50 shadow-xl shadow-slate-950/10">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white">
          <div className="h-1 bg-teal-500" />
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="h-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
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
                className="h-8 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                <Upload className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {/* Language selector */}
              <Select value={targetLanguage} onValueChange={handleLanguageChange}>
                <SelectTrigger className="h-8 w-28 rounded-full border-slate-200 bg-slate-50 text-xs text-slate-900 shadow-none hover:border-teal-300 hover:bg-white focus:border-teal-500 focus:ring-teal-100">
                  <SelectValue>
                    {LANGUAGES.find((l) => l.value === targetLanguage)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value} className="text-xs">
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Continuous mode */}
              <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                <span className="font-medium text-slate-600">Append</span>
                <Switch
                  checked={continuousMode}
                  onCheckedChange={setContinuousMode}
                  className="scale-75 data-[state=checked]:bg-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Split Panels Container */}
        <div ref={panelContainerRef} className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Top Panel - Original Text (Editable) */}
          <div className="flex flex-col overflow-hidden" style={{ height: `${topPanelHeight}%` }}>
            {/* Original Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                Original
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    handleSpeak(inputText, dualResult?.sourceLanguage || 'en', 'original')
                  }
                  disabled={!inputText}
                  className={`p-1.5 rounded-md transition-colors ${
                    speakingType === 'original'
                      ? 'text-teal-700 bg-teal-100'
                      : 'text-slate-400 hover:text-teal-700 hover:bg-teal-50'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                  title="Listen"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleCopy(inputText, 'original')}
                  disabled={!inputText}
                  className="p-1.5 rounded-md text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Copy"
                >
                  {copiedType === 'original' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={handleClear}
                  disabled={!inputText}
                  className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Clear"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Original Content - Editable */}
            <textarea
              value={inputText}
              onChange={(e) => {
                const newText = e.target.value
                if (continuousMode && inputText && newText.length > inputText.length) {
                  // In continuous mode, keep appending
                  setInputText(newText)
                } else {
                  setInputText(newText)
                }
              }}
              placeholder="Select text in PDF, or type here to translate..."
              className="flex-1 resize-none bg-white p-4 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          {/* Draggable Divider */}
          <div
            className={`flex h-2 cursor-row-resize items-center justify-center border-y border-slate-100 transition-colors ${
              isDragging ? 'bg-teal-100' : 'bg-slate-50 hover:bg-teal-50'
            }`}
            onMouseDown={handleDragStart}
          >
            <GripHorizontal
              className={`w-5 h-5 ${isDragging ? 'text-teal-600' : 'text-slate-300'}`}
            />
          </div>

          {/* Bottom Panel - Translation Result */}
          <div
            className="flex flex-col overflow-hidden"
            style={{ height: `${100 - topPanelHeight}%` }}
          >
            {/* Translation Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                {isLoading ? 'Translating...' : 'Translation'}
              </span>
            </div>
            {/* Translation Content */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-white px-4 py-3 text-teal-800 shadow-sm">
                    <div className="w-5 h-5 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                    <span className="text-sm font-medium">Translating...</span>
                  </div>
                </div>
              ) : dualResult ? (
                <>
                  {/* Machine Translation */}
                  {dualResult.machine.translatedText && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-white px-3 py-2">
                        <span className="text-xs font-semibold text-slate-700">
                          <span className="inline-flex items-center gap-1.5">
                            <Zap className="h-3 w-3 text-cyan-600" />
                            Machine
                          </span>
                          {dualResult.machine.provider && (
                            <span className="text-slate-400 ml-1">
                              ({dualResult.machine.provider})
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() =>
                              handleSpeak(
                                dualResult.machine.translatedText!,
                                targetLanguage,
                                'machine'
                              )
                            }
                            className={`p-1 rounded transition-colors ${
                              speakingType === 'machine'
                                ? 'text-teal-700 bg-teal-100'
                                : 'text-slate-400 hover:text-teal-700 hover:bg-teal-50'
                            }`}
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() =>
                              handleCopy(dualResult.machine.translatedText!, 'machine')
                            }
                            className="p-1 rounded text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                          >
                            {copiedType === 'machine' ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="p-3 text-sm leading-relaxed text-slate-800">
                        {dualResult.machine.translatedText}
                      </div>
                    </div>
                  )}

                  {/* LLM Translation */}
                  {dualResult.llm.available && (
                    <div className="overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm shadow-teal-900/5">
                      <div className="flex items-center justify-between border-b border-teal-100 bg-teal-50 px-3 py-2">
                        <span className="text-xs font-semibold text-teal-900">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-teal-500" />
                            Enhanced
                          </span>
                          {dualResult.llm.model && (
                            <span className="text-teal-600/70 ml-1">({dualResult.llm.model})</span>
                          )}
                        </span>
                        {dualResult.llm.translatedText && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                handleSpeak(dualResult.llm.translatedText!, targetLanguage, 'llm')
                              }
                              className={`p-1 rounded transition-colors ${
                                speakingType === 'llm'
                                  ? 'text-teal-700 bg-teal-100'
                                  : 'text-teal-600 hover:text-teal-800 hover:bg-teal-100'
                              }`}
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleCopy(dualResult.llm.translatedText!, 'llm')}
                              className="p-1 rounded text-teal-600 hover:text-teal-800 hover:bg-teal-100 transition-colors"
                            >
                              {copiedType === 'llm' ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-sm leading-relaxed text-slate-800">
                        {dualResult.llm.translatedText ? (
                          dualResult.llm.translatedText
                        ) : dualResult.llm.error ? (
                          <span className="text-red-500">{dualResult.llm.error}</span>
                        ) : (
                          <div className="flex items-center gap-2 text-teal-700">
                            <div className="w-3 h-3 border-2 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                            <span>Enhancing translation...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Refine Translation Button */}
                  {dualResult.llm.available && dualResult.llm.translatedText && (
                    <button
                      onClick={() => setShowRefine(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 bg-white text-teal-700 border border-teal-200 shadow-sm shadow-teal-900/5 hover:bg-teal-50 hover:border-teal-300"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Polish Translation
                    </button>
                  )}

                  {/* Hint if no LLM configured */}
                  {!dualResult.llm.available && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Configure an API key in settings for higher quality AI translation
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center">
                  <div className="max-w-[260px] rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm shadow-slate-900/5">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Select text in PDF</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Pick any sentence on the left. The translation will appear here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Refine Modal Dialog */}
      {showRefine && dualResult?.llm.translatedText && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRefine(false)
          }}
        >
          <div className="w-[680px] max-w-[92vw] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-bold text-teal-800">Refine Translation</span>
              </div>
              <button
                onClick={() => setShowRefine(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Context: Original & Current Translation */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                    Original
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed max-h-24 overflow-y-auto">
                    {inputText}
                  </p>
                </div>
                <div className="bg-gradient-to-br from-teal-50/60 to-cyan-50/60 rounded-xl p-3 border border-teal-200">
                  <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider block mb-1.5">
                    Current AI Translation
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed max-h-24 overflow-y-auto">
                    {dualResult.llm.translatedText}
                  </p>
                </div>
              </div>

              {/* Preset Commands */}
              <div className="flex flex-wrap gap-1.5">
                {presetCommands.map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => handleRefine(cmd.instruction)}
                    disabled={isRefining}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full hover:bg-teal-50 hover:text-teal-600 hover:border-teal-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cmd.label}
                  </button>
                ))}
              </div>

              {/* Chat History */}
              {refineMessages.length > 0 ? (
                <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
                  {refineMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-xl text-sm leading-relaxed p-3 ${
                        msg.role === 'user'
                          ? 'bg-slate-100 border border-slate-200 text-slate-600 ml-12'
                          : 'bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 text-slate-700'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                              Refined
                            </span>
                            <button
                              onClick={() => handleAdopt(msg.id, msg.content)}
                              className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-lg transition-all ${
                                adoptedId === msg.id
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-teal-100 text-teal-700 hover:bg-teal-500 hover:text-white'
                              }`}
                            >
                              {adoptedId === msg.id ? '✓ Adopted' : 'Adopt'}
                            </button>
                          </div>
                          {msg.content}
                        </>
                      ) : (
                        <>{msg.content}</>
                      )}
                    </div>
                  ))}
                  {isRefining && (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-sm text-slate-500">
                      <div className="w-4 h-4 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
                      Refining...
                    </div>
                  )}
                  <div ref={refineMessagesEndRef} />
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                  Use preset commands or type a custom instruction to refine the translation
                </div>
              )}

              {/* Error */}
              {refineError && (
                <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">
                  {refineError}
                </div>
              )}
            </div>

            {/* Modal Footer - Input Area */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendRefine()
                    }
                  }}
                  placeholder="e.g., make it more natural..."
                  disabled={isRefining}
                  className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 disabled:opacity-50 bg-white"
                />
                <button
                  onClick={handleSendRefine}
                  disabled={isRefining || !refineInput.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PdfViewer

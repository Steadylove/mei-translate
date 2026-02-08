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
  Languages,
  Volume2,
  Check,
  GripHorizontal,
  Sparkles,
  Send,
  X,
} from 'lucide-react'

const LANGUAGES = [
  { value: 'zh', label: '中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 flex items-center justify-center p-8">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          <div className="text-center p-8 pb-6">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-teal-500/25">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">PDF Translator</h1>
            <p className="text-slate-500 mt-1">Upload a PDF document to translate</p>
          </div>
          <div className="px-8 pb-8 space-y-6">
            {/* Upload area */}
            <label
              htmlFor="pdf-file-input"
              className="block border-2 border-dashed border-teal-200 rounded-xl p-12 text-center hover:border-teal-400 transition-colors cursor-pointer bg-teal-50/50"
            >
              <input
                id="pdf-file-input"
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                className="sr-only"
              />
              <Upload className="w-12 h-12 mx-auto text-teal-400 mb-4" />
              <p className="text-lg font-medium text-teal-700">Click to upload or drag and drop</p>
              <p className="text-sm text-slate-500 mt-1">PDF files only</p>
            </label>

            {/* Instructions */}
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <h3 className="font-medium text-amber-800 mb-2">💡 How to use</h3>
              <ul className="text-sm text-amber-700 space-y-1">
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
    <div className="h-screen flex bg-slate-100">
      {/* Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
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
      <div className="w-[480px] bg-white border-l border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-3 border-b bg-gradient-to-r from-slate-50 to-teal-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="h-8">
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
              className="h-8"
            >
              <Upload className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* Language selector */}
            <Select value={targetLanguage} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <Languages className="w-3 h-3 mr-1" />
                <SelectValue>
                  {LANGUAGES.find((l) => l.value === targetLanguage)?.flag}{' '}
                  {LANGUAGES.find((l) => l.value === targetLanguage)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Continuous mode */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Append</span>
              <Switch
                checked={continuousMode}
                onCheckedChange={setContinuousMode}
                className="scale-75 data-[state=checked]:bg-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Split Panels Container */}
        <div ref={panelContainerRef} className="flex-1 flex flex-col overflow-hidden">
          {/* Top Panel - Original Text (Editable) */}
          <div className="flex flex-col overflow-hidden" style={{ height: `${topPanelHeight}%` }}>
            {/* Original Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
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
                      ? 'text-teal-600 bg-teal-50'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                  title="Listen"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleCopy(inputText, 'original')}
                  disabled={!inputText}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
              className="flex-1 p-4 text-sm leading-relaxed resize-none focus:outline-none bg-white text-slate-700 placeholder:text-slate-400"
            />
          </div>

          {/* Draggable Divider */}
          <div
            className={`h-2 flex items-center justify-center cursor-row-resize transition-colors ${
              isDragging ? 'bg-teal-100' : 'bg-slate-100 hover:bg-teal-50'
            }`}
            onMouseDown={handleDragStart}
          >
            <GripHorizontal
              className={`w-5 h-5 ${isDragging ? 'text-teal-500' : 'text-slate-300'}`}
            />
          </div>

          {/* Bottom Panel - Translation Result */}
          <div
            className="flex flex-col overflow-hidden"
            style={{ height: `${100 - topPanelHeight}%` }}
          >
            {/* Translation Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-teal-100">
              <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide">
                {isLoading ? '⏳ Translating...' : '✨ Translation'}
              </span>
            </div>
            {/* Translation Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white to-slate-50/50">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3 text-slate-500">
                    <div className="w-5 h-5 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
                    <span className="text-sm">Translating...</span>
                  </div>
                </div>
              ) : dualResult ? (
                <>
                  {/* Machine Translation */}
                  {dualResult.machine.translatedText && (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-xs font-medium text-slate-600">
                          ⚡ Machine
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
                                ? 'text-teal-600 bg-teal-50'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() =>
                              handleCopy(dualResult.machine.translatedText!, 'machine')
                            }
                            className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {copiedType === 'machine' ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="p-3 text-sm leading-relaxed text-slate-700">
                        {dualResult.machine.translatedText}
                      </div>
                    </div>
                  )}

                  {/* LLM Translation */}
                  {dualResult.llm.available && (
                    <div className="bg-gradient-to-br from-teal-50/50 to-cyan-50/50 rounded-xl border border-teal-200 overflow-hidden">
                      <div className="flex items-center justify-between px-3 py-2 bg-teal-50/80 border-b border-teal-100">
                        <span className="text-xs font-medium text-teal-700">
                          ✨ AI
                          {dualResult.llm.model && (
                            <span className="text-teal-500 ml-1">({dualResult.llm.model})</span>
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
                                  ? 'text-teal-600 bg-teal-100'
                                  : 'text-teal-500 hover:text-teal-700'
                              }`}
                            >
                              <Volume2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleCopy(dualResult.llm.translatedText!, 'llm')}
                              className="p-1 rounded text-teal-500 hover:text-teal-700 transition-colors"
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
                      <div className="p-3 text-sm leading-relaxed text-slate-700">
                        {dualResult.llm.translatedText ? (
                          dualResult.llm.translatedText
                        ) : dualResult.llm.error ? (
                          <span className="text-red-500">{dualResult.llm.error}</span>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400">
                            <div className="w-3 h-3 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
                            <span>AI translating...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Refine Translation Button */}
                  {dualResult.llm.available && dualResult.llm.translatedText && (
                    <button
                      onClick={() => setShowRefine(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 bg-teal-50 text-teal-600 border border-dashed border-teal-200 hover:bg-teal-100 hover:border-teal-300"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Refine Translation
                    </button>
                  )}

                  {/* Hint if no LLM configured */}
                  {!dualResult.llm.available && (
                    <div className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 border border-amber-100">
                      💡 Configure an API key in settings for higher quality AI translation
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Languages className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Select text in PDF to translate</p>
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
                        <>💬 {msg.content}</>
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

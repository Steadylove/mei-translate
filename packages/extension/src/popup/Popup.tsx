/**
 * Popup Component
 * Extension popup with quick actions and settings
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Storage from '@/services/storage'
import { MessageType } from '@/background/index'
import { Languages, FileText, Settings, Globe, Zap } from 'lucide-react'

const LANGUAGES = [
  { value: 'zh', label: '中文', flag: '🇨🇳' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
]

const Popup: React.FC = () => {
  const [targetLanguage, setTargetLanguage] = useState('zh')
  const [selectionEnabled, setSelectionEnabled] = useState(true)
  const [webTransEnabled, setWebTransEnabled] = useState(true)
  const [currentHost, setCurrentHost] = useState('')
  const [isBlacklisted, setIsBlacklisted] = useState(false)

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await Storage.getAllSettings()
      setTargetLanguage(settings.targetLanguage)
      setSelectionEnabled(settings.selectionTransEnabled)
      setWebTransEnabled(settings.webTransEnabled)

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab?.url) {
        try {
          const url = new URL(tab.url)
          setCurrentHost(url.host)
          setIsBlacklisted(settings.blackList.includes(url.host))
        } catch {
          // Invalid URL
        }
      }
    }

    loadSettings()
  }, [])

  const handleLanguageChange = useCallback(async (value: string) => {
    setTargetLanguage(value)
    await Storage.set('targetLanguage', value)
  }, [])

  const handleSelectionToggle = useCallback(async (enabled: boolean) => {
    setSelectionEnabled(enabled)
    await Storage.set('selectionTransEnabled', enabled)
  }, [])

  const handleWebTransToggle = useCallback(async (enabled: boolean) => {
    setWebTransEnabled(enabled)
    await Storage.set('webTransEnabled', enabled)
  }, [])

  const handleBlacklistToggle = useCallback(
    async (blacklisted: boolean) => {
      const blackList = await Storage.get('blackList', [])

      if (blacklisted) {
        if (!blackList.includes(currentHost)) {
          blackList.push(currentHost)
        }
      } else {
        const index = blackList.indexOf(currentHost)
        if (index > -1) {
          blackList.splice(index, 1)
        }
      }

      await Storage.set('blackList', blackList)
      setIsBlacklisted(blacklisted)
    },
    [currentHost]
  )

  const handleTranslatePage = useCallback(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'show-web-trans-toolbar',
        args: { actionFrom: 'popup' },
      })
      window.close()
    }
  }, [])

  const handleOpenPdfTrans = useCallback(async () => {
    await chrome.runtime.sendMessage({
      type: MessageType.OPEN_PDF_VIEWER,
      args: {},
    })
    window.close()
  }, [])

  const handleOpenOptions = useCallback(() => {
    chrome.runtime.openOptionsPage()
    window.close()
  }, [])

  return (
    <div className="w-80 bg-gradient-to-br from-slate-50 to-slate-100/50">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="font-semibold text-base text-slate-800">Mei Trans</h1>
            <p className="text-xs text-slate-500">AI-Powered Translation</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            onClick={handleTranslatePage}
            className="h-auto py-4 flex-col gap-2 bg-gradient-to-br from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-md shadow-violet-500/25 transition-all hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5"
          >
            <Globe className="w-5 h-5" />
            <span className="text-xs font-medium">Translate Page</span>
          </Button>
          <Button
            onClick={handleOpenPdfTrans}
            variant="secondary"
            className="h-auto py-4 flex-col gap-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all hover:shadow hover:-translate-y-0.5"
          >
            <FileText className="w-5 h-5 text-slate-600" />
            <span className="text-xs font-medium text-slate-600">PDF Translate</span>
          </Button>
        </div>
      </div>

      {/* Settings */}
      <div className="mx-5 mb-4 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Target Language */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <span className="text-sm text-slate-700">Target Language</span>
          <Select value={targetLanguage} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-28 h-8 text-xs border-slate-200">
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
        </div>

        {/* Selection Translation */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <span className="text-sm text-slate-700">Selection Translate</span>
          <Switch
            checked={selectionEnabled}
            onCheckedChange={handleSelectionToggle}
            className="data-[state=checked]:bg-violet-500"
          />
        </div>

        {/* Web Translation */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
          <span className="text-sm text-slate-700">Page Translate</span>
          <Switch
            checked={webTransEnabled}
            onCheckedChange={handleWebTransToggle}
            className="data-[state=checked]:bg-violet-500"
          />
        </div>

        {/* Site Blacklist */}
        {currentHost && (
          <div className="flex items-center justify-between px-4 py-3.5 bg-slate-50/50">
            <div className="min-w-0 flex-1 mr-3">
              <span className="text-sm text-slate-700">Disable here</span>
              <p className="text-xs text-slate-400 truncate mt-0.5">{currentHost}</p>
            </div>
            <Switch
              checked={isBlacklisted}
              onCheckedChange={handleBlacklistToggle}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4">
        <button
          onClick={handleOpenOptions}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-slate-500 hover:text-violet-600 transition-colors rounded-xl hover:bg-white/80"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>More Settings</span>
        </button>
      </div>
    </div>
  )
}

export default Popup

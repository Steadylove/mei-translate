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
import { MessageType } from '@/types/messages'
import { FileText, Settings, Globe } from 'lucide-react'

const LANGUAGES = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'ru', label: 'Русский' },
]

const Popup: React.FC = () => {
  const [targetLanguage, setTargetLanguage] = useState('zh')
  const [selectionEnabled, setSelectionEnabled] = useState(true)
  const [webTransEnabled, setWebTransEnabled] = useState(true)
  const [currentHost, setCurrentHost] = useState('')
  const [isBlacklisted, setIsBlacklisted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const appIconUrl = chrome.runtime.getURL('assets/icon48.png')

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
      setIsLoaded(true)
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
    <div
      className={`w-[340px] overflow-hidden bg-[linear-gradient(180deg,#fbfffd_0%,#f4fbf8_100%)] text-slate-900 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative rounded-[18px] bg-white p-1 shadow-sm ring-1 ring-slate-200">
            <img src={appIconUrl} alt="Mei Lingua" className="h-11 w-11 rounded-2xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight text-slate-900">Mei Lingua</h1>
            <p className="text-xs font-medium text-slate-500">Lightweight translation</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2.5 px-5 pb-4">
        <Button
          onClick={handleTranslatePage}
          disabled={!webTransEnabled}
          className="h-[52px] w-full justify-start rounded-2xl bg-teal-700 px-4 shadow-sm shadow-teal-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md active:translate-y-0"
        >
          <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-xl bg-white/14">
            <Globe className="h-[18px] w-[18px]" />
          </span>
          <span className="flex flex-col items-start">
            <span className="text-sm font-semibold">Translate Page</span>
            <span className="text-[11px] font-medium text-teal-50/85">
              Show bilingual page text
            </span>
          </span>
        </Button>
        <Button
          onClick={handleOpenPdfTrans}
          variant="secondary"
          className="h-12 w-full justify-start rounded-2xl border border-slate-200 bg-white px-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/40 hover:shadow-md active:translate-y-0"
        >
          <FileText className="mr-3 h-5 w-5 text-teal-700" />
          <span className="text-sm font-semibold text-slate-800">PDF Translate</span>
        </Button>
      </div>

      {/* Settings */}
      <div className="mx-5 mb-4 overflow-visible rounded-[22px] border border-slate-200 bg-white shadow-sm">
        {/* Target Language */}
        <div className="flex items-center justify-between rounded-t-[22px] border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-slate-50">
          <span className="text-sm font-semibold text-slate-800">Target Language</span>
          <Select value={targetLanguage} onValueChange={handleLanguageChange} className="z-[100]">
            <SelectTrigger className="h-9 w-28 rounded-2xl border-slate-200 bg-slate-50 text-xs shadow-none hover:border-teal-200 hover:bg-white focus:border-teal-400 focus:ring-teal-100">
              <SelectValue>{LANGUAGES.find((l) => l.value === targetLanguage)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value} className="text-xs">
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selection Translation */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-slate-50">
          <span className="text-sm font-semibold text-slate-800">Selection Translate</span>
          <Switch
            checked={selectionEnabled}
            onCheckedChange={handleSelectionToggle}
            className="data-[state=checked]:bg-teal-500"
          />
        </div>

        {/* Web Translation */}
        <div
          className={`flex items-center justify-between border-b border-slate-100 px-4 py-3.5 transition-colors hover:bg-slate-50 ${currentHost ? '' : 'rounded-b-[22px]'}`}
        >
          <span className="text-sm font-semibold text-slate-800">Page Translate</span>
          <Switch
            checked={webTransEnabled}
            onCheckedChange={handleWebTransToggle}
            className="data-[state=checked]:bg-teal-500"
          />
        </div>

        {/* Site Blacklist */}
        {currentHost && (
          <div className="flex items-center justify-between rounded-b-[22px] bg-slate-50 px-4 py-3.5 transition-colors hover:bg-slate-100/70">
            <div className="min-w-0 flex-1 mr-3">
              <span className="text-sm font-semibold text-slate-800">Disable here</span>
              <p className="text-xs text-slate-600 truncate mt-0.5 font-mono">{currentHost}</p>
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
          className="group flex w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-semibold text-slate-600 transition-all duration-200 hover:bg-white hover:text-teal-700"
        >
          <Settings className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-90" />
          <span className="font-medium">More Settings</span>
        </button>
      </div>
    </div>
  )
}

export default Popup

/**
 * Settings Page Component
 * Includes API Key configuration and model selection
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import Storage, {
  StorageData,
  ModelProvider,
  UserApiKeys,
  PROVIDER_CONFIG,
} from '@/services/storage'
import {
  FileText,
  Trash2,
  Check,
  Globe,
  Type,
  Volume2,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Bot,
  Cpu,
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
  { value: 'ru', label: 'Русский' },
]

// Provider list with display order
const PROVIDERS: ModelProvider[] = [
  'openai',
  'claude',
  'deepseek',
  'gemini',
  'groq',
  'qwen',
  'moonshot',
  'zhipu',
]

interface SettingsPageProps {
  onOpenPdf: () => void
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenPdf }) => {
  const [settings, setSettings] = useState<StorageData | null>(null)
  const [blacklistText, setBlacklistText] = useState('')
  const [saved, setSaved] = useState(false)
  const [apiKeys, setApiKeys] = useState<UserApiKeys>({})
  const [visibleKeys, setVisibleKeys] = useState<Set<ModelProvider>>(new Set())
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const appIconUrl = chrome.runtime.getURL('assets/icon128.png')

  useEffect(() => {
    Storage.getAllSettings().then((s) => {
      setSettings(s)
      setBlacklistText(s.blackList.join('\n'))
      setApiKeys(s.apiKeys || {})
      setSelectedProvider(s.selectedProvider)
      setSelectedModel(s.selectedModel)
    })
  }, [])

  const updateSetting = useCallback(
    async <K extends keyof StorageData>(key: K, value: StorageData[K]) => {
      await Storage.set(key, value)
      setSettings((prev) => (prev ? { ...prev, [key]: value } : null))
      showSaved()
    },
    []
  )

  const showSaved = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleApiKeyChange = useCallback(
    async (provider: ModelProvider, value: string) => {
      const newKeys = { ...apiKeys, [provider]: value }
      if (!value) {
        delete newKeys[provider]
      }
      setApiKeys(newKeys)
      await Storage.set('apiKeys', newKeys)
      showSaved()
    },
    [apiKeys]
  )

  const toggleKeyVisibility = (provider: ModelProvider) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) {
        next.delete(provider)
      } else {
        next.add(provider)
      }
      return next
    })
  }

  const handleProviderSelect = useCallback(
    async (provider: ModelProvider) => {
      // If same provider is already selected, don't reset the model
      if (selectedProvider === provider) {
        return
      }

      setSelectedProvider(provider)
      const defaultModel = PROVIDER_CONFIG[provider].defaultModel
      setSelectedModel(defaultModel)
      await Storage.setMultiple({
        selectedProvider: provider,
        selectedModel: defaultModel,
      })
      showSaved()
    },
    [selectedProvider]
  )

  const handleModelSelect = useCallback(async (model: string) => {
    setSelectedModel(model)
    await Storage.set('selectedModel', model)
    showSaved()
  }, [])

  const handleSaveBlacklist = useCallback(async () => {
    const blackList = blacklistText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    await Storage.set('blackList', blackList)
    setSettings((prev) => (prev ? { ...prev, blackList } : null))
    showSaved()
  }, [blacklistText])

  const handleResetSettings = useCallback(async () => {
    if (confirm('Reset all settings to defaults? This will clear all API keys.')) {
      await Storage.resetSettings()
      const newSettings = await Storage.getAllSettings()
      setSettings(newSettings)
      setBlacklistText(newSettings.blackList.join('\n'))
      setApiKeys({})
      setSelectedProvider(null)
      setSelectedModel(null)
      showSaved()
    }
  }, [])

  // Get configured providers
  const configuredProviders = Object.keys(apiKeys).filter(
    (key) => apiKeys[key as ModelProvider]
  ) as ModelProvider[]

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#fbfffd_0%,#f4fbf8_100%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500 font-medium">Loading settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbfffd_0%,#f4fbf8_100%)] px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm animate-slide-up">
          <div className="rounded-[24px] bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
            <img src={appIconUrl} alt="Mei Lingua" className="h-16 w-16 rounded-3xl" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">Mei Lingua</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Translation settings</p>
          </div>
          {saved && (
            <div className="ml-auto flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full text-sm font-medium border border-emerald-100 animate-scale-in">
              <Check className="w-4 h-4" />
              Saved
            </div>
          )}
        </div>

        {/* AI Model Configuration */}
        <Card className="border-slate-200 bg-white shadow-sm animate-slide-up stagger-1">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-slate-950">
              <div className="rounded-2xl bg-teal-700 p-2 shadow-sm">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              AI Model Configuration
            </CardTitle>
            <CardDescription className="text-slate-600">
              Configure your preferred AI model for translation. Add an API key to enable AI
              translation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider API Keys */}
            <div className="space-y-3">
              {PROVIDERS.map((provider, index) => {
                const config = PROVIDER_CONFIG[provider]
                const hasKey = !!apiKeys[provider]
                const isVisible = visibleKeys.has(provider)
                const isSelected = selectedProvider === provider

                return (
                  <div
                    key={provider}
                    className={`rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${
                      isSelected
                        ? 'border-teal-300 bg-teal-50 shadow-sm'
                        : hasKey
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-slate-200 bg-white hover:border-teal-300'
                    }`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot
                          className={`w-4 h-4 transition-colors ${hasKey ? 'text-emerald-500' : 'text-slate-400'}`}
                        />
                        <span className="font-semibold text-slate-800">{config.name}</span>
                        {hasKey && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                            Configured
                          </span>
                        )}
                        {isSelected && hasKey && (
                          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
                            Active
                          </span>
                        )}
                      </div>
                      <a
                        href={config.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-teal-700"
                      >
                        Get API Key
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type={isVisible ? 'text' : 'password'}
                          value={apiKeys[provider] || ''}
                          onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                          placeholder={config.placeholder}
                          className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-10 font-mono text-sm text-slate-800 transition-all placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(provider)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {hasKey && (
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleProviderSelect(provider)}
                          className={`transition-all duration-200 ${isSelected ? 'bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 shadow-md' : 'hover:border-teal-300 hover:text-teal-600'}`}
                        >
                          {isSelected ? 'Selected' : 'Use'}
                        </Button>
                      )}
                    </div>
                    {/* Model selection for selected provider */}
                    {isSelected && hasKey && (
                      <div className="mt-3 pt-3 border-t border-teal-200/50 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600 font-medium">Model:</span>
                          <Select value={selectedModel || ''} onValueChange={handleModelSelect}>
                            <SelectTrigger className="flex-1 h-9 text-sm border-teal-200 focus:border-teal-400">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {config.models.map((model) => (
                                <SelectItem key={model.id} value={model.id}>
                                  {model.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {configuredProviders.length === 0 && (
              <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Key className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium">No API keys configured</p>
                <p className="text-xs text-slate-400 mt-1">
                  Add an API key above to enable AI translation.
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600">
                  <Zap className="h-3 w-3" />
                  Machine translation works without API keys
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          {/* PDF Translation Card */}
          <Card className="overflow-hidden border-slate-200 bg-white shadow-sm animate-slide-up stagger-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-slate-950">
                <div className="rounded-2xl bg-slate-100 p-2">
                  <FileText className="w-5 h-5 text-teal-700" />
                </div>
                PDF Translation
              </CardTitle>
              <CardDescription className="text-slate-600">
                Translate PDF documents with AI-powered selection translation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={onOpenPdf}
                size="lg"
                className="w-full bg-teal-700 shadow-sm shadow-teal-900/15 transition-all duration-200 hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-md"
              >
                Open PDF Translator
              </Button>
            </CardContent>
          </Card>

          {/* Translation Settings */}
          <Card className="border-slate-200 bg-white shadow-sm animate-slide-up stagger-3">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5">
                <div className="rounded-2xl bg-slate-100 p-2">
                  <Globe className="w-5 h-5 text-slate-700" />
                </div>
                Translation Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 divide-y divide-slate-100">
              {/* Target Language */}
              <div className="-mx-6 flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50">
                <div>
                  <label className="font-semibold text-slate-900">Default Target Language</label>
                  <p className="mt-0.5 text-sm text-slate-600">
                    The language to translate text into
                  </p>
                </div>
                <Select
                  value={settings.targetLanguage}
                  onValueChange={(v) => updateSetting('targetLanguage', v)}
                >
                  <SelectTrigger className="w-36 border-slate-200 hover:border-teal-300 transition-colors">
                    <SelectValue>
                      {LANGUAGES.find((l) => l.value === settings.targetLanguage)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Selection Translation */}
              <div className="-mx-6 flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-blue-50 rounded-lg mt-0.5">
                    <Type className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-900">Selection Translation</label>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Show translate button when selecting text
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.selectionTransEnabled}
                  onCheckedChange={(v) => updateSetting('selectionTransEnabled', v)}
                  className="data-[state=checked]:bg-teal-500"
                />
              </div>

              {/* Page Translation */}
              <div className="-mx-6 flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-50 rounded-lg mt-0.5">
                    <Globe className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-900">Page Translation</label>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Enable full page translation feature
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.webTransEnabled}
                  onCheckedChange={(v) => updateSetting('webTransEnabled', v)}
                  className="data-[state=checked]:bg-teal-500"
                />
              </div>

              {/* Auto Speak */}
              <div className="-mx-6 flex items-center justify-between px-6 py-4 transition-colors hover:bg-slate-50">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-amber-50 rounded-lg mt-0.5">
                    <Volume2 className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-900">Auto Speak</label>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Automatically read translations aloud
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.autoSpeak}
                  onCheckedChange={(v) => updateSetting('autoSpeak', v)}
                  className="data-[state=checked]:bg-teal-500"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Blacklist */}
        <Card className="border-slate-200 bg-white shadow-sm animate-slide-up stagger-4">
          <CardHeader className="pb-4">
            <CardTitle>Site Blacklist</CardTitle>
            <CardDescription>Disable translation on these websites (one per line)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={blacklistText}
              onChange={(e) => setBlacklistText(e.target.value)}
              placeholder="example.com&#10;another-site.org"
              rows={4}
              className="resize-none border-slate-200 focus:border-teal-400 focus:ring-teal-200 font-mono text-sm"
            />
            <Button
              onClick={handleSaveBlacklist}
              variant="secondary"
              className="bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Save Blacklist
            </Button>
          </CardContent>
        </Card>

        {/* Reset */}
        <Card className="border-red-100 shadow-sm animate-slide-up stagger-5">
          <CardHeader className="pb-4">
            <CardTitle className="text-red-600 flex items-center gap-2.5">
              <div className="p-2 bg-red-50 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              Danger Zone
            </CardTitle>
            <CardDescription>
              Reset all settings to their default values (including API keys)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleResetSettings}
              className="transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              Reset All Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SettingsPage

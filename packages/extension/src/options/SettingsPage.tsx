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
  Languages,
  FileText,
  Trash2,
  Check,
  Zap,
  Globe,
  Type,
  Volume2,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  Bot,
} from 'lucide-react'

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

  const handleProviderSelect = useCallback(async (provider: ModelProvider) => {
    setSelectedProvider(provider)
    const defaultModel = PROVIDER_CONFIG[provider].defaultModel
    setSelectedModel(defaultModel)
    await Storage.setMultiple({
      selectedProvider: provider,
      selectedModel: defaultModel,
    })
    showSaved()
  }, [])

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 py-10 px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-10">
          <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-xl shadow-violet-500/25">
              <Languages className="w-9 h-9 text-white" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-400 rounded-full border-3 border-white flex items-center justify-center shadow-lg">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Mei Trans</h1>
            <p className="text-slate-500">AI-Powered Translation Settings</p>
          </div>
          {saved && (
            <div className="ml-auto flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full text-sm font-medium border border-emerald-100">
              <Check className="w-4 h-4" />
              Saved
            </div>
          )}
        </div>

        {/* AI Model Configuration */}
        <Card className="shadow-sm border-violet-200 bg-gradient-to-br from-violet-50/50 to-purple-50/50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-violet-800">
              <div className="p-2 bg-violet-100 rounded-xl">
                <Sparkles className="w-5 h-5 text-violet-600" />
              </div>
              AI Model Configuration
            </CardTitle>
            <CardDescription className="text-violet-600/70">
              Configure your preferred AI model for translation. Add an API key to enable AI
              translation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider API Keys */}
            <div className="space-y-3">
              {PROVIDERS.map((provider) => {
                const config = PROVIDER_CONFIG[provider]
                const hasKey = !!apiKeys[provider]
                const isVisible = visibleKeys.has(provider)
                const isSelected = selectedProvider === provider

                return (
                  <div
                    key={provider}
                    className={`p-4 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-violet-300 bg-violet-50/50'
                        : hasKey
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot
                          className={`w-4 h-4 ${hasKey ? 'text-emerald-500' : 'text-slate-400'}`}
                        />
                        <span className="font-medium text-slate-700">{config.name}</span>
                        {hasKey && (
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            Configured
                          </span>
                        )}
                        {isSelected && hasKey && (
                          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <a
                        href={config.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-400 hover:text-violet-500 flex items-center gap-1"
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
                          className="w-full pl-9 pr-10 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(provider)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {hasKey && (
                        <Button
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleProviderSelect(provider)}
                          className={isSelected ? 'bg-violet-500 hover:bg-violet-600' : ''}
                        >
                          {isSelected ? 'Selected' : 'Use'}
                        </Button>
                      )}
                    </div>
                    {/* Model selection for selected provider */}
                    {isSelected && hasKey && (
                      <div className="mt-3 pt-3 border-t border-violet-200/50">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">Model:</span>
                          <Select value={selectedModel || ''} onValueChange={handleModelSelect}>
                            <SelectTrigger className="flex-1 h-8 text-sm border-violet-200">
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
              <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-xl">
                <Key className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm">
                  No API keys configured. Add an API key above to enable AI translation.
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Machine translation is always available without API keys.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PDF Translation Card */}
        <Card className="border-violet-100 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 shadow-sm overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5 text-violet-800">
              <div className="p-2 bg-violet-100 rounded-xl">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              PDF Translation
            </CardTitle>
            <CardDescription className="text-violet-600/70">
              Translate PDF documents with AI-powered selection translation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={onOpenPdf}
              size="lg"
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/25"
            >
              Open PDF Translator
            </Button>
          </CardContent>
        </Card>

        {/* Translation Settings */}
        <Card className="shadow-sm border-slate-200/80">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Globe className="w-5 h-5 text-slate-600" />
              </div>
              Translation Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 divide-y divide-slate-100">
            {/* Target Language */}
            <div className="flex items-center justify-between py-4">
              <div>
                <label className="font-medium text-slate-800">Default Target Language</label>
                <p className="text-sm text-slate-500 mt-0.5">The language to translate text into</p>
              </div>
              <Select
                value={settings.targetLanguage}
                onValueChange={(v) => updateSetting('targetLanguage', v)}
              >
                <SelectTrigger className="w-36 border-slate-200">
                  <SelectValue>
                    {LANGUAGES.find((l) => l.value === settings.targetLanguage)?.flag}{' '}
                    {LANGUAGES.find((l) => l.value === settings.targetLanguage)?.label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
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
            <div className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-blue-50 rounded-lg mt-0.5">
                  <Type className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <label className="font-medium text-slate-800">Selection Translation</label>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Show translate button when selecting text
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.selectionTransEnabled}
                onCheckedChange={(v) => updateSetting('selectionTransEnabled', v)}
                className="data-[state=checked]:bg-violet-500"
              />
            </div>

            {/* Page Translation */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-emerald-50 rounded-lg mt-0.5">
                  <Globe className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <label className="font-medium text-slate-800">Page Translation</label>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Enable full page translation feature
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.webTransEnabled}
                onCheckedChange={(v) => updateSetting('webTransEnabled', v)}
                className="data-[state=checked]:bg-violet-500"
              />
            </div>

            {/* Auto Speak */}
            <div className="flex items-center justify-between py-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-amber-50 rounded-lg mt-0.5">
                  <Volume2 className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <label className="font-medium text-slate-800">Auto Speak</label>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Automatically read translations aloud
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.autoSpeak}
                onCheckedChange={(v) => updateSetting('autoSpeak', v)}
                className="data-[state=checked]:bg-violet-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Blacklist */}
        <Card className="shadow-sm border-slate-200/80">
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
              className="resize-none border-slate-200 focus:border-violet-300 focus:ring-violet-200"
            />
            <Button
              onClick={handleSaveBlacklist}
              variant="secondary"
              className="bg-slate-100 hover:bg-slate-200"
            >
              Save Blacklist
            </Button>
          </CardContent>
        </Card>

        {/* Reset */}
        <Card className="border-red-100 shadow-sm">
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
            <Button variant="destructive" onClick={handleResetSettings}>
              Reset All Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SettingsPage

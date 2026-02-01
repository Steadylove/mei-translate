/**
 * Settings Page Component
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
import Storage, { StorageData } from '@/services/storage'
import { Languages, FileText, Trash2, Check, Zap, Globe, Type, Volume2 } from 'lucide-react'

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

interface SettingsPageProps {
  onOpenPdf: () => void
}

const SettingsPage: React.FC<SettingsPageProps> = ({ onOpenPdf }) => {
  const [settings, setSettings] = useState<StorageData | null>(null)
  const [blacklistText, setBlacklistText] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Storage.getAllSettings().then((s) => {
      setSettings(s)
      setBlacklistText(s.blackList.join('\n'))
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
    if (confirm('Reset all settings to defaults?')) {
      await Storage.resetSettings()
      const newSettings = await Storage.getAllSettings()
      setSettings(newSettings)
      setBlacklistText(newSettings.blackList.join('\n'))
      showSaved()
    }
  }, [])

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
            <CardDescription>Reset all settings to their default values</CardDescription>
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

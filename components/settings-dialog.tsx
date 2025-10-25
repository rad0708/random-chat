"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Settings } from "lucide-react"

type SettingsType = {
  soundEnabled: boolean
  notificationsEnabled: boolean
  showTypingIndicator: boolean
  fontSize: number
}

const DEFAULT_SETTINGS: SettingsType = {
  soundEnabled: true,
  notificationsEnabled: true,
  showTypingIndicator: true,
  fontSize: 16,
}

export function SettingsDialog() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS)

  useEffect(() => {
    const saved = localStorage.getItem("chat-settings")
    if (saved) {
      setSettings(JSON.parse(saved))
    }
  }, [])

  const updateSetting = <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem("chat-settings", JSON.stringify(newSettings))

    // Dispatch custom event for other components to listen
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: newSettings }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <Settings className="w-4 h-4" />
          <span className="sr-only">설정</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription>채팅 환경을 설정하세요</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="fontSize">글자 크기</Label>
              <span className="text-sm text-muted-foreground">{settings.fontSize}px</span>
            </div>
            <Slider
              id="fontSize"
              min={12}
              max={24}
              step={1}
              value={[settings.fontSize]}
              onValueChange={([value]) => updateSetting("fontSize", value)}
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sound">소리 알림</Label>
              <p className="text-sm text-muted-foreground">메시지 수신 시 소리 재생</p>
            </div>
            <Switch
              id="sound"
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => updateSetting("soundEnabled", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications">알림</Label>
              <p className="text-sm text-muted-foreground">브라우저 알림 표시</p>
            </div>
            <Switch
              id="notifications"
              checked={settings.notificationsEnabled}
              onCheckedChange={(checked) => updateSetting("notificationsEnabled", checked)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="typing">입력 중 표시</Label>
              <p className="text-sm text-muted-foreground">상대에게 입력 중 상태 표시</p>
            </div>
            <Switch
              id="typing"
              checked={settings.showTypingIndicator}
              onCheckedChange={(checked) => updateSetting("showTypingIndicator", checked)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useSettings() {
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS)

  useEffect(() => {
    const saved = localStorage.getItem("chat-settings")
    if (saved) {
      setSettings(JSON.parse(saved))
    }

    const handleSettingsChange = (e: Event) => {
      const customEvent = e as CustomEvent<SettingsType>
      setSettings(customEvent.detail)
    }

    window.addEventListener("settings-changed", handleSettingsChange)
    return () => window.removeEventListener("settings-changed", handleSettingsChange)
  }, [])

  return settings
}

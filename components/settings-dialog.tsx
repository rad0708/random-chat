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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings, Trash2 } from "lucide-react"

type SettingsType = {
  soundEnabled: boolean
  showTypingIndicator: boolean
  fontSize: number
  bubbleStyle: "rounded" | "square"
}

const DEFAULT_SETTINGS: SettingsType = {
  soundEnabled: true,
  showTypingIndicator: true,
  fontSize: 16,
  bubbleStyle: "rounded",
}

export function SettingsDialog() {
  const [open, setOpen] = useState(false)
  const [settings, setSettings] = useState<SettingsType>(DEFAULT_SETTINGS)

  useEffect(() => {
    const saved = localStorage.getItem("chat-settings")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      } catch (error) {
        console.error("Failed to parse settings:", error)
        setSettings(DEFAULT_SETTINGS)
      }
    }
  }, [])

  const updateSetting = <K extends keyof SettingsType>(key: K, value: SettingsType[K]) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    localStorage.setItem("chat-settings", JSON.stringify(newSettings))

    window.dispatchEvent(new CustomEvent("settings-changed", { detail: newSettings }))
  }

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
    localStorage.setItem("chat-settings", JSON.stringify(DEFAULT_SETTINGS))
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: DEFAULT_SETTINGS }))
  }

  const clearChatHistory = () => {
    localStorage.removeItem("chat-history")
    window.dispatchEvent(new CustomEvent("chat-history-cleared"))
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 hover:bg-accent border border-border/40 hover:border-border"
        >
          <Settings className="w-4 h-4" />
          <span className="sr-only">설정</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription>채팅 환경을 설정하세요</DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">화면</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="fontSize" className="text-sm">
                  글자 크기
                </Label>
                <span className="text-sm text-muted-foreground font-medium">{settings.fontSize}px</span>
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

            <div className="space-y-2">
              <Label htmlFor="bubbleStyle" className="text-sm">
                말풍선 스타일
              </Label>
              <Select
                value={settings.bubbleStyle}
                onValueChange={(value: "rounded" | "square") => updateSetting("bubbleStyle", value)}
              >
                <SelectTrigger id="bubbleStyle" className="border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rounded">둥근 모서리</SelectItem>
                  <SelectItem value="square">각진 모서리</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 pt-2 border-t">
            <h3 className="text-sm font-semibold text-foreground">채팅</h3>

            <div className="flex items-center justify-between py-1">
              <div className="space-y-0.5">
                <Label htmlFor="sound" className="text-sm font-medium">
                  소리 알림
                </Label>
                <p className="text-xs text-muted-foreground">메시지 수신 시 소리 재생</p>
              </div>
              <Switch
                id="sound"
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => updateSetting("soundEnabled", checked)}
                className="data-[state=unchecked]:bg-muted data-[state=unchecked]:border data-[state=unchecked]:border-border"
              />
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="space-y-0.5">
                <Label htmlFor="typing" className="text-sm font-medium">
                  입력 중 표시
                </Label>
                <p className="text-xs text-muted-foreground">상대에게 입력 중 상태 표시</p>
              </div>
              <Switch
                id="typing"
                checked={settings.showTypingIndicator}
                onCheckedChange={(checked) => updateSetting("showTypingIndicator", checked)}
                className="data-[state=unchecked]:bg-muted data-[state=unchecked]:border data-[state=unchecked]:border-border"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <h3 className="text-sm font-semibold text-foreground">데이터</h3>

            <Button
              onClick={clearChatHistory}
              variant="outline"
              className="w-full justify-start gap-2 border-border/50 hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive transition-colors bg-transparent"
            >
              <Trash2 className="w-4 h-4" />
              채팅 기록 삭제
            </Button>

            <Button
              onClick={resetSettings}
              variant="outline"
              className="w-full border-border/50 hover:border-border bg-transparent"
            >
              설정 초기화
            </Button>
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
      try {
        const parsed = JSON.parse(saved)
        setSettings({ ...DEFAULT_SETTINGS, ...parsed })
      } catch (error) {
        console.error("Failed to parse settings:", error)
        setSettings(DEFAULT_SETTINGS)
      }
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

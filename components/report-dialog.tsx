"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { Flag } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type ReportReason = "spam" | "harassment" | "inappropriate" | "other"

export function ReportDialog() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>("spam")
  const [details, setDetails] = useState("")
  const { toast } = useToast()

  const handleSubmit = () => {
    // In a real app, this would send the report to the server
    console.log("[v0] Report submitted:", { reason, details })

    toast({
      title: "신고가 접수되었습니다",
      description: "검토 후 적절한 조치를 취하겠습니다.",
    })

    setOpen(false)
    setReason("spam")
    setDetails("")
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <Flag className="w-4 h-4" />
          <span className="sr-only">신고하기</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>사용자 신고</DialogTitle>
          <DialogDescription>부적절한 행동을 신고해주세요. 검토 후 조치하겠습니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>신고 사유</Label>
            <RadioGroup value={reason} onValueChange={(value) => setReason(value as ReportReason)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="spam" id="spam" />
                <Label htmlFor="spam" className="font-normal cursor-pointer">
                  스팸 / 광고
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="harassment" id="harassment" />
                <Label htmlFor="harassment" className="font-normal cursor-pointer">
                  괴롭힘 / 욕설
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inappropriate" id="inappropriate" />
                <Label htmlFor="inappropriate" className="font-normal cursor-pointer">
                  부적절한 콘텐츠
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other" className="font-normal cursor-pointer">
                  기타
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="details">상세 내용 (선택)</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="추가 정보를 입력해주세요..."
              className="min-h-[100px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={handleSubmit}>신고하기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

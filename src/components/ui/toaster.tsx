"use client"

import { AlertCircle, Bell, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"

// The variant tints only this chip; the card itself stays light (toast.tsx).
const VARIANT_ICON = {
  default: { Icon: Bell, tone: "bg-primary/15 text-primary-deep" },
  destructive: { Icon: AlertCircle, tone: "bg-red-500/10 text-red-600 dark:text-red-400" },
  success: { Icon: CheckCircle2, tone: "bg-green-500/10 text-green-600 dark:text-green-400" },
} as const

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        const { Icon, tone } = VARIANT_ICON[props.variant ?? "default"]
        return (
          <Toast key={id} {...props}>
            <span
              aria-hidden
              className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", tone)}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

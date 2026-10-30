"use client"

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { createPortal } from "react-dom"
import { useEffect, useState } from "react"

import { useAuth } from "@/context/AuthContext"
import { useToastPosition } from "@/hooks/use-toast-position"

/**
 * Cuánto queda un toast en pantalla. Es el único número que gobierna la duración de
 * todo el sistema: ningún call site pasa `duration` propio. Radix aplicaría 5000ms
 * por defecto si no se configurara acá.
 */
export const TOAST_DURATION = 2500

// Icono por variante. `default` no lleva icono: es el toast neutro/informativo sin color y
// meterle uno lo haría competir visualmente con los que sí tienen semántica.
const VARIANT_ICONS = {
  destructive: AlertCircle,
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
} as const

export function Toaster() {
  const { toasts } = useToast()
  const { user } = useAuth()
  // El Toaster está montado en `[locale]/layout.tsx` dentro de AuthProvider pero FUERA de
  // NextIntlClientProvider: `useAuth` funciona, `useTranslations` no — no agregar texto traducido.
  const [position] = useToastPosition(user?.id)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) {
    return null
  }

  return createPortal(
    // `swipeDirection` es un valor único global y no puede ser responsive sin JS. El horizontal
    // funciona igual en las 4 posiciones; `up` quedaría invertido para las de abajo.
    <ToastProvider swipeDirection="right" duration={TOAST_DURATION}>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const Icon = variant ? VARIANT_ICONS[variant as keyof typeof VARIANT_ICONS] : undefined

        return (
          // Radix renderiza los Toast como hermanos del Viewport, no como hijos, así que la
          // posición hay que pasarla a los dos por separado.
          <Toast key={id} variant={variant} position={position} {...props}>
            {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />}
            <div className="grid min-w-0 flex-1 gap-1">
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
      <ToastViewport position={position} />
    </ToastProvider>,
    document.body
  )
}

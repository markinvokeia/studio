"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ToastPosition } from "@/lib/types"

const ToastProvider = ToastPrimitives.Provider

// El caso base ancla el viewport arriba al centro, que es lo que se muestra siempre en pantallas
// chicas: abajo chocaría con la barra del navegador y con los botones fijos. La preferencia del
// usuario solo entra desde `sm:`, y cada posición neutraliza explícitamente lo que hereda del base
// (`sm:top-auto`, `sm:left-auto`, `sm:translate-x-0`) para no depender del orden de las clases.
//
// OJO: en tailwind-merge los grupos `left`/`right` colisionan con `inset-x`/`inset`. Si alguien
// agrega un `sm:inset-x-0` acá, los `sm:left-auto sm:right-16` se descartan en silencio.
const toastViewportVariants = cva(
  // `pointer-events-none` en el viewport: aunque esté vacío ocupa una franja fija sobre todo
  // el ancho y con `auto` se tragaba los toques de la barra superior en mobile. Cada toast
  // reactiva los eventos por su cuenta (ver `pointer-events-auto` en toastVariants).
  "fixed top-0 left-1/2 -translate-x-1/2 z-[9999] flex max-h-screen w-full flex-col p-4 pt-[max(1rem,env(safe-area-inset-top))] pointer-events-none sm:max-w-[420px]",
  {
    variants: {
      // `flex-col` arriba y `flex-col-reverse` abajo: el array de toasts es
      // [másNuevo, ...másViejos], así que esto deja el más nuevo pegado al borde de la pantalla.
      position: {
        "top-center": "",
        "top-right": "sm:left-auto sm:right-16 sm:translate-x-0",
        "bottom-center":
          "sm:top-auto sm:bottom-0 sm:flex-col-reverse sm:pt-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
        "bottom-right":
          "sm:top-auto sm:bottom-0 sm:left-auto sm:right-16 sm:translate-x-0 sm:flex-col-reverse sm:pt-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))]",
      } satisfies Record<ToastPosition, string>,
    },
    defaultVariants: {
      position: "top-center",
    },
  }
)

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport> &
    VariantProps<typeof toastViewportVariants>
>(({ className, position, ...props }, ref) => (
  // `position` se desestructura antes del spread: no es un atributo DOM válido y Radix lo
  // reenviaría al <ol>.
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(toastViewportVariants({ position }), className)}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-start justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-top-full data-[state=open]:slide-in-from-top-full z-[9999]",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
        // `toast-filled` es el marcador que usan `ToastClose` y `ToastAction` para adaptarse a
        // un fondo de color saturado (igual que `destructive` con sus propios overrides).
        // Los tonos -700 se eligen para que el texto blanco cumpla contraste AA (>=4.5:1);
        // green-600 / amber-600 / blue-600 no llegan.
        success:
          "toast-filled group border-green-700 bg-green-700 text-white dark:border-green-800 dark:bg-green-800",
        warning:
          "toast-filled group border-amber-700 bg-amber-700 text-white dark:border-amber-800 dark:bg-amber-800",
        info:
          "toast-filled group border-blue-700 bg-blue-700 text-white dark:border-blue-800 dark:bg-blue-800",
      },
      // Solo el eje Y. `tailwindcss-animate` mapea `slide-in-from-top-*` y `slide-in-from-bottom-*`
      // a la misma custom property (`--tw-enter-translate-y`), así que el override `sm:` reemplaza
      // limpiamente el valor del base; mezclar ejes produciría una entrada diagonal.
      position: {
        "top-center": "",
        "top-right": "",
        "bottom-center":
          "sm:data-[state=open]:slide-in-from-bottom-full sm:data-[state=closed]:slide-out-to-bottom-full",
        "bottom-right":
          "sm:data-[state=open]:slide-in-from-bottom-full sm:data-[state=closed]:slide-out-to-bottom-full",
      } satisfies Record<ToastPosition, string>,
    },
    defaultVariants: {
      variant: "default",
      position: "top-center",
    },
  }
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, position, ...props }, ref) => {
  return (
    // `position` se desestructura antes del spread: no es un atributo DOM válido y Radix lo
    // reenviaría al <li>.
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant, position }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive group-[.toast-filled]:border-white/30 group-[.toast-filled]:hover:bg-white/10 group-[.toast-filled]:hover:text-white group-[.toast-filled]:focus:ring-white/50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600 group-[.toast-filled]:text-white/70 group-[.toast-filled]:hover:text-white group-[.toast-filled]:focus:ring-white/50",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}

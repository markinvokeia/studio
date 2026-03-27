
"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const dialogWindowControlClassName =
  "group inline-flex h-7 w-7 items-center justify-center rounded-full text-accent-foreground opacity-70 ring-offset-background transition-all hover:bg-white/10 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

const MacExpandIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M6.25 9.75 3.5 12.5" />
    <path d="M9.75 6.25 12.5 3.5" />
    <path d="M10.25 3.5H12.5V5.75" />
    <path d="M5.75 12.5H3.5V10.25" />
  </svg>
)

const MacRestoreIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    <path d="M3.5 12.5 6.25 9.75" />
    <path d="M12.5 3.5 9.75 6.25" />
    <path d="M3.5 10.25V12.5H5.75" />
    <path d="M12.5 5.75V3.5H10.25" />
  </svg>
)

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full";
    showMaximize?: boolean;
    maximizeLabel?: string;
    restoreLabel?: string;
  }
>(({ className, children, maxWidth = "lg", showMaximize = false, maximizeLabel = "Maximize", restoreLabel = "Restore", ...props }, ref) => {
  const [isMaximized, setIsMaximized] = React.useState(false)

  const maxWidthClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-full",
  };

  const sizeToggleLabel = isMaximized ? restoreLabel : maximizeLabel

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-maximized={isMaximized ? "true" : "false"}
        className={cn(
          "group/dialog fixed z-50 flex flex-col gap-0 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 overflow-hidden transition-all",
          "left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]",
          className,
          isMaximized
            ? "h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] rounded-xl"
            : cn("w-full max-h-[92vh] sm:rounded-md", maxWidthClasses[maxWidth] || "max-w-lg")
        )}
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
        onInteractOutside={(event) => {
          event.preventDefault();
        }}
        {...props}
      >
        <div className="flex flex-col flex-1 overflow-hidden relative">
          {children}

          <div className="absolute right-4 top-0 flex h-14 items-center gap-1">
            {showMaximize && (
              <button
                type="button"
                className={dialogWindowControlClassName}
                onClick={() => setIsMaximized((currentValue) => !currentValue)}
                aria-label={sizeToggleLabel}
                title={sizeToggleLabel}
              >
                {isMaximized ? (
                  <MacRestoreIcon className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-125" strokeWidth={1.9} />
                ) : (
                  <MacExpandIcon className="h-3.5 w-3.5 transition-transform duration-150 group-hover:scale-125" strokeWidth={1.9} />
                )}
                <span className="sr-only">{sizeToggleLabel}</span>
              </button>
            )}
            <DialogPrimitive.Close className={dialogWindowControlClassName}>
              <X className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-0.5 pr-24 pl-6 py-3 bg-accent text-accent-foreground shrink-0 relative overflow-hidden",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  align = "right",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { align?: "left" | "right" }) => (
  <div
    className={cn(
      "flex w-full flex-col-reverse items-center border-t bg-muted/10 px-6 py-4 shrink-0 sm:flex-row sm:space-x-2",
      align === "right" ? "sm:justify-end" : "sm:justify-start",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-bold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-accent-foreground/80 font-normal", className)}
    {...props}
  />
))
DialogDescription.displayName =
  DialogPrimitive.Description.displayName

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex-1 overflow-y-auto w-full max-h-[calc(92vh-140px)]", className)} {...props} />
)
DialogBody.displayName = "DialogBody"

export {
  Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger
}

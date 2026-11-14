
import { type ComponentPropsWithoutRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode
  className?: string
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string
  className: string
  background: ReactNode
  Icon: React.ElementType
  description: string
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-3 gap-4",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  ...props
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl",
      "bg-[var(--color-surface)]",
      "border border-[var(--color-border)]",
      "transform-gpu transition-all duration-300",
      "hover:border-[var(--color-primary)]/50",
      className
    )}
    {...props}
  >
    {/* Background */}
    <div className="absolute inset-0">
      {background}
    </div>

    {/* Feature Content */}
    <div className="relative z-10 mt-auto p-6">

      {/* Icon */}
      <Icon className="mb-5 h-14 w-14 text-[#7C5CFF]" />

      {/* Title */}
      <h3 className="mb-3 text-xl font-semibold text-white [font-family:var(--font-heading)]">
        {name}
      </h3>

      {/* Description */}
      <p className="max-w-lg text-sm leading-7 text-[#C4C4CC]">
        {description}
      </p>

    </div>
  </div>
)

export { BentoCard, BentoGrid }

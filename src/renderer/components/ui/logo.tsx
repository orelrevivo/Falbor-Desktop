import * as React from "react"
import { cn } from "../../lib/utils"
import logoUrl from "../../assets/app-icons/Falmodels.svg"

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string
  fill?: string
}

export function Logo({ fill, className, ...props }: LogoProps) {
  // Small logo size
  const logoSize = {
    width: "24px",
    height: "24px",
  }

  // If fill is provided and not currentColor, use mask to create a monochrome version
  if (fill && fill !== "currentColor") {
    return (
      <div
        className={cn("inline-block", className)}
        style={{
          ...logoSize,
          maskImage: `url(${logoUrl})`,
          WebkitMaskImage: `url(${logoUrl})`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          maskSize: "contain",
          WebkitMaskSize: "contain",
          backgroundColor: fill,
        }}
        role="img"
        aria-label="Falbor logo"
      />
    )
  }

  // Otherwise show the multi-color original logo
  return (
    <img
      src={logoUrl}
      alt="Falbor logo"
      className={cn("object-contain", className)}
      style={logoSize}
      {...props}
    />
  )
}
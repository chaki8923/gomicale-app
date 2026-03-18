'use client'

import { haptic } from '@/lib/haptic'
import { type ButtonHTMLAttributes, forwardRef } from 'react'

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    return (
      <button
        ref={ref}
        onClick={(e) => {
          haptic()
          onClick?.(e)
        }}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

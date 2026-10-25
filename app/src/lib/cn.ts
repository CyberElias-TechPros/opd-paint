import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Conditional + de-duplicated class names. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, size = 6): string {
  return address.length > size * 2 + 3
    ? `${address.slice(0, size)}…${address.slice(-size)}`
    : address;
}

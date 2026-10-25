import { Building2, HandCoins, ReceiptText, Shapes, Wheat, Zap, type LucideIcon } from "lucide-react";

export const ASSET_ICONS: Record<string, LucideIcon> = {
  real_estate: Building2,
  private_credit: HandCoins,
  invoices: ReceiptText,
  agriculture: Wheat,
  energy: Zap,
  other: Shapes,
};

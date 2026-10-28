import {
  AlertTriangle, Car, FileText, Flame, Gauge, Gift, Headset, HelpCircle, Home, Phone, Route, ShieldCheck,
  ShoppingBag, Smartphone, Sun, ToggleRight, Truck, User, Wallet, XCircle, Zap, type LucideIcon,
} from "lucide-react";

/** One icon family (lucide), referenced by name from config. */
export const ICONS: Record<string, LucideIcon> = {
  home: Home, gift: Gift, route: Route, help: HelpCircle, gauge: Gauge, wallet: Wallet, file: FileText,
  truck: Truck, user: User, shield: ShieldCheck, alert: AlertTriangle, toggle: ToggleRight, phone: Phone,
  headset: Headset, x: XCircle, electricity: Zap, gas: Flame, mobile: Smartphone, autostrom: Car, hems: Sun, shop: ShoppingBag,
};

export const STROKE = 1.75;

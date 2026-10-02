import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { Course } from '../data/courses'

export const PREMIUM_MONTHLY_ID = 'com.ilyaivasyk.debut.pro.monthly'
export const PREMIUM_YEARLY_ID = 'com.ilyaivasyk.debut.pro.yearly'

export type PremiumProduct = { id: string; displayName: string; displayPrice: string }
export type PurchaseResult = 'purchased' | 'cancelled' | 'pending'

type PremiumPurchasesPlugin = {
  getStatus(): Promise<{ active: boolean }>
  getProducts(): Promise<{ products: PremiumProduct[] }>
  purchase(options: { productId: string }): Promise<{ result: PurchaseResult }>
  restore(): Promise<{ active: boolean }>
  getPremiumCourses(options: { locale: 'uk' | 'en' }): Promise<{ courses: Course[] }>
  addListener(eventName: 'premiumStatusChanged', listener: (event: { active: boolean }) => void): Promise<PluginListenerHandle>
}

const native = registerPlugin<PremiumPurchasesPlugin>('PremiumPurchases')

export const isNativeIOS = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'

function requireNativeIOS() {
  if (!isNativeIOS()) throw new Error('Purchases are available only in the iOS app.')
}

export async function getPremiumStatus(): Promise<boolean> {
  if (!isNativeIOS()) return false
  return (await native.getStatus()).active
}

export async function getPremiumProducts(): Promise<PremiumProduct[]> {
  if (!isNativeIOS()) return []
  return (await native.getProducts()).products
}

export async function purchasePremium(productId: string): Promise<PurchaseResult> {
  requireNativeIOS()
  if (productId !== PREMIUM_MONTHLY_ID && productId !== PREMIUM_YEARLY_ID) {
    throw new Error('Unknown subscription product.')
  }
  return (await native.purchase({ productId })).result
}

export async function restorePurchases(): Promise<boolean> {
  requireNativeIOS()
  return (await native.restore()).active
}

export async function getPremiumCourses(locale: 'uk' | 'en'): Promise<Course[]> {
  requireNativeIOS()
  return (await native.getPremiumCourses({ locale })).courses
}

export async function onPremiumStatusChange(listener: (active: boolean) => void): Promise<() => void> {
  if (!isNativeIOS()) return () => {}
  const handle = await native.addListener('premiumStatusChanged', ({ active }) => listener(active))
  return () => { void handle.remove() }
}

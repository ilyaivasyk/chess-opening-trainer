import Capacitor
import StoreKit
import UIKit

@objc(PremiumPurchasesPlugin)
public class PremiumPurchasesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PremiumPurchasesPlugin"
    public let jsName = "PremiumPurchases"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getPremiumCourses", returnType: CAPPluginReturnPromise)
    ]

    private static let monthlyID = "com.ilyaivasyk.debut.pro.monthly"
    private static let yearlyID = "com.ilyaivasyk.debut.pro.yearly"
    private static let productIDs: Set<String> = [monthlyID, yearlyID]
    private var updatesTask: Task<Void, Never>?
    private var foregroundObserver: NSObjectProtocol?
    private var lastStatus: Bool?

    @objc override public func load() {
        updatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard let self else { return }
                if case .verified(let transaction) = result,
                   Self.productIDs.contains(transaction.productID) {
                    _ = await self.refreshStatus()
                    await transaction.finish()
                }
            }
        }

        foregroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { [weak self] in _ = await self?.refreshStatus() }
        }
        Task { _ = await refreshStatus() }
    }

    deinit {
        updatesTask?.cancel()
        if let foregroundObserver {
            NotificationCenter.default.removeObserver(foregroundObserver)
        }
    }

    private func hasPremiumEntitlement() async -> Bool {
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            if Self.productIDs.contains(transaction.productID) && transaction.revocationDate == nil {
                // StoreKit excludes expired subscriptions and includes billing grace periods.
                return true
            }
        }
        return false
    }

    @discardableResult
    private func refreshStatus() async -> Bool {
        let active = await hasPremiumEntitlement()
        await MainActor.run {
            if lastStatus != active {
                lastStatus = active
                notifyListeners("premiumStatusChanged", data: ["active": active])
            }
        }
        return active
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        Task { call.resolve(["active": await refreshStatus()]) }
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: Self.productIDs)
                let byID = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
                let details = [Self.monthlyID, Self.yearlyID].compactMap { id -> [String: String]? in
                    guard let product = byID[id] else { return nil }
                    return ["id": product.id, "displayName": product.displayName, "displayPrice": product.displayPrice]
                }
                call.resolve(["products": details])
            } catch {
                call.reject(error.localizedDescription, "PRODUCT_LOAD_FAILED")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productID = call.getString("productId"), Self.productIDs.contains(productID) else {
            call.reject("Unknown subscription product.", "INVALID_PRODUCT")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: [productID])
                guard let product = products.first else {
                    call.reject("Subscription is unavailable.", "PRODUCT_UNAVAILABLE")
                    return
                }
                switch try await product.purchase() {
                case .success(let verification):
                    guard case .verified(let transaction) = verification,
                          transaction.productID == productID,
                          transaction.revocationDate == nil else {
                        call.reject("StoreKit could not verify the purchase.", "UNVERIFIED_PURCHASE")
                        return
                    }
                    guard await refreshStatus() else {
                        call.reject("Purchase completed, but the subscription is not active yet. Try Restore Purchases.", "ENTITLEMENT_NOT_ACTIVE")
                        return
                    }
                    call.resolve(["result": "purchased"])
                    await transaction.finish()
                case .userCancelled:
                    call.resolve(["result": "cancelled"])
                case .pending:
                    call.resolve(["result": "pending"])
                @unknown default:
                    call.reject("Unknown StoreKit purchase result.", "UNKNOWN_PURCHASE_RESULT")
                }
            } catch {
                call.reject(error.localizedDescription, "PURCHASE_FAILED")
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                // AppStore.sync() prompts for authentication; call only from Restore Purchases.
                try await AppStore.sync()
                call.resolve(["active": await refreshStatus()])
            } catch {
                call.reject(error.localizedDescription, "RESTORE_FAILED")
            }
        }
    }

    @objc func getPremiumCourses(_ call: CAPPluginCall) {
        guard let locale = call.getString("locale"), locale == "uk" || locale == "en" else {
            call.reject("Unsupported locale.", "INVALID_LOCALE")
            return
        }

        Task {
            guard await refreshStatus() else {
                call.reject("An active subscription is required.", "NOT_ENTITLED")
                return
            }
            guard let url = Bundle.main.url(forResource: "native-premium", withExtension: "json") else {
                call.reject("Premium lessons are missing from the app.", "CONTENT_MISSING")
                return
            }
            do {
                let data = try Data(contentsOf: url)
                guard let catalog = try JSONSerialization.jsonObject(with: data) as? [String: [[String: Any]]],
                      let courses = catalog[locale] else {
                    call.reject("Premium lessons are invalid.", "CONTENT_INVALID")
                    return
                }
                call.resolve(["courses": courses])
            } catch {
                call.reject(error.localizedDescription, "CONTENT_READ_FAILED")
            }
        }
    }
}

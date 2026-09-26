import Capacitor

class PremiumBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PremiumPurchasesPlugin())
    }
}

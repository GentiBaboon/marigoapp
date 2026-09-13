import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        configureFirebase()
        return true
    }

    /// Brings up the Firebase iOS SDK, which backs both push (FirebaseMessaging)
    /// and Sign in with Apple (FirebaseAuth through
    /// @capacitor-firebase/authentication).
    ///
    /// Guarded on the plist rather than called unconditionally: `configure()`
    /// raises an uncatchable Objective-C exception when GoogleService-Info.plist
    /// is missing, so the app would crash on launch rather than merely going
    /// without push. The guard costs one bundle lookup and turns that into a
    /// degraded feature.
    ///
    /// The plist is gitignored (it carries an unrestricted Google API key and
    /// this repository is public — see .gitignore), and it is a member of the
    /// App target's Resources phase, so a fresh clone fails at *build* time
    /// with "Build input file cannot be found" until it is downloaded from the
    /// Firebase console. This guard covers the other way it goes missing: the
    /// file present on disk but not in the target, which builds cleanly and
    /// ships an app that cannot register for push.
    private func configureFirebase() {
        guard FirebaseApp.app() == nil else { return }
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            NSLog("[Marigo] GoogleService-Info.plist is missing — push notifications and Apple sign-in are disabled in this build.")
            return
        }
        FirebaseApp.configure()
    }

    // MARK: - Remote notifications
    //
    // @capacitor/push-notifications listens on NotificationCenter rather than
    // implementing UIApplicationDelegate itself, so these two methods are the
    // only bridge between APNs and the JavaScript `registration` /
    // `registrationError` events. Without them `PushNotifications.register()`
    // resolves and then nothing ever arrives — the failure mode is silence, not
    // an error.

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        // APNs issues the device token; FCM issues the token the server actually
        // sends to. Handing the APNs token to Messaging and forwarding the *FCM*
        // token is what lets one firebase-admin call reach both platforms.
        guard FirebaseApp.app() != nil else {
            // No Firebase in this build. Forward the raw APNs token so the
            // plugin still reports success — Capacitor accepts either Data or
            // String here — rather than leaving the caller waiting forever.
            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
            return
        }

        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let token = token {
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            } else {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // MARK: - Lifecycle

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

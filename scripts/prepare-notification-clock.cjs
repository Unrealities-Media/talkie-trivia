const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")

// Reviewed against expo-notifications 57.0.22 (MIT). Apply during Android CNG
// generation, including EAS; never rely on an unrecorded node_modules edit.
const version = "57.0.23"
const changes = [
  {
    file: "android/src/main/java/expo/modules/notifications/service/NotificationsService.kt",
    sha256: "77b498370167e32d1dc724f61834c31bca3985d041c31fd6cf76118a69691b10",
    replacements: [
      ['    const val NOTIFICATION_EVENT_ACTION = "expo.modules.notifications.NOTIFICATION_EVENT"',
        '    // Talkie: serialize clock repair with schedule/cancel operations.\n    private val DISPATCH_LOCK = Any()\n    const val NOTIFICATION_EVENT_ACTION = "expo.modules.notifications.NOTIFICATION_EVENT"'],
      ['      Intent.ACTION_BOOT_COMPLETED,',
        '      Intent.ACTION_BOOT_COMPLETED,\n      Intent.ACTION_TIME_CHANGED,\n      Intent.ACTION_TIMEZONE_CHANGED,'],
      ['        intent?.run { handleIntent(context, intent) }',
        '        synchronized(DISPATCH_LOCK) {\n          intent?.run { handleIntent(context, intent) }\n        }'],
    ],
  },
  {
    file: "android/src/main/AndroidManifest.xml",
    sha256: "08d7b7174ad2a11749980f2b759244afd66c95a8832b910ecc0067d6cfd98730",
    replacements: [
      ['        <action android:name="android.intent.action.BOOT_COMPLETED" />',
        '        <action android:name="android.intent.action.BOOT_COMPLETED" />\n        <action android:name="android.intent.action.TIME_SET" />\n        <action android:name="android.intent.action.TIMEZONE_CHANGED" />'],
    ],
  },
]
const hash = source => crypto.createHash("sha256").update(source).digest("hex")
function once(source, before, after) {
  if (source.split(before).length !== 2) throw new Error("Notification clock patch structure changed; review the installed SDK.")
  return source.replace(before, after)
}
function originalSource(source, change) {
  source = source.replace(/\r\n/g, "\n")
  if (hash(source) === change.sha256) return source
  const original = change.replacements.reduce((text, [before, after]) => once(text, after, before), source)
  if (hash(original) !== change.sha256) throw new Error(`Notification SDK source changed: ${change.file}. Review the clock patch before building.`)
  return original
}
function patchedSource(source, change) {
  return change.replacements.reduce((text, [before, after]) => once(text, before, after), originalSource(source, change))
}
function prepareNotificationClock(projectRoot) {
  const project = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"))
  const sourceModules = project.expo?.autolinking?.android?.buildFromSource
  if (!Array.isArray(sourceModules) || !sourceModules.includes("expo-notifications")) {
    throw new Error("Notification clock support requires expo.autolinking.android.buildFromSource to include expo-notifications; prebuilt modules omit the patch.")
  }
  const packageFile = require.resolve("expo-notifications/package.json", { paths: [projectRoot] })
  const installed = JSON.parse(fs.readFileSync(packageFile, "utf8"))
  if (installed.version !== version) throw new Error(`Review notification clock support for expo-notifications ${installed.version}; expected ${version}.`)
  const directory = path.dirname(packageFile)
  // Validate the complete patch before writing either dependency file.
  const plan = changes.map(change => {
    const target = path.join(directory, change.file)
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error("Refusing to patch a linked notification source file.")
    const source = fs.readFileSync(target, "utf8")
    return { target, source, result: patchedSource(source, change) }
  })
  for (const { target, source, result } of plan) if (source !== result) fs.writeFileSync(target, result)
  return { version, files: plan.map(({ target, result }) => ({ path: path.relative(directory, target), sha256: hash(result) })) }
}
module.exports = { prepareNotificationClock, originalSource, patchedSource, changes, version }

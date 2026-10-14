const { test } = require("node:test")
const assert = require("node:assert/strict")
const { readEnvironment } = require("../config/appEnvironment.cjs")
const { removeDebugReleaseSigning } = require("../plugins/withReleaseSigning.cjs")
const { configureAndroidPageSize, ndkVersion } = require("../plugins/withAndroidPageSize.cjs")

const live = {
  FIREBASE_PROJECTID: "talkie-production", FIREBASE_PROJECTID_PREVIEW: "talkie-staging",
  FIREBASE_APIKEY: "prod-key", FIREBASE_APIKEY_PREVIEW: "staging-key",
  FIREBASE_APPID: "prod-app", FIREBASE_APPID_PREVIEW: "staging-app",
  FIREBASE_MESSAGING_SENDERID: "111", FIREBASE_MESSAGING_SENDERID_PREVIEW: "222",
  CLIENTID_IOS: "111-ios.apps.googleusercontent.com", CLIENTID_ANDROID: "111-android.apps.googleusercontent.com", CLIENTID_WEB: "111-web.apps.googleusercontent.com",
  CLIENTID_IOS_PREVIEW: "222-ios.apps.googleusercontent.com", CLIENTID_ANDROID_PREVIEW: "222-android.apps.googleusercontent.com", CLIENTID_WEB_PREVIEW: "222-web.apps.googleusercontent.com",
}

test("local defaults are demo-only and do not inherit production credentials", () => {
  const env = readEnvironment(live)
  assert.equal(env.variant, "development"); assert.equal(env.emulator, true)
  assert.equal(env.firebase.projectId, "demo-talkie-trivia"); assert.equal(env.firebase.apiKey, "demo-api-key")
  assert.equal(env.googleConfigured, false)
  assert.throws(() => readEnvironment({ FIREBASE_PROJECTID_DEV: live.FIREBASE_PROJECTID }), /demo-/)
})
test("preview and production have separate identity, URL schemes and Firebase/OAuth values", () => {
  const preview = readEnvironment({ ...live, APP_VARIANT: "preview" })
  const production = readEnvironment({ ...live, APP_VARIANT: "production" })
  assert.notEqual(preview.id, production.id); assert.notEqual(preview.scheme, production.scheme)
  assert.equal(preview.firebase.apiKey, "staging-key"); assert.equal(preview.google.iosClientId, live.CLIENTID_IOS_PREVIEW)
  assert.equal(production.firebase.apiKey, "prod-key"); assert.equal(preview.emulator, false)
})
test("live builds fail closed on missing configuration or shared project IDs", () => {
  assert.throws(() => readEnvironment({ ...live, APP_VARIANT: "preview", FIREBASE_APIKEY_PREVIEW: "" }), /Missing preview/)
  assert.throws(() => readEnvironment({ ...live, APP_VARIANT: "preview", FIREBASE_PROJECTID_PREVIEW: live.FIREBASE_PROJECTID }), /distinct/)
  assert.throws(() => readEnvironment({ ...live, APP_VARIANT: "production", FIREBASE_PROJECTID_PREVIEW: "" }), /distinct/)
  assert.throws(() => readEnvironment({ ...live, APP_VARIANT: "production", CLIENTID_IOS: "bad-id" }), /OAuth/)
})
test("unknown variants, bypass flags and ambiguous EAS builds are rejected", () => {
  assert.throws(() => readEnvironment({ APP_VARIANT: "prodution" }), /APP_VARIANT/)
  assert.throws(() => readEnvironment({ IS_E2E: "true" }), /bypasses/)
  assert.throws(() => readEnvironment({ EAS_BUILD: "true" }), /explicit/)
})
test("physical-device emulator host is explicit and cannot inject a URL path", () => {
  assert.equal(readEnvironment({ FIREBASE_EMULATOR_HOST: "192.168.1.10" }).emulatorHost, "192.168.1.10")
  assert.throws(() => readEnvironment({ FIREBASE_EMULATOR_HOST: "https://other/" }), /hostname/)
})
test("release signing removes only the release debug fallback and rejects template drift", () => {
  const source = "buildTypes { debug { signingConfig signingConfigs.debug } release { signingConfig signingConfigs.debug } }"
  const result = removeDebugReleaseSigning(source)
  assert.match(result, /debug \{ signingConfig signingConfigs.debug/)
  assert.match(result, /release \{[\s\S]*signingConfig null/)
  assert.equal(removeDebugReleaseSigning(result), result)
  assert.throws(() => removeDebugReleaseSigning("unrecognized template"), /template changed/)
})

test("native page-size config precedes Expo defaults, is idempotent and rejects template drift", () => {
  const source = 'buildscript { }\napply plugin: "expo-root-project"\napply plugin: "com.facebook.react.rootproject"'
  const configured = configureAndroidPageSize(source)
  assert.ok(configured.indexOf("ext.ndkVersion =") < configured.indexOf('apply plugin: "expo-root-project"'))
  assert.equal(configureAndroidPageSize(configured), configured)
  assert.equal(configureAndroidPageSize(configured.replace(`ext.ndkVersion = "${ndkVersion}"`, 'ext.ndkVersion = "27.0.12077973"')), configured)
  assert.throws(() => configureAndroidPageSize(configured.replace("// End Talkie: 16 KB native page-size configuration", "")), /regenerate/)
  assert.throws(() => configureAndroidPageSize("new Gradle template"), /template changed/)
})

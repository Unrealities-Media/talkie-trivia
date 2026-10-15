const variants = {
  development: { suffix: "_DEV", name: "Talkie Dev", id: "com.unrealities.talkietrivia.dev", scheme: "talkie-trivia-dev" },
  preview: { suffix: "_PREVIEW", name: "Talkie Preview", id: "com.unrealities.talkietrivia.preview", scheme: "talkie-trivia-preview" },
  production: { suffix: "", name: "Talkie Trivia", id: "com.unrealities.talkietrivia", scheme: "talkie-trivia" },
}

function readEnvironment(env = process.env) {
  if (env.EAS_BUILD === "true" && !env.APP_VARIANT) throw new Error("EAS builds require an explicit APP_VARIANT.")
  const variant = env.APP_VARIANT || "development"
  if (!Object.hasOwn(variants, variant)) throw new Error("APP_VARIANT must be development, preview or production.")
  const identity = variants[variant]
  const webBeta = env.WEB_BETA === "true"
  if (webBeta && (variant !== "preview" || env.EAS_BUILD === "true")) throw new Error("WEB_BETA is only supported for preview web exports.")
  const read = name => env[`${name}${identity.suffix}`]?.trim() || undefined
  if (env.IS_E2E && env.IS_E2E !== "false") throw new Error("E2E authentication bypasses are not supported in app builds.")
  const emulator = variant === "development"
  const firebase = {
    apiKey: read("FIREBASE_APIKEY"), appId: read("FIREBASE_APPID"),
    messagingSenderId: read("FIREBASE_MESSAGING_SENDERID"), projectId: read("FIREBASE_PROJECTID"),
  }
  const google = { iosClientId: read("CLIENTID_IOS"), webClientId: read("CLIENTID_WEB"), androidClientId: read("CLIENTID_ANDROID") }
  if (emulator) {
    firebase.projectId ||= "demo-talkie-trivia"
    firebase.apiKey ||= "demo-api-key"
    firebase.appId ||= "1:1234567890:web:demo"
    firebase.messagingSenderId ||= "1234567890"
    if (!firebase.projectId.startsWith("demo-")) throw new Error("Development builds require a demo- Firebase project; use preview for a live staging project.")
  } else {
    for (const [key, value] of Object.entries({ ...firebase, ...(webBeta ? { webClientId: google.webClientId } : google) })) {
      if (!value) throw new Error(`Missing ${variant} configuration: ${key}. See .env.example.`)
    }
    if (firebase.projectId.startsWith("demo-")) throw new Error("Preview and production require configured live Firebase projects.")
    // Both IDs are public configuration and required to prove environment separation.
    const productionProject = env.FIREBASE_PROJECTID?.trim()
    const previewProject = env.FIREBASE_PROJECTID_PREVIEW?.trim()
    if ((!webBeta && !productionProject) || !previewProject || productionProject === previewProject) {
      throw new Error("Set distinct FIREBASE_PROJECTID and FIREBASE_PROJECTID_PREVIEW for live builds.")
    }
  }
  if (!/^[a-z][a-z0-9-]{4,29}$/.test(firebase.projectId)) throw new Error("Invalid Firebase project ID.")
  for (const value of Object.values(google)) {
    if (value && !/^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(value)) throw new Error("Invalid Google OAuth client ID.")
  }
  const googleConfigured = webBeta ? Boolean(google.webClientId) : Object.values(google).every(Boolean)
  const emulatorHost = env.FIREBASE_EMULATOR_HOST?.trim()
  if (emulatorHost && !/^(?:localhost|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.test(emulatorHost)) {
    throw new Error("FIREBASE_EMULATOR_HOST must be a hostname or IPv4 address without scheme or port.")
  }
  return { variant, ...identity, firebase, google, googleConfigured, emulator, emulatorHost, webBeta,
    publicSiteUrl: read("PUBLIC_SITE_URL") }
}

module.exports = { readEnvironment }

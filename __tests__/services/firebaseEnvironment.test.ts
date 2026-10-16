let mockExtra: Record<string, unknown> = {}
const mockApp = { options: { projectId: "demo-talkie-trivia" } }
const mockConnectAuth = jest.fn()
const mockConnectFirestore = jest.fn()
const mockConnectFunctions = jest.fn()
const mockInitializeAuth = jest.fn(() => ({}))
const mockInitializeFirestore = jest.fn(() => ({}))
let mockPlatform = "ios"
const loadFirebase = () => {
  Object.defineProperty(require("react-native").Platform, "OS", { configurable: true, get: () => mockPlatform })
  return require("../../src/services/firebaseClient")
}
jest.mock("expo-constants", () => ({ expoConfig: { get extra() { return mockExtra } } }))
jest.mock("firebase/app", () => ({ getApps: () => [], initializeApp: () => mockApp }))
jest.mock("firebase/auth", () => ({ initializeAuth: (...args: unknown[]) => (mockInitializeAuth as jest.Mock)(...args), getAuth: () => ({}), indexedDBLocalPersistence: "indexeddb", browserLocalPersistence: "local", browserSessionPersistence: "session", getReactNativePersistence: () => ({}), connectAuthEmulator: (...args: unknown[]) => mockConnectAuth(...args) }))
jest.mock("firebase/firestore", () => ({ initializeFirestore: (...args: unknown[]) => (mockInitializeFirestore as jest.Mock)(...args), getFirestore: () => ({}), connectFirestoreEmulator: (...args: unknown[]) => mockConnectFirestore(...args) }))
jest.mock("firebase/functions", () => ({ getFunctions: () => ({}), connectFunctionsEmulator: (...args: unknown[]) => mockConnectFunctions(...args) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockPlatform = "ios"
  mockInitializeAuth.mockReset().mockReturnValue({})
  mockConnectAuth.mockReset(); mockConnectFirestore.mockReset(); mockConnectFunctions.mockReset()
  delete (globalThis as any).__talkieEmulatorApps
})

it("keeps web persistence without initializing an unused Google popup resolver", () => {
  mockPlatform = "web"
  mockExtra = { firebaseUseEmulators: false, firebaseProjectId: "talkie-staging" }
  jest.isolateModules(loadFirebase)
  expect(mockInitializeAuth).toHaveBeenCalledWith(mockApp, { persistence: ["indexeddb", "local", "session"] })
  expect(mockInitializeFirestore).toHaveBeenCalledWith(mockApp, { experimentalForceLongPolling: false })
})

it("surfaces unexpected web auth initialization failures without connecting emulators", () => {
  mockPlatform = "web"
  mockExtra = { firebaseUseEmulators: true, firebaseProjectId: "demo-talkie-trivia" }
  mockInitializeAuth.mockImplementationOnce(() => { throw new Error("Persistence failed") })
  expect(() => jest.isolateModules(loadFirebase)).toThrow("Persistence failed")
  expect(mockInitializeFirestore).toHaveBeenCalledWith(mockApp, { experimentalForceLongPolling: false })
  expect(mockConnectAuth).not.toHaveBeenCalled()
})

it("reuses web auth during hot reload only when it was already initialized", () => {
  mockPlatform = "web"
  mockExtra = { firebaseUseEmulators: false, firebaseProjectId: "talkie-staging" }
  mockInitializeAuth.mockImplementationOnce(() => { throw { code: "auth/already-initialized" } })
  expect(() => jest.isolateModules(loadFirebase)).not.toThrow()
})

it("routes development SDK calls and post-deletion status to the same explicit device host", () => {
  mockExtra = { firebaseUseEmulators: true, firebaseProjectId: "demo-talkie-trivia", firebaseEmulatorHost: "192.168.1.10" }
  jest.isolateModules(() => {
    require("../../src/services/firebaseClient")
    const { functionsBaseUrl } = require("../../src/config/firebaseEnvironment")
    expect(functionsBaseUrl("demo-talkie-trivia")).toBe("http://192.168.1.10:5001/demo-talkie-trivia/us-central1")
  })
  expect(mockConnectAuth).toHaveBeenCalledWith(expect.anything(), "http://192.168.1.10:9099", expect.anything())
  expect(mockConnectFirestore).toHaveBeenCalledWith(expect.anything(), "192.168.1.10", 8080)
  expect(mockConnectFunctions).toHaveBeenCalledWith(expect.anything(), "192.168.1.10", 5001)
})
it("does not send a preview build to emulators just because JavaScript is in debug mode", () => {
  mockExtra = { firebaseUseEmulators: false, firebaseProjectId: "talkie-staging" }
  jest.isolateModules(() => {
    require("../../src/services/firebaseClient")
    expect(require("../../src/config/firebaseEnvironment").functionsBaseUrl("talkie-staging"))
      .toBe("https://us-central1-talkie-staging.cloudfunctions.net")
  })
  expect(mockConnectAuth).not.toHaveBeenCalled(); expect(mockConnectFirestore).not.toHaveBeenCalled()
})
it("rejects live project IDs in emulator mode", () => {
  mockExtra = { firebaseUseEmulators: true, firebaseProjectId: "talkie-production" }
  expect(() => jest.isolateModules(() => require("../../src/services/firebaseClient"))).toThrow(/demo Firebase/)
  expect(mockConnectAuth).not.toHaveBeenCalled()
})
it("surfaces partial emulator setup failures instead of silently continuing", () => {
  mockExtra = { firebaseUseEmulators: true, firebaseProjectId: "demo-talkie-trivia" }
  mockConnectFirestore.mockImplementation(() => { throw new Error("Firestore emulator setup failed") })
  expect(() => jest.isolateModules(() => require("../../src/services/firebaseClient"))).toThrow(/setup failed/)
  expect(mockConnectFunctions).not.toHaveBeenCalled()
})

// --- HOISTED MOCKS SETUP ---
const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
}

const mockFirestoreInstance = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  runTransaction: jest.fn(async (callback) => {
    return callback(mockTransaction)
  }),
}

jest.mock("firebase-admin/app", () => ({
  initializeApp: jest.fn(),
}))

jest.mock("firebase-admin/firestore", () => ({
  getFirestore: jest.fn(() => mockFirestoreInstance),
  FieldValue: {
    serverTimestamp: jest.fn(() => "MOCK_TIMESTAMP"),
  },
}))

// Mock firebase-functions/v2/https
jest.mock("firebase-functions/v2/https", () => ({
  onCall: jest.fn((optionsOrHandler: any, maybeHandler?: any) => {
    // onCall can be called as onCall(handler) or onCall(options, handler)
    // Return the handler function in either case
    const handler = maybeHandler || optionsOrHandler
    return handler
  }),
  HttpsError: class extends Error {
    code: string
    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
}))

// Import AFTER all mocks are set up
import { submitGameResult } from "./index"

describe("Cloud Function: submitGameResult", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockAuth = {
    uid: "user-123",
    token: "mock-token",
  }

  const mockGame = {
    id: "game-1",
    playerID: "user-123",
    correctAnswer: true,
    difficulty: "LEVEL_3",
    guesses: [{}, {}],
    guessesMax: 5,
    startDate: "2023-01-01",
    triviaItem: {
      id: 101,
      title: "Test Movie",
      posterPath: "/path.jpg",
    },
  }

  it("should throw error if user is unauthenticated", async () => {
    // @ts-ignore
    await expect(
      submitGameResult({ data: { playerGame: mockGame }, auth: undefined })
    ).rejects.toThrow("The function must be called while authenticated.")
  })

  it("should throw error if playerID does not match auth uid", async () => {
    const badGame = { ...mockGame, playerID: "other-user" }
    // @ts-ignore
    await expect(
      submitGameResult({ data: { playerGame: badGame }, auth: mockAuth })
    ).rejects.toThrow("Invalid game data ownership.")
  })

  it("should successfully process a win and update stats", async () => {
    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({
        id: "user-123",
        currentStreak: 2,
        maxStreak: 5,
        games: 10,
        wins: [0, 0, 0, 0, 0],
        allTimeScore: 5000,
      }),
    })

    // @ts-ignore
    const result = await submitGameResult({
      data: { playerGame: mockGame },
      auth: mockAuth,
    })

    expect(result.success).toBe(true)
    expect(result.score).toBeGreaterThan(0)

    expect(mockFirestoreInstance.runTransaction).toHaveBeenCalled()

    const statsUpdateCall = mockTransaction.set.mock.calls.find(
      (call: any) => call[1].id === "user-123"
    )
    const updatedStats = statsUpdateCall[1]

    expect(updatedStats.games).toBe(11)
    expect(updatedStats.currentStreak).toBe(3)
    expect(updatedStats.allTimeScore).toBe(5000 + result.score)
  })

  it("should reset streak on loss", async () => {
    const lossGame = { ...mockGame, correctAnswer: false }

    mockTransaction.get.mockResolvedValue({
      exists: true,
      data: () => ({
        id: "user-123",
        currentStreak: 5,
        games: 10,
        allTimeScore: 5000,
      }),
    })

    // @ts-ignore
    await submitGameResult({ data: { playerGame: lossGame }, auth: mockAuth })

    const statsUpdateCall = mockTransaction.set.mock.calls.find(
      (call: any) => call[1].id === "user-123"
    )
    const updatedStats = statsUpdateCall[1]

    expect(updatedStats.currentStreak).toBe(0)
    expect(updatedStats.games).toBe(11)
  })

  it("should create default stats if they do not exist", async () => {
    mockTransaction.get.mockResolvedValue({ exists: false })

    // @ts-ignore
    await submitGameResult({ data: { playerGame: mockGame }, auth: mockAuth })

    const statsUpdateCall = mockTransaction.set.mock.calls.find(
      (call: any) => call[1].id === "user-123"
    )
    const updatedStats = statsUpdateCall[1]

    expect(updatedStats).toBeDefined()
    expect(updatedStats.games).toBe(1)
    expect(updatedStats.currentStreak).toBe(1)
  })
})

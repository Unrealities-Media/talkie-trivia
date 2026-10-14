import { Share } from "react-native"
import { generateShareMessage, shareGameResult } from "../../src/utils/shareUtils"
import { defaultPlayerGame } from "../../src/models/default"
import { PlayerGame } from "../../src/models/game"
import { analyticsService } from "../../src/utils/analyticsService"
jest.mock("../../src/utils/analyticsService")
jest.mock("../../src/utils/hapticsService")
jest.mock("../../src/state/gameStore", () => ({ useGameStore: { getState: () => { throw new Error("Sharing must not read the current game") } } }))
jest.spyOn(Share, "share")
const game = (): PlayerGame => ({ ...defaultPlayerGame, id: "saved-game", playerID: "private-owner", challengeId: "2026-10-13", startDate: new Date("2026-10-14T00:30:00Z"), difficulty: "LEVEL_2", guessesMax: 5, guesses: [{ itemId: 123 }, { itemId: 456 }], correctAnswer: true, statsProcessed: true, score: 411, hintsUsed: { director: true }, triviaItem: { ...defaultPlayerGame.triviaItem, title: "SECRET ANSWER", description: "SECRET PLOT" } })
beforeEach(() => { jest.clearAllMocks(); (Share.share as jest.Mock).mockResolvedValue({ action: Share.sharedAction }) })

it("shares only the immutable UTC result, saved score and difficulty without spoilers or an unverified URL", () => {
  const localDate = jest.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(() => { throw new Error("No local calendar") })
  try {
    expect(generateShareMessage(game())).toBe("Talkie Trivia 🎬\n2026-10-13 (UTC) · Easy\nSolved in 2/5 guesses\n🟥🟩\nScore: 411\nHints used: 1/3")
  } finally { localDate.mockRestore() }
})

it("uses UTC for legacy saved dates and never substitutes a malformed challenge ID", () => {
  expect(generateShareMessage({ ...game(), challengeId: undefined })).toContain("2026-10-14 (UTC)")
  expect(() => generateShareMessage({ ...game(), challengeId: "2026-02-30" })).toThrow()
})

it("represents a loss and a zero-guess give-up without misleading win claims", () => {
  const loss = { ...game(), difficulty: "LEVEL_5" as const, correctAnswer: false, guessesMax: 3, guesses: [{ itemId: 1 }, { itemId: 2 }, { itemId: 3 }], score: 0 }
  expect(generateShareMessage(loss)).toContain("Out of guesses (3/3)\n🟥🟥🟥\nScore: 0")
  expect(generateShareMessage(loss)).not.toContain("Hints used")
  expect(generateShareMessage({ ...game(), correctAnswer: false, gaveUp: true, guesses: [], score: 0 })).toContain("Gave up after 0 guesses\n⏹️")
})

it.each([
  { statsProcessed: false }, { score: undefined }, { score: NaN }, { score: -1 },
  { correctAnswer: false }, { guesses: [] }, { challengeId: "bad-day" },
])("refuses to share an incomplete or invalid saved result: %j", async override => {
  await expect(shareGameResult({ ...game(), ...override })).rejects.toThrow("saved, completed result")
  expect(Share.share).not.toHaveBeenCalled()
})

it("deduplicates active sheets, snapshots content and records only the platform-reported shared action", async () => {
  let resolve!: (value: unknown) => void
  ;(Share.share as jest.Mock).mockImplementationOnce(() => new Promise(done => { resolve = done }))
  const original = game()
  const first = shareGameResult(original)
  original.correctAnswer = false
  original.score = 0
  await shareGameResult(game())
  expect(Share.share).toHaveBeenCalledTimes(1)
  expect(analyticsService.trackShareResults).not.toHaveBeenCalled()
  expect((Share.share as jest.Mock).mock.calls[0][0].message).toContain("Score: 411")
  resolve({ action: Share.sharedAction })
  await first
  expect(analyticsService.trackShareResults).toHaveBeenCalledWith("win")
})

it("does not report dismissal as sharing", async () => {
  ;(Share.share as jest.Mock).mockResolvedValueOnce({ action: Share.dismissedAction })
  await shareGameResult(game())
  expect(analyticsService.trackShareResults).not.toHaveBeenCalled()
})

it("handles cancellation errors and permits a later retry", async () => {
  ;(Share.share as jest.Mock).mockRejectedValueOnce({ name: "AbortError" })
  await expect(shareGameResult(game())).resolves.toBeUndefined()
  expect(analyticsService.trackShareResults).not.toHaveBeenCalled()
  await shareGameResult(game())
  expect(Share.share).toHaveBeenCalledTimes(2)
})

it.each([null, "native failure", new Error("native failure")])("preserves unusual failures without masking them and unlocks retry", async error => {
  ;(Share.share as jest.Mock).mockRejectedValueOnce(error)
  await expect(shareGameResult(game())).rejects.toBe(error)
  expect(analyticsService.trackShareResults).not.toHaveBeenCalled()
  await shareGameResult(game())
  expect(Share.share).toHaveBeenCalledTimes(2)
})

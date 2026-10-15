import { StateCreator } from "zustand"
import { GameStoreState, SettingsSlice } from "../storeTypes"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ASYNC_STORAGE_KEYS } from "../../config/constants"
import { DEFAULT_DIFFICULTY, DIFFICULTY_MODES } from "../../config/difficulty"

export const createSettingsSlice: StateCreator<GameStoreState, [], [], SettingsSlice> = (set, get) => ({
  gameMode: "movies",
  difficulty: DEFAULT_DIFFICULTY,
  nextDifficulty: DEFAULT_DIFFICULTY,
  setGameMode: async mode => {
    if (mode !== "movies") set({ flashMessage: "Movie challenges are available in this release." })
  },
  setDifficulty: difficulty => {
    if (!Object.hasOwn(DIFFICULTY_MODES, difficulty)) return
    if (get().loading || get().syncStatus !== "idle") {
      set({ flashMessage: "Finish saving or retry your move before switching challenges." })
      return
    }
    set({ nextDifficulty: difficulty, flashMessage: null })
    const uid = get().playerGame.playerID
    if (uid) void get().initializeGame({ id: uid, name: "Player" }, difficulty)
    void AsyncStorage.setItem(ASYNC_STORAGE_KEYS.DIFFICULTY_SETTING, difficulty).catch(() => {
      set({ flashMessage: "Your preference could not be saved. Please try again." })
    })
  },
})

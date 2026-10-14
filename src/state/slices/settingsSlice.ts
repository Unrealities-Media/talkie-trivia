import { StateCreator } from "zustand"
import { GameStoreState, SettingsSlice } from "../storeTypes"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { ASYNC_STORAGE_KEYS } from "../../config/constants"
import { DEFAULT_DIFFICULTY, DIFFICULTY_MODES } from "../../config/difficulty"

export const createSettingsSlice: StateCreator<GameStoreState, [], [], SettingsSlice> = set => ({
  gameMode: "movies",
  difficulty: DEFAULT_DIFFICULTY,
  nextDifficulty: DEFAULT_DIFFICULTY,
  setGameMode: async mode => {
    if (mode !== "movies") set({ flashMessage: "Movie challenges are available in this release." })
  },
  setDifficulty: difficulty => {
    if (!Object.hasOwn(DIFFICULTY_MODES, difficulty)) return
    set({ nextDifficulty: difficulty, flashMessage: `${DIFFICULTY_MODES[difficulty].label} selected for your next daily challenge.` })
    void AsyncStorage.setItem(ASYNC_STORAGE_KEYS.DIFFICULTY_SETTING, difficulty).catch(() => {
      set({ flashMessage: "Your preference could not be saved. Please try again." })
    })
  },
})

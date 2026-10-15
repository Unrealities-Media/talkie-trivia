import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react"
import { AppState } from "react-native"
import * as Network from "expo-network"
import { analyticsService } from "../utils/analyticsService"

interface NetworkState {
  isNetworkConnected: boolean | null
  refreshNetwork: () => Promise<boolean | null>
}
const NetworkContext = createContext<NetworkState | undefined>(undefined)
const connection = (state: Network.NetworkState) => state.isInternetReachable ?? state.isConnected ?? null

export const NetworkProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isNetworkConnected, setIsNetworkConnected] = useState<boolean | null>(null)
  const mounted = useRef(false)
  const generation = useRef(0)
  const invalidateRefresh = useCallback(() => { generation.current++ }, [])
  const latest = useRef<boolean | null>(null)
  const accept = useCallback((value: boolean | null) => {
    if (!mounted.current) return
    if (value !== null && value !== latest.current) analyticsService.trackNetworkStatusChange(value)
    latest.current = value
    setIsNetworkConnected(value)
  }, [])
  const refreshNetwork = useCallback(async () => {
    const token = ++generation.current
    let value: boolean | null = null
    try { value = connection(await Network.getNetworkStateAsync()) } catch { /* Unknown does not prove offline. */ }
    if (token !== generation.current) return latest.current
    accept(value)
    return value
  }, [accept])

  useEffect(() => {
    mounted.current = true
    void refreshNetwork()
    const subscription = Network.addNetworkStateListener(state => {
      invalidateRefresh()
      accept(connection(state))
    })
    const foreground = AppState.addEventListener("change", state => {
      if (state === "active") void refreshNetwork()
    })
    return () => {
      mounted.current = false
      invalidateRefresh()
      subscription.remove()
      foreground.remove()
    }
  }, [accept, refreshNetwork, invalidateRefresh])
  return <NetworkContext.Provider value={{ isNetworkConnected, refreshNetwork }}>{children}</NetworkContext.Provider>
}

export const useNetwork = () => {
  const context = useContext(NetworkContext)
  if (context === undefined) throw new Error("useNetwork must be used within a NetworkProvider")
  return context
}

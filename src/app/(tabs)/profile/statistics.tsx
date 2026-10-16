import React from "react"
import { router } from "expo-router"
import { useAuth } from "../../../contexts/authContext"
import AccountStats from "../../../components/accountStats"
import ProfilePage from "../../../components/profilePage"
import LoadingIndicator from "../../../components/loadingIndicator"
import { Button } from "../../../components/ui/button"

export default function StatisticsScreen() {
  const { player, user, loading } = useAuth()
  return <ProfilePage title="Your statistics">
    {loading ? <LoadingIndicator /> : player && user ? <AccountStats key={player.id} player={player} /> :
      <Button title="Open account settings" onPress={() => router.push("/profile/settings")} />}
  </ProfilePage>
}

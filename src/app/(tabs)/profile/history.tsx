import React from "react"
import { router } from "expo-router"
import ProfilePage from "../../../components/profilePage"
import ProfileHistory from "../../../components/profileHistory"
import { useAuth } from "../../../contexts/authContext"
import LoadingIndicator from "../../../components/loadingIndicator"
import { Button } from "../../../components/ui/button"

export default function HistoryScreen() {
  const { player, user, loading } = useAuth()
  return <ProfilePage title="Your movies">
    {loading ? <LoadingIndicator /> : player && user ? <ProfileHistory /> :
      <Button title="Open account settings" onPress={() => router.push("/profile/settings")} />}
  </ProfilePage>
}

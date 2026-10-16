import React, { memo, useState } from "react"
import { Pressable, View, StyleProp, ViewStyle } from "react-native"
import { Image } from "expo-image"
import { API_CONFIG } from "../config/constants"
import { useTheme } from "../contexts/themeContext"
import { imdbPersonUrl } from "../utils/imdbLinks"
import { Typography } from "./ui/typography"

export interface CastMember {
  id?: number | string
  name: string
  profile_path?: string | null
  imdb_id?: string | null
}
interface ActorsProps {
  actors: readonly CastMember[]
  maxDisplay?: number
  containerStyle?: StyleProp<ViewStyle>
  onActorPress: (actor: CastMember) => void
}

const Actors = memo(({ actors, maxDisplay = 3, containerStyle, onActorPress }: ActorsProps) => {
  const { colors } = useTheme()
  const [failedPortraits, setFailedPortraits] = useState<string[]>([])
  const cast = Array.isArray(actors) ? actors.filter(actor => actor && typeof actor.name === "string" && actor.name.trim()).slice(0, maxDisplay) : []
  if (!cast.length) return null
  return <View style={[{ width: "100%", gap: 8, paddingVertical: 12 }, containerStyle]}>
    <Typography accessibilityRole="header">Cast</Typography>
    {cast.map((actor, index) => {
      const linkable = Boolean(imdbPersonUrl(actor.imdb_id))
      const content = <>
        {actor.profile_path && !failedPortraits.includes(actor.profile_path) && <Image
          source={{ uri: `${API_CONFIG.TMDB_IMAGE_BASE_URL_W185}${actor.profile_path}` }}
          onError={() => setFailedPortraits(paths => paths.includes(actor.profile_path!) ? paths : [...paths, actor.profile_path!])}
          style={{ width: 48, height: 72 }} contentFit="cover" accessible={false} />}
        <Typography style={{ flexShrink: 1, color: linkable ? colors.accentText : colors.textPrimary, textDecorationLine: linkable ? "underline" : "none" }}>{actor.name}</Typography>
      </>
      const style: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, minHeight: 48 }
      return linkable ? <Pressable key={`${actor.name}-${index}`} testID={`actor-pressable-${actor.id ?? index}`} accessibilityRole="link" accessibilityLabel={`Open IMDb page for ${actor.name}`} onPress={() => onActorPress(actor)} style={style}>{content}</Pressable>
        : <View key={`${actor.name}-${index}`} style={style}>{content}</View>
    })}
  </View>
})

export default Actors

import React, { memo, useState, useRef } from "react"
import {
  ActivityIndicator,
  Text,
  TextInput,
  Platform,
  Pressable,
  View,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
} from "react-native"
import { FlashList, ListRenderItem } from "@shopify/flash-list"
import Animated from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Circle, Path } from "react-native-svg"
import { BasicTriviaItem } from "../models/trivia"
import { useStyles, Theme, useThemeTokens } from "../utils/hooks/useStyles"

interface PickerUIProps {
  query: string
  isSearching: boolean
  results: readonly BasicTriviaItem[]
  showResults: boolean
  animatedInputStyle: any
  isInteractionsDisabled: boolean
  handleInputChange: (text: string) => void
  renderItem: ListRenderItem<BasicTriviaItem>
  placeholder: string
}

export const PickerUI: React.FC<PickerUIProps> = memo(
  ({
    query,
    isSearching,
    results,
    showResults,
    animatedInputStyle,
    isInteractionsDisabled,
    handleInputChange,
    renderItem,
    placeholder,
  }) => {
    const styles = useStyles(themedStyles)
    const searchRef = useRef<TextInput>(null)
    const theme = useThemeTokens()
    const { fontScale } = useWindowDimensions()
    const [measuredContent, setMeasuredContent] = useState<{
      items: readonly BasicTriviaItem[]; height: number
    } | null>(null)

    // Bound only the scrolling list. The hint footer can grow with text size.
    const ITEM_HEIGHT = theme.responsive.scale(62)
    const MAX_CONTAINER_HEIGHT = theme.responsive.scale(250)

    // Actual rows can grow for text scaling, wrapped titles and long-press
    // previews. Keep the scroll viewport bounded, not each result's content.
    const calculatedHeight = measuredContent?.items === results
      ? measuredContent.height : results.length * ITEM_HEIGHT * Math.max(1, fontScale)
    const containerHeight = Math.min(calculatedHeight, MAX_CONTAINER_HEIGHT)

    return (
      <View style={styles.container}>
        <Animated.View style={animatedInputStyle}>
          <LinearGradient colors={["#FF826E", "#FA5B56"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.inputContainer}>
            <View pointerEvents="none" accessible={false} style={{ position: "absolute", left: 17, top: 15 }}>
              <Svg width={30} height={30} viewBox="0 0 30 30">
                <Circle cx={12} cy={12} r={10} fill="none" stroke="#14232A" strokeWidth={2} />
                <Path d="M19 19L28 28" stroke="#14232A" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </View>
            <TextInput
              ref={searchRef}
              testID="search-input"
              accessible
              accessibilityRole={Platform.OS === "web" ? undefined : "search"}
              role={Platform.OS === "web" ? "searchbox" : undefined}
              accessibilityHint="Enter a movie title or alternate title. Add a release year to narrow results. One-character titles must match exactly."
              aria-label="Search for a title to make a guess"
              maxLength={100}
              onChangeText={handleInputChange}
              placeholder={placeholder}
              placeholderTextColor={styles.input.placeholderTextColor}
              style={[
                styles.input,
                isInteractionsDisabled && styles.disabledInput,
              ]}
              value={query}
              editable={!isInteractionsDisabled}
              autoCorrect={false}
            />
            {!isSearching && <Pressable accessibilityRole="button" accessibilityLabel="Focus movie search" disabled={isInteractionsDisabled} onPress={() => searchRef.current?.focus()} style={{ position: "absolute", right: 8, top: 8, width: 44, height: 44, borderRadius: 22, backgroundColor: "#B84D4299", alignItems: "center", justifyContent: "center" }}>
              <Svg width={28} height={28} viewBox="0 0 28 28" aria-hidden={true}>
                <Path d="M4 14H23M15 6L23 14L15 22" fill="none" stroke="#FFE9CB" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>}
            {isSearching && (
              <ActivityIndicator
                size="small"
                color={styles.activityIndicator.color}
                style={styles.activityIndicator}
              />
            )}
          </LinearGradient>
        </Animated.View>
        {!showResults && <Text style={{ fontFamily: "PremiereSans", fontSize: 8, letterSpacing: 2, textAlign: "center", color: theme.colors.textSecondary, marginTop: 12 }}>SEARCH A TITLE. MAKE YOUR GUESS.</Text>}

        {showResults && (
          <View style={styles.resultsContainer}>
            {isSearching ? (
              <Text style={styles.noResultsText}>Searching...</Text>
            ) : results.length > 0 ? (
              <>
                <View testID="search-results-viewport" style={{ height: containerHeight, width: "100%" }}>
                  <FlashList
                    data={results}
                    renderItem={renderItem}
                    keyExtractor={(item) => String(item.id)}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    onContentSizeChange={(_width, height) => {
                      if (!Number.isFinite(height) || height <= 0) return
                      setMeasuredContent(previous => previous?.items === results && previous.height === height
                        ? previous : { items: results, height })
                    }}
                  />
                </View>
                <View style={styles.previewHintContainer}>
                  <Text style={styles.previewHintText} accessibilityLiveRegion="polite">
                    {results.length} {results.length === 1 ? "title" : "titles"}.{" "}
                    💡 Hold any result to preview
                  </Text>
                </View>
              </>
            ) : query.trim().length > 0 ? (
              <Text style={styles.noResultsText} accessibilityLiveRegion="polite">
                No titles found for "{query}". Try another spelling or omit the year.
              </Text>
            ) : null}
          </View>
        )}
      </View>
    )
  }
)

interface PickerUIStyles {
  container: ViewStyle
  inputContainer: ViewStyle
  input: TextStyle & { placeholderTextColor: string }
  disabledInput: TextStyle
  activityIndicator: ViewStyle & { color: string }
  resultsContainer: ViewStyle
  noResultsText: TextStyle
  previewHintContainer: ViewStyle
  previewHintText: TextStyle
}

const themedStyles = (theme: Theme): PickerUIStyles => ({
  container: {
    width: "100%",
    marginTop: 8,
    marginBottom: theme.spacing.medium,
  },
  inputContainer: {
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    position: "relative",
    width: "100%",
  },
  input: {
    flex: 1,
    borderColor: theme.colors.primary,
    borderRadius: 10,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: theme.colors.onAccent,
    fontFamily: "PremiereSans",
    fontSize: 17,
    paddingLeft: 62,
    paddingVertical: 18,
    textAlign: "left",
    paddingRight: 62,
    placeholderTextColor: "#493137",
  },
  disabledInput: {
    backgroundColor: theme.colors.border,
  },
  activityIndicator: {
    position: "absolute",
    right: theme.spacing.small,
    top: theme.responsive.scale(12),
    color: theme.colors.accentText,
  },
  resultsContainer: {
    // Results must participate in layout so native accessibility bounds and
    // the page's scroll extent include every result, including with a keyboard.
    marginTop: theme.spacing.small,
    width: "100%",
    backgroundColor: theme.colors.backgroundLight,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.responsive.scale(8),
    ...theme.shadows.medium,
    overflow: "hidden",
    flexDirection: "column",
  },
  noResultsText: {
    ...theme.typography.bodyText,
    fontSize: theme.responsive.responsiveFontSize(14),
    padding: theme.spacing.medium,
    textAlign: "center",
  },
  previewHintContainer: {
    backgroundColor: theme.colors.tertiary,
    paddingVertical: theme.responsive.scale(4),
    paddingHorizontal: theme.spacing.small,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  previewHintText: {
    fontFamily: "PremiereSans",
    fontSize: theme.responsive.responsiveFontSize(11),
    color: theme.colors.onAccent,
  },
})

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
  Keyboard,
  useWindowDimensions,
} from "react-native"
import { FlashList, ListRenderItem } from "@shopify/flash-list"
import Animated from "react-native-reanimated"
import { LinearGradient } from "expo-linear-gradient"
import Svg, { Circle, Path } from "react-native-svg"
import { BasicTriviaItem } from "../models/trivia"
import { useStyles, Theme } from "../utils/hooks/useStyles"

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

const SEARCH_BATCH_SIZE = 12

// Keep broad searches cheap without discarding any matching titles.
export function WebSearchResults({ results, renderItem, disabled }: {
  results: readonly BasicTriviaItem[]
  renderItem: ListRenderItem<BasicTriviaItem>
  disabled: boolean
}) {
  const styles = useStyles(themedStyles)
  const root = useRef<View>(null)
  const [page, setPage] = useState({ results, count: SEARCH_BATCH_SIZE })
  const count = page.results === results ? page.count : SEARCH_BATCH_SIZE
  const visible = results.slice(0, count)
  const showMore = () => {
    setPage({ results, count: count + SEARCH_BATCH_SIZE })
    // Continue keyboard navigation at the first newly revealed title.
    requestAnimationFrame(() => {
      const node = root.current as unknown as HTMLElement | null
      node?.querySelector?.<HTMLElement>(`[data-testid="search-batch-row-${count}"] [role="button"]:not([aria-disabled="true"])`)?.focus()
    })
  }
  return <View ref={root}>
    {visible.map((item, index) => <View key={String(item.id)} testID={`search-batch-row-${index}`}>
      {renderItem({ item, index, target: "Cell", extraData: undefined })}
    </View>)}
    {count < results.length && <Pressable accessibilityRole="button" disabled={disabled}
      onPress={showMore} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={styles.noResultsText}>Show more titles ({visible.length} of {results.length})</Text>
    </Pressable>}
  </View>
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
    const resultsRef = useRef<View>(null)
    const focusResults = () => {
      if (isInteractionsDisabled || isSearching) return
      if (Platform.OS === "web") {
        const node = resultsRef.current as unknown as HTMLElement | null
        node?.querySelector<HTMLElement>('[role="button"]:not([aria-disabled="true"])')?.focus()
      } else Keyboard.dismiss()
    }
    const { height, fontScale } = useWindowDimensions()
    const [measuredContent, setMeasuredContent] = useState<{
      items: readonly BasicTriviaItem[]; height: number
    } | null>(null)

    // Bound only the scrolling list. The hint footer can grow with text size.
    const ITEM_HEIGHT = 110
    // Window size can be zero while a web tab is opening/restoring. Never
    // collapse the game's only input path, and recalculate when it resizes.
    const availableHeight = Number.isFinite(height) && height > 0 ? height : 812
    const MAX_CONTAINER_HEIGHT = Math.max(220, Math.min(440, availableHeight * 0.4))

    // Actual rows can grow for text scaling, wrapped titles and long-press
    // previews. Keep the scroll viewport bounded, not each result's content.
    const calculatedHeight = measuredContent?.items === results
      ? measuredContent.height : results.length * ITEM_HEIGHT * Math.max(1, fontScale)
    const containerHeight = Math.min(calculatedHeight, MAX_CONTAINER_HEIGHT)
    const searchStatus = showResults && !isSearching && query.trim()
      ? results.length > 0
        ? `${results.length} ${results.length === 1 ? "title" : "titles"} found for "${query}".`
        : `No titles found for "${query}". Try another spelling or omit the year.`
      : ""

    return (
      <View style={styles.container}>
        {Platform.OS === "web" && (
          // Keep the live region mounted before results arrive. Announce only
          // completed searches without moving focus or reading every movie row.
          <div role="status" aria-live="polite" aria-atomic="true" data-testid="search-status"
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}>
            {searchStatus}
          </div>
        )}
        <Animated.View style={animatedInputStyle}>
          <LinearGradient colors={["#63706A", "#1B3034", "#0A181C", "#48524A"]} locations={[0, 0.12, 0.8, 1]} style={styles.canister}>
          <LinearGradient colors={["#F5E6C8", "#DCC69E"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.inputContainer}>
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
              onSubmitEditing={focusResults}
              returnKeyType="search"
              submitBehavior="submit"
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
            {!isSearching && <Pressable accessibilityRole="button" accessibilityLabel="Choose a search result" disabled={isInteractionsDisabled || results.length === 0} onPress={focusResults} style={{ position: "absolute", right: 6, top: 6, width: 44, height: 44, borderRadius: 2, borderLeftWidth: 1, borderColor: "#A18A61", alignItems: "center", justifyContent: "center" }}>
              <Svg width={28} height={28} viewBox="0 0 28 28" aria-hidden={true}>
                <Path d="M4 14H23M15 6L23 14L15 22" fill="none" stroke="#59482F" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
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
          </LinearGradient>
        </Animated.View>

        {showResults && (
          <View ref={resultsRef} style={styles.resultsContainer}>
            {isSearching ? (
              <Text style={styles.noResultsText}>Searching...</Text>
            ) : results.length > 0 ? (
              <>
                <View testID="search-results-viewport" style={{ height: Platform.OS === "web" ? undefined : containerHeight, width: "100%" }}>
                  {Platform.OS === "web" ? <WebSearchResults results={results} renderItem={renderItem} disabled={isInteractionsDisabled} /> : <FlashList
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
                  />}
                </View>
              </>
            ) : query.trim().length > 0 ? (
              <Text style={styles.noResultsText} accessibilityLiveRegion={Platform.OS === "web" ? undefined : "polite"}>
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
  canister: ViewStyle
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
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#A18A61",
    overflow: "hidden",
    flexDirection: "row",
    position: "relative",
    width: "100%",
  },
  canister: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderTopLeftRadius: 13,
    borderTopRightRadius: 13,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    borderWidth: 1,
    borderColor: "#786D53",
    borderBottomWidth: 3,
    borderBottomColor: "#050F13",
  },
  input: {
    flex: 1,
    borderColor: theme.colors.primary,
    borderRadius: 3,
    borderWidth: 0,
    backgroundColor: "transparent",
    color: "#2C241B",
    fontFamily: "PremiereClue",
    fontSize: 17,
    paddingLeft: 54,
    paddingVertical: 14,
    textAlign: "left",
    paddingRight: 50,
    placeholderTextColor: "#65553E",
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
    marginTop: 0,
    width: "100%",
    backgroundColor: theme.colors.backgroundLight,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 2,
    ...theme.shadows.medium,
    overflow: "hidden",
    flexDirection: "column",
  },
  noResultsText: {
    ...theme.typography.bodyText,
    color: theme.colors.textPrimary,
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

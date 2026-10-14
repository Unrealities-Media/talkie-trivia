import React, { memo, useState } from "react"
import {
  ActivityIndicator,
  Text,
  TextInput,
  Platform,
  View,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
} from "react-native"
import { FlashList, ListRenderItem } from "@shopify/flash-list"
import Animated from "react-native-reanimated"
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
          <View style={styles.inputContainer}>
            <TextInput
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
            {isSearching && (
              <ActivityIndicator
                size="small"
                color={styles.activityIndicator.color}
                style={styles.activityIndicator}
              />
            )}
          </View>
        </Animated.View>

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
    marginTop: theme.spacing.medium,
    marginBottom: theme.spacing.medium,
  },
  inputContainer: {
    flexDirection: "row",
    position: "relative",
    width: "100%",
  },
  input: {
    flex: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.responsive.scale(8),
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontFamily: "Arvo-Regular",
    fontSize: theme.responsive.responsiveFontSize(14),
    paddingHorizontal: theme.spacing.medium,
    paddingVertical: theme.responsive.scale(12),
    textAlign: "left",
    paddingRight: theme.responsive.scale(40),
    placeholderTextColor: theme.colors.textSecondary,
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
    fontFamily: "Arvo-Italic",
    fontSize: theme.responsive.responsiveFontSize(11),
    color: theme.colors.onAccent,
  },
})

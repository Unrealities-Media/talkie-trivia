import React, { memo } from "react"
import {
  ActivityIndicator,
  Text,
  TextInput,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
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

    // Calculate height to enforce scrolling when list is long
    const ITEM_HEIGHT = theme.responsive.scale(62)
    const MAX_CONTAINER_HEIGHT = theme.responsive.scale(250)

    // Add buffer for hint text (approx 30) + list items
    const calculatedHeight =
      results.length * ITEM_HEIGHT + theme.responsive.scale(30)
    const containerHeight = Math.min(calculatedHeight, MAX_CONTAINER_HEIGHT)

    return (
      <View style={styles.container}>
        <Animated.View style={animatedInputStyle}>
          <View style={styles.inputContainer}>
            <TextInput
              testID="search-input"
              accessible
              accessibilityRole="search"
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
          <View
            style={[
              styles.resultsContainer,
              results.length > 0 && { height: containerHeight },
            ]}
          >
            {isSearching ? (
              <Text style={styles.noResultsText}>Searching...</Text>
            ) : results.length > 0 ? (
              <>
                <View style={{ flex: 1, width: "100%" }}>
                  <FlashList
                    data={results}
                    renderItem={renderItem}
                    keyExtractor={(item, index) => `${item.id}-${index}`}
                    keyboardShouldPersistTaps="handled"
                  />
                </View>
                <View style={styles.previewHintContainer}>
                  <Text style={styles.previewHintText}>
                    💡 Hold any result to preview
                  </Text>
                </View>
              </>
            ) : query.length >= 2 ? (
              <Text style={styles.noResultsText}>
                No titles found for "{query}"
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
    zIndex: 20,
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
    color: theme.colors.primary,
  },
  resultsContainer: {
    position: "absolute",
    top: theme.responsive.scale(55),
    left: 0,
    right: 0,
    // Max height fallback if dynamic calc fails
    maxHeight: theme.responsive.scale(250),
    backgroundColor: theme.colors.backgroundLight,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.responsive.scale(8),
    ...theme.shadows.medium,
    zIndex: 100,
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
    color: theme.colors.background,
  },
})

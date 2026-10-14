import React from "react"
import { StyleSheet } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { ThemeContext } from "../../src/contexts/themeContext"
import { lightColors, darkColors } from "../../src/styles/themes"
import { Button } from "../../src/components/ui/button"
import HintUI from "../../src/components/hintUI"

// WCAG relative luminance/contrast, including the actual surface behind text.
// https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
const luminance = (hex: string) => {
  const linear = [1, 3, 5].map(offset => {
    const s = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}
const contrast = (a: string, b: string) => {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

describe.each([['light', lightColors], ['dark', darkColors]] as const)('%s readability', (scheme, colors) => {
  const wrap = (children: React.ReactNode) => <ThemeContext.Provider value={{
    theme: scheme, colorScheme: scheme, colors, setTheme: jest.fn(),
  }}>{children}</ThemeContext.Provider>

  it('keeps informational text readable on each ordinary surface', () => {
    for (const foreground of ['textPrimary', 'textSecondary', 'accentText', 'success', 'error', 'quinary'] as const) {
      for (const background of ['background', 'backgroundLight', 'surface'] as const) {
        expect({ foreground, background, passes: contrast(colors[foreground], colors[background]) >= 4.5 })
          .toEqual({ foreground, background, passes: true })
      }
    }
    for (const background of ['primary', 'tertiary'] as const) {
      expect(contrast(colors.onAccent, colors[background])).toBeGreaterThanOrEqual(4.5)
    }
    for (const background of ['background', 'backgroundLight', 'surface'] as const) {
      expect(contrast(colors.border, colors[background])).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(['primary', 'secondary', 'tertiary', 'error'] as const)('renders a readable %s button with a usable target', variant => {
    render(wrap(<Button title="Continue" variant={variant} />))
    const button = StyleSheet.flatten(screen.getByRole('button').props.style)
    const label = StyleSheet.flatten(screen.getByText('Continue').props.style)
    const background = button.backgroundColor === 'transparent' ? colors.surface : button.backgroundColor
    expect(contrast(label.color, background)).toBeGreaterThanOrEqual(4.5)
    expect(button.minHeight).toBeGreaterThanOrEqual(48)
    expect(button.minWidth).toBeGreaterThanOrEqual(48)
  })

  it('removes collapsed hint actions from interaction and exposes expansion state', () => {
    const onSelect = jest.fn()
    const props = {
      displayedHintText: 'A long director name', hintLabelText: 'Show hints', isToggleDisabled: false,
      hintsAvailable: 3, hintStatuses: { director: 'available' as const }, highlightedHint: null,
      handleToggleHintOptions: jest.fn(), handleHintSelection: onSelect,
      allHints: [{ type: 'director', label: 'Director', value: 'A long director name' }],
    }
    const { rerender } = render(wrap(<HintUI {...props} showHintOptions={false} />))
    expect(screen.getByRole('button', { name: 'Show hints' }).props.accessibilityState.expanded).toBe(false)
    expect(screen.queryByRole('button', { name: /Get the movie/ })).toBeNull()
    const hintStyle = StyleSheet.flatten(screen.getByText('A long director name').props.style)
    expect(contrast(hintStyle.color, colors.surface)).toBeGreaterThanOrEqual(4.5)
    rerender(wrap(<HintUI {...props} showHintOptions />))
    expect(screen.getByRole('button', { name: 'Show hints' }).props.accessibilityState.expanded).toBe(true)
    fireEvent.press(screen.getByRole('button', { name: /Get the movie/ }))
    expect(onSelect).toHaveBeenCalledWith('director')
    rerender(wrap(<HintUI {...props} showHintOptions={false} />))
    expect(screen.queryByRole('button', { name: /Get the movie/ })).toBeNull()
  })
})

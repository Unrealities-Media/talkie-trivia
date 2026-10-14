import React from "react"
import { StyleSheet, Text, View } from "react-native"

/** Editorial details from the premiere board; deliberately outside the reading order. */
export default function PremierePosterNotes() {
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <View style={[styles.note, styles.left]}>
      <Text allowFontScaling={false} style={styles.text}>{"DIFFERENT\nPERSPECTIVES\nA BRIGHTER\nYOU"}</Text>
      <View style={styles.rule} />
    </View>
    <View style={[styles.note, styles.right]}>
      <Text allowFontScaling={false} style={styles.text}>{"SAME\nMOVIES\nNEW WAYS\nTO SEE THEM"}</Text>
      <View style={styles.rule} />
    </View>
  </View>
}

const styles = StyleSheet.create({
  note: { position: "absolute" },
  left: { left: 22, top: "53%" },
  right: { right: 16, bottom: 12 },
  text: { fontFamily: "PremiereSans", fontSize: 6, lineHeight: 15, letterSpacing: 2.5, color: "#F8E7CA", textShadowColor: "#03131C", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  rule: { width: 18, height: 1, backgroundColor: "#AF9B84", marginTop: 12 },
})

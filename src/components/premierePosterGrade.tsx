import React from "react"
import { StyleSheet } from "react-native"
import { LinearGradient } from "expo-linear-gradient"

/** Keep the projection's cool shadows and warm light consistent through the reveal. */
export default function PremierePosterGrade() {
  return <LinearGradient pointerEvents="none" accessible={false}
    colors={["#05233355", "#F8D5A324", "#03131CAA"]}
    locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
}

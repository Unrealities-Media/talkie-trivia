import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"
import Actors from "../../src/components/actors"
import { ThemeProvider } from "../../src/contexts/themeContext"

it("shows name-only catalog cast as readable text without dead buttons or placeholder portraits", () => {
  const press = jest.fn()
  render(<ThemeProvider><Actors actors={[{ name: "A Long Actor Name" }, { name: "Cher" }]} onActorPress={press} /></ThemeProvider>)
  expect(screen.getByText("A Long Actor Name")).toBeTruthy()
  expect(screen.getByText("Cher")).toBeTruthy()
  expect(screen.queryByRole("link")).toBeNull()
  expect(screen.queryByRole("button")).toBeNull()
  expect(screen.queryByTestId("mock-expo-image")).toBeNull()
})

it("offers an IMDb action only with a valid person ID", () => {
  const actor = { id: 12, name: "Example Actor", imdb_id: "nm0000138", profile_path: "/cast.jpg" }
  const press = jest.fn()
  render(<ThemeProvider><Actors actors={[actor, { name: "No link", imdb_id: "../../bad" }]} onActorPress={press} /></ThemeProvider>)
  const link = screen.getByRole("link", { name: "Open IMDb page for Example Actor" })
  fireEvent.press(link)
  expect(press).toHaveBeenCalledWith(actor)
  expect(screen.getAllByRole("link")).toHaveLength(1)
  expect(screen.getByTestId("mock-expo-image").props["data-source"]).toContain("/cast.jpg")
})

it("respects the cast limit and tolerates absent or empty names", () => {
  render(<ThemeProvider><Actors actors={[null, { name: "" }, { name: "First" }, { name: "Second" }] as any} maxDisplay={1} onActorPress={jest.fn()} /></ThemeProvider>)
  expect(screen.getByText("First")).toBeTruthy()
  expect(screen.queryByText("Second")).toBeNull()
})

it("falls back to the actor name and keeps its link when a portrait fails", () => {
  const actor = { name: "Example Actor", imdb_id: "nm0000138", profile_path: "/broken.jpg" }
  const press = jest.fn()
  const view = render(<ThemeProvider><Actors actors={[actor]} onActorPress={press} /></ThemeProvider>)
  fireEvent(screen.getByTestId("mock-expo-image"), "error")
  expect(screen.queryByTestId("mock-expo-image")).toBeNull()
  fireEvent.press(screen.getByRole("link", { name: "Open IMDb page for Example Actor" }))
  expect(press).toHaveBeenCalledWith(actor)
  view.rerender(<ThemeProvider><Actors actors={[{ ...actor, profile_path: "/replacement.jpg" }]} onActorPress={press} /></ThemeProvider>)
  expect(screen.getByTestId("mock-expo-image").props["data-source"]).toContain("/replacement.jpg")
})

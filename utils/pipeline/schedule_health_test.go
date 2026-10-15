package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func healthFixture(t *testing.T) (map[string]DailyGame, map[int]AppIndexItem) {
	t.Helper()
	games, err := planSchedule(pool(10), testVersion, map[string]DailyGame{}, testNow, 1, true)
	if err != nil {
		t.Fatal(err)
	}
	catalog := map[int]AppIndexItem{}
	for id := 1; id <= 10; id++ {
		catalog[id] = AppIndexItem{ID: id, Title: "Answer must stay private"}
	}
	return games, catalog
}

func TestScheduleHealthFindsHolesAndInvalidContentWithoutLeakingAnswers(t *testing.T) {
	games, catalog := healthFixture(t)
	report, err := scheduleHealth(games, catalog, testVersion, testNow, 1)
	if err != nil || !report.Healthy || report.Ready != 10 || report.Expected != 10 {
		t.Fatalf("unexpected health: %+v %v", report, err)
	}
	delete(games, "2026-10-13_LEVEL_2")
	key := "2026-10-14_LEVEL_5"
	game := games[key]
	game.Content.Description = "PRIVATE SPOILER"
	games[key] = game
	report, err = scheduleHealth(games, catalog, testVersion, testNow, 1)
	if err != nil || report.Healthy || report.Ready != 8 || len(report.Issues) != 2 {
		t.Fatalf("missed bad slots: %+v", report)
	}
	if report.Issues[0] != (ScheduleIssue{Slot: "2026-10-13_LEVEL_2", Reason: "missing"}) || report.Issues[1].Reason != "invalid" {
		t.Fatal(report.Issues)
	}
	data, err := json.Marshal(report)
	if err != nil {
		t.Fatal(err)
	}
	for _, secret := range []string{"PRIVATE SPOILER", "movieId", "description", "reviewedBy", "test-editor", "Answer must stay private"} {
		if strings.Contains(string(data), secret) {
			t.Fatalf("report leaks %q", secret)
		}
	}
}

func TestScheduleHealthRejectsUnplayableSnapshots(t *testing.T) {
	mutations := map[string]func(*DailyGame){
		"catalog":       func(g *DailyGame) { g.CatalogVersion = "wrong" },
		"unknown movie": func(g *DailyGame) { g.MovieID = 999 },
		"difficulty":    func(g *DailyGame) { g.Difficulty = "LEVEL_5" },
		"date":          func(g *DailyGame) { g.Date = g.Date.Add(time.Hour) },
		"schema":        func(g *DailyGame) { g.SchemaVersion = 99 },
		"review":        func(g *DailyGame) { g.ReviewedBy = " " },
		"future review": func(g *DailyGame) { g.ReviewedAt = testNow.Add(time.Hour).Format(time.RFC3339) },
		"hash":          func(g *DailyGame) { g.ContentHash = "wrong" },
		"variants":      func(g *DailyGame) { delete(g.Content.Clues, "LEVEL_4") },
	}
	for name, mutate := range mutations {
		t.Run(name, func(t *testing.T) {
			games, catalog := healthFixture(t)
			key := "2026-10-13_LEVEL_1"
			game := games[key]
			mutate(&game)
			games[key] = game
			report, err := scheduleHealth(games, catalog, testVersion, testNow, 1)
			if err != nil || report.Healthy || report.Ready != 9 {
				t.Fatalf("accepted invalid snapshot: %+v", report)
			}
		})
	}
}

func TestScheduleHealthUsesUTCDayAndBoundsReads(t *testing.T) {
	games, catalog := healthFixture(t)
	local := time.Date(2026, 10, 12, 20, 0, 0, 0, time.FixedZone("west", -7*3600))
	report, err := scheduleHealth(games, catalog, testVersion, local, 1)
	if err != nil || !report.Healthy || report.From != "2026-10-13" || report.Through != "2026-10-14" {
		t.Fatal(report, err)
	}
	for _, horizon := range []int{0, 91} {
		if _, err := scheduleHealth(games, catalog, testVersion, testNow, horizon); err == nil {
			t.Fatal("invalid horizon accepted")
		}
	}
}

func TestScheduleHealthCLIIsReadOnlyAndRequiresTarget(t *testing.T) {
	t.Setenv("FIRESTORE_EMULATOR_HOST", "")
	for _, extra := range []string{"-apply", "-schedule", "-fetch", "-process", "-upload", "-include-today"} {
		if _, err := parseConfig([]string{"-check-schedule", "-project", "demo-trivia", extra}); err == nil {
			t.Fatalf("accepted %s", extra)
		}
	}
	if _, err := parseConfig([]string{"-check-schedule"}); err == nil {
		t.Fatal("missing target accepted")
	}
	c, err := parseConfig([]string{"-check-schedule", "-project", "demo-trivia", "-horizon-days", "7"})
	if err != nil || !c.health || c.live || c.apply || c.horizon != 7 {
		t.Fatal(c, err)
	}
}

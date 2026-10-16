package main

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"cloud.google.com/go/firestore"
)

// Reports intentionally omit movie IDs, clues, reviewer data and raw errors.
type ScheduleIssue struct {
	Slot   string `json:"slot"`
	Reason string `json:"reason"`
}
type ScheduleHealth struct {
	Healthy  bool            `json:"healthy"`
	From     string          `json:"from"`
	Through  string          `json:"through"`
	Expected int             `json:"expectedSlots"`
	Ready    int             `json:"readySlots"`
	Issues   []ScheduleIssue `json:"issues"`
}

func validPublishedSlot(game DailyGame, day time.Time, level string, catalog map[int]AppIndexItem, version string, now time.Time) bool {
	_, known := catalog[game.MovieID]
	reviewed, err := time.Parse(time.RFC3339, game.ReviewedAt)
	c := game.Content
	schema := (game.SchemaVersion == 1 && c.Clues == nil) || (game.SchemaVersion == 2 && validClues(c.Clues, c.Description))
	return known && schema && game.Difficulty == level && game.Date.Equal(day) && game.CatalogVersion == version &&
		err == nil && !reviewed.After(now) && strings.TrimSpace(game.ReviewedBy) != "" &&
		utf8.RuneCountInString(strings.TrimSpace(c.Description)) >= 100 && utf8.RuneCountInString(c.Description) <= 2500 &&
		utf8.RuneCountInString(c.Tagline) <= 500 && (c.ImdbID == "" || regexp.MustCompile(`^tt\d{7,10}$`).MatchString(c.ImdbID)) &&
		game.ContentHash == contentHash(game.MovieID, c)
}

func scheduleHealth(existing map[string]DailyGame, catalog map[int]AppIndexItem, version string, now time.Time, horizon int) (ScheduleHealth, error) {
	if horizon < 1 || horizon > 90 {
		return ScheduleHealth{}, errors.New("invalid schedule health horizon")
	}
	start := utcDay(now)
	report := ScheduleHealth{Healthy: true, From: start.Format("2006-01-02"), Through: start.AddDate(0, 0, horizon).Format("2006-01-02"), Expected: (horizon + 1) * len(clueLevels), Issues: []ScheduleIssue{}}
	for offset := 0; offset <= horizon; offset++ {
		day := start.AddDate(0, 0, offset)
		for _, level := range clueLevels {
			key := day.Format("2006-01-02") + "_" + level
			game, exists := existing[key]
			reason := ""
			if !exists {
				reason = "missing"
			} else if !validPublishedSlot(game, day, level, catalog, version, now) {
				reason = "invalid"
			}
			if reason != "" {
				report.Healthy = false
				report.Issues = append(report.Issues, ScheduleIssue{Slot: key, Reason: reason})
			} else {
				report.Ready++
			}
		}
	}
	return report, nil
}

func checkSchedule(ctx context.Context, client *firestore.Client, catalog map[int]AppIndexItem, version string, now time.Time, horizon int) (ScheduleHealth, error) {
	if horizon < 1 || horizon > 90 {
		return ScheduleHealth{}, errors.New("invalid schedule health horizon")
	}
	refs := []*firestore.DocumentRef{}
	for offset := 0; offset <= horizon; offset++ {
		day := utcDay(now).AddDate(0, 0, offset).Format("2006-01-02")
		for _, level := range clueLevels {
			refs = append(refs, client.Collection("dailyGames").Doc(day+"_"+level))
		}
	}
	snapshots, err := client.GetAll(ctx, refs)
	if err != nil {
		return ScheduleHealth{}, errors.New("could not read schedule; health is unknown")
	}
	existing := map[string]DailyGame{}
	for _, snapshot := range snapshots {
		if !snapshot.Exists() {
			continue
		}
		var game DailyGame
		raw := snapshot.Data()
		content, contentOK := raw["content"].(map[string]interface{})
		_, descriptionOK := content["description"].(string)
		_, taglineOK := content["tagline"].(string)
		_, imdbOK := content["imdbId"].(string)
		_, hasClues := content["clues"]
		if err := snapshot.DataTo(&game); err != nil || !contentOK || !descriptionOK || !taglineOK || !imdbOK || (game.SchemaVersion == 1 && hasClues) {
			// Preserve presence but fail validation without logging answer-bearing data.
			game = DailyGame{}
		}
		existing[snapshot.Ref.ID] = game
	}
	report, err := scheduleHealth(existing, catalog, version, now, horizon)
	if err != nil {
		return report, fmt.Errorf("check schedule: %w", err)
	}
	return report, nil
}

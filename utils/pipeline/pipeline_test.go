package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

var testNow = time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
var testVersion = strings.Repeat("a", 64)

const testClue = "A traveler returns to a distant town and discovers a mystery connecting several strangers. They must cooperate to uncover the truth before time runs out."

func reviewed(id int) ReviewedMovie {
	item := ReviewedMovie{MovieID: id, Description: testClue, CatalogVersion: testVersion, ReviewedBy: "test-editor", ReviewedAt: "2026-10-12T00:00:00Z", Approved: true, AgeAppropriate: true, FactsChecked: true}
	item.ContentHash = contentHash(id, PublishedContent{Description: item.Description})
	return item
}
func pool(count int) map[int]ReviewedMovie {
	items := map[int]ReviewedMovie{}
	for id := 1; id <= count; id++ {
		items[id] = reviewed(id)
	}
	return items
}

func TestScheduleIdempotenceAndBoundedHorizon(t *testing.T) {
	first, err := planSchedule(pool(100), testVersion, map[string]DailyGame{}, testNow, 30, false)
	if err != nil || len(first) != 30 {
		t.Fatalf("plan: count=%d err=%v", len(first), err)
	}
	if _, exists := first["2026-10-13"]; exists {
		t.Fatal("ordinary run published today")
	}
	again, err := planSchedule(pool(100), testVersion, first, testNow, 30, false)
	if err != nil || len(again) != 0 {
		t.Fatalf("rerun should be empty: %v %v", again, err)
	}
	nextWeek, err := planSchedule(pool(100), testVersion, first, testNow.AddDate(0, 0, 7), 30, false)
	if err != nil || len(nextWeek) != 7 {
		t.Fatalf("weekly run should fill seven days, not a year: count=%d err=%v", len(nextWeek), err)
	}
	for key := range nextWeek {
		if _, exists := first[key]; exists {
			t.Fatal("existing date replaced")
		}
	}
}
func TestScheduleFillsGapsAndNeverRepeats(t *testing.T) {
	existing, err := planSchedule(pool(10), testVersion, map[string]DailyGame{}, testNow, 3, false)
	if err != nil {
		t.Fatal(err)
	}
	delete(existing, "2026-10-15")
	planned, err := planSchedule(pool(10), testVersion, existing, testNow, 3, false)
	if err != nil || len(planned) != 1 {
		t.Fatalf("expected one gap: %v %v", planned, err)
	}
	for _, game := range existing {
		if game.MovieID == planned["2026-10-15"].MovieID {
			t.Fatal("repeated scheduled answer")
		}
	}
}
func TestScheduleInsufficientReviewedPoolIsAtomic(t *testing.T) {
	planned, err := planSchedule(pool(2), testVersion, map[string]DailyGame{}, testNow, 3, false)
	if err == nil || planned != nil {
		t.Fatal("partial plan must not be returned on shortage")
	}
}
func TestScheduleRejectsBadExistingDocumentsAndWrongCatalog(t *testing.T) {
	good, _ := planSchedule(pool(10), testVersion, map[string]DailyGame{}, testNow, 1, false)
	for _, kind := range []string{"date", "hash", "version", "legacy"} {
		t.Run(kind, func(t *testing.T) {
			game := good["2026-10-14"]
			switch kind {
			case "date":
				game.Date = testNow
			case "hash":
				game.Content.Description = "modified"
			case "version":
				game.CatalogVersion = "old"
			case "legacy":
				game.SchemaVersion = 0
			}
			if _, err := planSchedule(pool(10), testVersion, map[string]DailyGame{"2026-10-14": game}, testNow, 2, false); err == nil {
				t.Fatal("invalid published document accepted")
			}
		})
	}
	if _, err := planSchedule(pool(10), "another-catalog", map[string]DailyGame{}, testNow, 2, false); err == nil {
		t.Fatal("wrong reviewed catalog accepted")
	}
}
func TestUTCAndExplicitTodayBootstrap(t *testing.T) {
	local := time.Date(2026, 10, 14, 1, 0, 0, 0, time.FixedZone("UTC+14", 14*3600))
	if utcDay(local).Format("2006-01-02") != "2026-10-13" {
		t.Fatal("used local calendar date")
	}
	planned, err := planSchedule(pool(3), testVersion, map[string]DailyGame{}, local, 1, true)
	if err != nil || len(planned) != 2 {
		t.Fatalf("bootstrap failed: %v", err)
	}
	if _, exists := planned["2026-10-13"]; !exists {
		t.Fatal("missing bootstrap day")
	}
}
func TestEditorialGateRejectsUnapprovedChangedUnknownAndSpoilerContent(t *testing.T) {
	catalog := map[int]AppIndexItem{1: {ID: 1, Title: "Secret Answer"}}
	if _, err := validateReviewed([]ReviewedMovie{reviewed(1)}, catalog, testNow); err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"approval", "age", "facts", "future", "hash", "unknown", "spoiler", "duplicate"} {
		t.Run(kind, func(t *testing.T) {
			item := reviewed(1)
			switch kind {
			case "approval":
				item.Approved = false
			case "age":
				item.AgeAppropriate = false
			case "facts":
				item.FactsChecked = false
			case "future":
				item.ReviewedAt = "2099-01-01T00:00:00Z"
			case "hash":
				item.Description += "modified"
			case "unknown":
				item.MovieID = 2
			case "spoiler":
				item.Description += " Secret Answer"
			}
			items := []ReviewedMovie{item}
			if kind == "duplicate" {
				items = append(items, item)
			}
			if _, err := validateReviewed(items, catalog, testNow); err == nil {
				t.Fatal("invalid review accepted")
			}
		})
	}
}
func TestSourceHTTPFailuresNeverReturnPartialDataOrCredentials(t *testing.T) {
	for _, kind := range []string{"rate-limit", "bad-json", "missing-data", "detail-failure"} {
		t.Run(kind, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch kind {
				case "rate-limit":
					w.WriteHeader(429)
				case "bad-json":
					fmt.Fprint(w, "invalid")
				case "missing-data":
					fmt.Fprint(w, `{}`)
				case "detail-failure":
					if strings.Contains(r.URL.Path, "discover") {
						fmt.Fprint(w, `{"results":[{"id":1}]}`)
					} else {
						w.WriteHeader(500)
					}
				}
			}))
			defer server.Close()
			movies, err := fetchMovies(context.Background(), tmdbClient{client: server.Client(), baseURL: server.URL, key: "private-api-key"}, 1)
			if err == nil || movies != nil {
				t.Fatal("partial/failed source accepted")
			}
			if strings.Contains(err.Error(), "private-api-key") {
				t.Fatal("credential leaked")
			}
		})
	}
}
func TestSourceValidatesDetailsAndDeduplicates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "discover") {
			fmt.Fprint(w, `{"results":[{"id":1},{"id":1}]}`)
			return
		}
		fmt.Fprintf(w, `{"id":1,"title":"Title","original_title":"Original title","overview":%q,"poster_path":"/poster.jpg","release_date":"1999-01-01"}`, testClue)
	}))
	defer server.Close()
	movies, err := fetchMovies(context.Background(), tmdbClient{client: server.Client(), baseURL: server.URL, key: "key"}, 1)
	if err != nil || len(movies) != 1 {
		t.Fatalf("valid fetch failed: %v", err)
	}
	index := makeIndex(movies)
	if len(index[0].Aliases) != 1 || index[0].Aliases[0] != "Original title" {
		t.Fatal("original title lost during source parsing or candidate generation")
	}
	if index[0].Cast == nil || index[0].Genres == nil {
		t.Fatal("empty arrays must not serialize as null")
	}
}
func TestAliasesDoNotDuplicateTitleAndCannotSpoilClues(t *testing.T) {
	for _, original := range []string{"", "Title", " title "} {
		index := makeIndex([]TMDBMovie{{ID: 1, Title: "Title", OriginalTitle: original, ReleaseDate: "1999-01-01"}})
		if len(index[0].Aliases) != 0 {
			t.Fatal("empty or duplicate alias retained")
		}
	}
	for _, inTagline := range []bool{false, true} {
		item := reviewed(1)
		if inTagline {
			item.Tagline = "Alternate Answer"
		} else {
			item.Description += " Alternate Answer"
		}
		item.ContentHash = contentHash(1, PublishedContent{Description: item.Description, Tagline: item.Tagline})
		_, err := validateReviewed([]ReviewedMovie{item}, map[int]AppIndexItem{1: {ID: 1, Title: "Primary Movie", Aliases: []string{"Alternate Answer"}}}, testNow)
		if err == nil {
			t.Fatal("alias spoiler was accepted")
		}
	}
}
func TestConfigRequiresExplicitTargetsAndProtectsReleasedCatalog(t *testing.T) {
	t.Setenv("FIRESTORE_EMULATOR_HOST", "")
	for _, args := range [][]string{{}, {"-schedule"}, {"-schedule", "-project", "demo", "-live", "-apply"}, {"-process", "-catalog", "same.json", "-output", "same.json"}, {"-schedule", "-project", "demo", "-horizon-days", "365"}} {
		if _, err := parseConfig(args); err == nil {
			t.Fatalf("unsafe flags accepted: %v", args)
		}
	}
	c, err := parseConfig([]string{"-schedule", "-project", "demo-trivia"})
	if err != nil || c.apply || c.live {
		t.Fatal("default must be an explicit-project emulator preview")
	}
	t.Setenv("FIRESTORE_EMULATOR_HOST", "localhost:8080")
	if _, err := parseConfig([]string{"-schedule", "-project", "cloud-project", "-live"}); err == nil {
		t.Fatal("ambiguous live/emulator target accepted")
	}
}
func TestDraftFileWritesAndReadFailures(t *testing.T) {
	path := filepath.Join(t.TempDir(), "draft.json")
	if err := writeJSON(path, []int{1, 2}); err != nil {
		t.Fatal(err)
	}
	var values []int
	if err := readJSON(path, &values); err != nil || len(values) != 2 {
		t.Fatal("draft read failed")
	}
	if err := os.WriteFile(path, []byte("broken"), 0600); err != nil {
		t.Fatal(err)
	}
	if readJSON(path, &values) == nil {
		t.Fatal("malformed input ignored")
	}
}

package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"cloud.google.com/go/firestore"
)

type ReviewedMovie struct {
	MovieID        int    `json:"movieId"`
	Description    string `json:"description"`
	ImdbID         string `json:"imdbId"`
	Tagline        string `json:"tagline"`
	CatalogVersion string `json:"catalogVersion"`
	ContentHash    string `json:"contentHash"`
	ReviewedBy     string `json:"reviewedBy"`
	ReviewedAt     string `json:"reviewedAt"`
	Approved       bool   `json:"approved"`
	AgeAppropriate bool   `json:"ageAppropriate"`
	FactsChecked   bool   `json:"factsChecked"`
}

type PublishedContent struct {
	Description string `firestore:"description" json:"description"`
	ImdbID      string `firestore:"imdbId" json:"imdbId"`
	Tagline     string `firestore:"tagline" json:"tagline"`
}

type DailyGame struct {
	SchemaVersion  int              `firestore:"schemaVersion" json:"schemaVersion"`
	MovieID        int              `firestore:"movieId" json:"movieId"`
	Date           time.Time        `firestore:"date" json:"date"`
	CatalogVersion string           `firestore:"catalogVersion" json:"catalogVersion"`
	Content        PublishedContent `firestore:"content" json:"content"`
	ContentHash    string           `firestore:"contentHash" json:"contentHash"`
	ReviewedBy     string           `firestore:"reviewedBy" json:"reviewedBy"`
	ReviewedAt     string           `firestore:"reviewedAt" json:"reviewedAt"`
}

func digest(data []byte) string { sum := sha256.Sum256(data); return hex.EncodeToString(sum[:]) }
func contentHash(id int, content PublishedContent) string {
	return digest([]byte(fmt.Sprintf("%d\n%s\n%s\n%s", id, content.Description, content.ImdbID, content.Tagline)))
}

func loadCatalog(path string) (map[int]AppIndexItem, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, "", err
	}
	var items []AppIndexItem
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, "", err
	}
	if len(items) == 0 {
		return nil, "", errors.New("released catalog is empty")
	}
	index := map[int]AppIndexItem{}
	for _, item := range items {
		if item.ID <= 0 || item.Title == "" || !regexp.MustCompile(`^\d{4}$`).MatchString(item.Year) {
			return nil, "", errors.New("invalid released catalog entry")
		}
		if _, exists := index[item.ID]; exists {
			return nil, "", fmt.Errorf("duplicate catalog ID %d", item.ID)
		}
		index[item.ID] = item
	}
	return index, digest(data), nil
}

func validateReviewed(items []ReviewedMovie, catalog map[int]AppIndexItem, now time.Time) (map[int]ReviewedMovie, error) {
	if len(items) == 0 {
		return nil, errors.New("no reviewed movies; editorial approval is required before publishing")
	}
	approved := map[int]ReviewedMovie{}
	for _, item := range items {
		if _, duplicate := approved[item.MovieID]; duplicate {
			return nil, fmt.Errorf("duplicate reviewed movie %d", item.MovieID)
		}
		movie, exists := catalog[item.MovieID]
		if !exists {
			return nil, fmt.Errorf("reviewed movie %d is absent from the released catalog", item.MovieID)
		}
		reviewTime, err := time.Parse(time.RFC3339, item.ReviewedAt)
		if err != nil || reviewTime.After(now) || strings.TrimSpace(item.ReviewedBy) == "" || !item.Approved || !item.AgeAppropriate || !item.FactsChecked {
			return nil, fmt.Errorf("movie %d needs complete editorial approval", item.MovieID)
		}
		if utf8.RuneCountInString(strings.TrimSpace(item.Description)) < 100 || utf8.RuneCountInString(item.Description) > 2500 || utf8.RuneCountInString(item.Tagline) > 500 || (item.ImdbID != "" && !regexp.MustCompile(`^tt\d{7,10}$`).MatchString(item.ImdbID)) {
			return nil, fmt.Errorf("invalid reviewed content for movie %d", item.MovieID)
		}
		// Short titles are ambiguous natural-language words and require human review.
		for _, title := range append([]string{movie.Title}, movie.Aliases...) {
			if utf8.RuneCountInString(title) >= 4 && strings.Contains(strings.ToLower(item.Description+" "+item.Tagline), strings.ToLower(title)) {
				return nil, fmt.Errorf("clue directly contains an answer title or alias for movie %d", item.MovieID)
			}
		}
		if item.ContentHash != contentHash(item.MovieID, PublishedContent{item.Description, item.ImdbID, item.Tagline}) {
			return nil, fmt.Errorf("reviewed content hash mismatch for movie %d", item.MovieID)
		}
		approved[item.MovieID] = item
	}
	return approved, nil
}

func utcDay(now time.Time) time.Time {
	u := now.UTC()
	return time.Date(u.Year(), u.Month(), u.Day(), 0, 0, 0, 0, time.UTC)
}

// Pure planner: fixed horizon, missing days only, no repeats across the fetched
// 90-day history and future window. All validation happens before any writes.
func planSchedule(approved map[int]ReviewedMovie, version string, existing map[string]DailyGame, now time.Time, horizon int, includeToday bool) (map[string]DailyGame, error) {
	if horizon < 1 || horizon > 90 {
		return nil, errors.New("invalid schedule horizon")
	}
	start := utcDay(now)
	used := map[int]bool{}
	for key, game := range existing {
		date, err := time.Parse("2006-01-02", key)
		if err != nil || game.MovieID <= 0 || !game.Date.Equal(date) {
			return nil, fmt.Errorf("invalid existing challenge %s; repair explicitly", key)
		}
		if !date.Before(start) && (game.SchemaVersion != 1 || game.CatalogVersion != version || game.ContentHash != contentHash(game.MovieID, game.Content)) {
			return nil, fmt.Errorf("incompatible existing challenge %s; requires an explicit migration", key)
		}
		used[game.MovieID] = true
	}
	ids := []int{}
	for id, item := range approved {
		if item.CatalogVersion != version {
			return nil, fmt.Errorf("reviewed movie %d targets a different catalog", id)
		}
		if !used[id] {
			ids = append(ids, id)
		}
	}
	// Stable assignment makes previews/retries reproducible, without a weekly shuffle.
	sort.Ints(ids)
	planned := map[string]DailyGame{}
	first := 1
	if includeToday {
		first = 0
	}
	for day := first; day <= horizon; day++ {
		date := start.AddDate(0, 0, day)
		key := date.Format("2006-01-02")
		if _, exists := existing[key]; exists {
			continue
		}
		if len(ids) == 0 {
			return nil, errors.New("not enough reviewed, non-repeating movies to fill the horizon; no writes applied")
		}
		// Reproducible date-based ordering avoids clustering by upstream movie ID.
		selected, rank := 0, ""
		for i, candidate := range ids {
			candidateRank := digest([]byte(version + "/" + key + "/" + strconv.Itoa(candidate)))
			if rank == "" || candidateRank < rank {
				selected, rank = i, candidateRank
			}
		}
		id := ids[selected]
		ids = append(ids[:selected], ids[selected+1:]...)
		item := approved[id]
		planned[key] = DailyGame{SchemaVersion: 1, MovieID: id, Date: date, CatalogVersion: version,
			Content: PublishedContent{item.Description, item.ImdbID, item.Tagline}, ContentHash: item.ContentHash, ReviewedBy: item.ReviewedBy, ReviewedAt: item.ReviewedAt}
	}
	return planned, nil
}

func publishSchedule(ctx context.Context, client *firestore.Client, approved map[int]ReviewedMovie, version string, now time.Time, horizon int, includeToday, apply bool, output string) error {
	start := utcDay(now)
	refs := []*firestore.DocumentRef{}
	for day := -90; day <= horizon; day++ {
		refs = append(refs, client.Collection("dailyGames").Doc(start.AddDate(0, 0, day).Format("2006-01-02")))
	}
	count := 0
	var finalPlan map[string]DailyGame
	err := client.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		snapshots, err := tx.GetAll(refs)
		if err != nil {
			return fmt.Errorf("read schedule: %w", err)
		}
		existing := map[string]DailyGame{}
		for _, snapshot := range snapshots {
			if !snapshot.Exists() {
				continue
			}
			var game DailyGame
			if err := snapshot.DataTo(&game); err != nil {
				return err
			}
			existing[snapshot.Ref.ID] = game
		}
		planned, err := planSchedule(approved, version, existing, now, horizon, includeToday)
		if err != nil {
			return err
		}
		count = len(planned)
		finalPlan = planned
		if !apply {
			return nil
		}
		for key, game := range planned {
			// Read locks plus create-only preconditions make concurrent publishers
			// retry, never replace an existing date. One atomic commit, <=91 writes.
			if err := tx.Create(client.Collection("dailyGames").Doc(key), game); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	if err := writeJSON(output, finalPlan); err != nil {
		return fmt.Errorf("write schedule report (database apply=%t already succeeded): %w", apply, err)
	}
	log.Printf("Schedule validated: %d missing dates, apply=%t, through %s UTC", count, apply, start.AddDate(0, 0, horizon).Format("2006-01-02"))
	return nil
}

func uploadImports(ctx context.Context, client *firestore.Client, movies []TMDBMovie, apply bool) error {
	if !apply {
		log.Printf("Would import %d upstream records; published movies and editorial fields unchanged", len(movies))
		return nil
	}
	for offset := 0; offset < len(movies); offset += 400 {
		end := min(offset+400, len(movies))
		batch := client.Batch()
		for _, movie := range movies[offset:end] {
			// Separate namespace: importing never modifies published/editorial records.
			batch.Set(client.Collection("movieImports").Doc(strconv.Itoa(movie.ID)), map[string]any{
				"id": movie.ID, "title": movie.Title, "overview": movie.Overview, "poster_path": movie.PosterPath,
				"release_date": movie.ReleaseDate, "tagline": movie.Tagline, "imdb_id": movie.ImdbID,
			}, firestore.MergeAll)
		}
		if _, err := batch.Commit(ctx); err != nil {
			return fmt.Errorf("import batch at offset %d failed: %w", offset, err)
		}
	}
	return nil
}

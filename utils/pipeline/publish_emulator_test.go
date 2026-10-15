//go:build emulator

package main

import (
	"context"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"testing"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func emulatorClient(t *testing.T) (context.Context, *firestore.Client) {
	t.Helper()
	if os.Getenv("TALKIE_EMULATOR_TEST") != "1" || os.Getenv("GCLOUD_PROJECT") != "demo-talkie-trivia-test" || os.Getenv("FIRESTORE_EMULATOR_HOST") != "127.0.0.1:8180" {
		t.Fatal("emulator tests require the isolated integration runner")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	client, err := firestore.NewClient(ctx, "demo-talkie-trivia-test")
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	t.Cleanup(func() { client.Close(); cancel() })
	return ctx, client
}

func readWindow(t *testing.T, ctx context.Context, client *firestore.Client, now time.Time, days int) map[string]DailyGame {
	t.Helper()
	result := map[string]DailyGame{}
	for day := 0; day <= days; day++ {
		for _, suffix := range append([]string{""}, clueLevels...) {
			key := utcDay(now).AddDate(0, 0, day).Format("2006-01-02")
			if suffix != "" {
				key += "_" + suffix
			}
			snapshot, err := client.Collection("dailyGames").Doc(key).Get(ctx)
			if status.Code(err) == codes.NotFound {
				continue
			}
			if err != nil {
				t.Fatal(err)
			}
			var game DailyGame
			if err := snapshot.DataTo(&game); err != nil {
				t.Fatal(err)
			}
			result[key] = game
		}
	}
	return result
}

func TestEmulatorScheduleHealthIsReadOnlyAndFailsClosed(t *testing.T) {
	ctx, client := emulatorClient(t)
	now := time.Date(2040, 1, 1, 12, 0, 0, 0, time.UTC)
	games, err := planSchedule(pool(10), testVersion, map[string]DailyGame{}, now, 1, true)
	if err != nil {
		t.Fatal(err)
	}
	catalog := map[int]AppIndexItem{}
	for id := 1; id <= 10; id++ {
		catalog[id] = AppIndexItem{ID: id, Title: "Private answer"}
	}
	for key, game := range games {
		if _, err := client.Collection("dailyGames").Doc(key).Set(ctx, game); err != nil {
			t.Fatal(err)
		}
	}
	before := readWindow(t, ctx, client, now, 1)
	report, err := checkSchedule(ctx, client, catalog, testVersion, now, 1)
	if err != nil || !report.Healthy || report.Ready != 10 {
		t.Fatal(report, err)
	}
	if !reflect.DeepEqual(before, readWindow(t, ctx, client, now, 1)) {
		t.Fatal("health check changed content")
	}
	// Missing strings cannot silently become valid empty strings on Go decoding.
	if _, err := client.Collection("dailyGames").Doc("2040-01-01_LEVEL_3").Update(ctx, []firestore.Update{{Path: "content.tagline", Value: firestore.Delete}}); err != nil {
		t.Fatal(err)
	}
	report, err = checkSchedule(ctx, client, catalog, testVersion, now, 1)
	if err != nil || report.Healthy || report.Ready != 9 {
		t.Fatal(report, err)
	}
	if _, err := client.Collection("dailyGames").Doc("2040-01-01_LEVEL_3").Set(ctx, games["2040-01-01_LEVEL_3"]); err != nil {
		t.Fatal(err)
	}
	if _, err := client.Collection("dailyGames").Doc("2040-01-01_LEVEL_1").Delete(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := client.Collection("dailyGames").Doc("2040-01-02_LEVEL_5").Set(ctx, map[string]any{"movieId": "PRIVATE BAD VALUE"}); err != nil {
		t.Fatal(err)
	}
	report, err = checkSchedule(ctx, client, catalog, testVersion, now, 1)
	if err != nil || report.Healthy || report.Ready != 8 || len(report.Issues) != 2 {
		t.Fatal(report, err)
	}
	cancelled, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := checkSchedule(cancelled, client, catalog, testVersion, now, 1); err == nil {
		t.Fatal("read failure reported as healthy")
	}
}

func TestEmulatorConcurrentPublicationIsAtomicAndImmutable(t *testing.T) {
	ctx, client := emulatorClient(t)
	now := time.Date(2030, 1, 1, 12, 0, 0, 0, time.UTC)
	directory := t.TempDir()
	var wait sync.WaitGroup
	errors := make(chan error, 2)
	for _, name := range []string{"one.json", "two.json"} {
		wait.Add(1)
		go func(name string) {
			defer wait.Done()
			errors <- publishSchedule(ctx, client, pool(20), testVersion, now, 3, false, true, filepath.Join(directory, name))
		}(name)
	}
	wait.Wait()
	close(errors)
	for err := range errors {
		if err != nil {
			t.Fatal(err)
		}
	}
	first := readWindow(t, ctx, client, now, 3)
	if len(first) != 15 {
		t.Fatalf("want 3 committed future dates, got %d", len(first))
	}
	used := map[int]bool{}
	for _, game := range first {
		if used[game.MovieID] {
			t.Fatal("concurrent publication repeated a movie")
		}
		used[game.MovieID] = true
		if game.ContentHash != contentHash(game.MovieID, game.Content) {
			t.Fatal("incomplete snapshot")
		}
	}
	changedPool := pool(20)
	for id, movie := range changedPool {
		movie.Description = testClue + " Edited source content."
		movie.Clues["LEVEL_1"] = movie.Description
		movie.ContentHash = contentHash(id, reviewedContent(movie))
		changedPool[id] = movie
	}
	if err := publishSchedule(ctx, client, changedPool, testVersion, now, 3, false, true, filepath.Join(directory, "retry.json")); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(first, readWindow(t, ctx, client, now, 3)) {
		t.Fatal("retry replaced published content")
	}
}

func TestEmulatorPreviewAndInsufficientPoolWriteNothing(t *testing.T) {
	ctx, client := emulatorClient(t)
	now := time.Date(2031, 1, 1, 12, 0, 0, 0, time.UTC)
	output := filepath.Join(t.TempDir(), "plan.json")
	if err := publishSchedule(ctx, client, pool(20), testVersion, now, 3, false, false, output); err != nil {
		t.Fatal(err)
	}
	if len(readWindow(t, ctx, client, now, 3)) != 0 {
		t.Fatal("preview changed database")
	}
	if err := publishSchedule(ctx, client, pool(2), testVersion, now, 3, false, true, output); err == nil {
		t.Fatal("insufficient pool accepted")
	}
	if len(readWindow(t, ctx, client, now, 3)) != 0 {
		t.Fatal("failed plan committed partial dates")
	}
}

func TestEmulatorExistingIncompatibleScheduleFailsWithoutPartialWrites(t *testing.T) {
	ctx, client := emulatorClient(t)
	now := time.Date(2032, 1, 1, 12, 0, 0, 0, time.UTC)
	key := "2032-01-03"
	original := map[string]any{"movieId": 1, "date": time.Date(2032, 1, 3, 0, 0, 0, 0, time.UTC)}
	if _, err := client.Collection("dailyGames").Doc(key).Create(ctx, original); err != nil {
		t.Fatal(err)
	}
	if err := publishSchedule(ctx, client, pool(20), testVersion, now, 3, false, true, filepath.Join(t.TempDir(), "plan.json")); err == nil {
		t.Fatal("legacy schedule accepted without migration")
	}
	if len(readWindow(t, ctx, client, now, 3)) != 1 {
		t.Fatal("failed validation changed the schedule")
	}
	snapshot, err := client.Collection("dailyGames").Doc(key).Get(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Data()["schemaVersion"] != nil {
		t.Fatal("legacy date was overwritten")
	}
}

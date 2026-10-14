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
		key := utcDay(now).AddDate(0, 0, day).Format("2006-01-02")
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
	return result
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
	if len(first) != 3 {
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
		movie.ContentHash = contentHash(id, PublishedContent{Description: movie.Description})
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

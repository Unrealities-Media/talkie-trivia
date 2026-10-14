package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"cloud.google.com/go/firestore"
)

type config struct {
	fetch, process, upload, schedule, live, apply, includeToday         bool
	project, confirmProject, raw, catalog, reviewed, output, planOutput string
	horizon, pages                                                      int
}

func parseConfig(args []string) (config, error) {
	var c config
	f := flag.NewFlagSet("pipeline", flag.ContinueOnError)
	f.BoolVar(&c.fetch, "fetch", false, "Fetch TMDB into the raw draft file")
	f.BoolVar(&c.process, "process", false, "Generate a candidate catalog for review; never changes the app catalog")
	f.BoolVar(&c.upload, "upload", false, "Import upstream metadata into movieImports (not published movies)")
	f.BoolVar(&c.schedule, "schedule", false, "Fill missing future UTC challenges using reviewed content")
	f.BoolVar(&c.live, "live", false, "Use an explicitly named cloud project instead of the local emulator")
	f.BoolVar(&c.apply, "apply", false, "Apply database writes; otherwise preview only")
	f.BoolVar(&c.includeToday, "include-today", false, "Explicit bootstrap: create today's challenge only if absent")
	f.StringVar(&c.project, "project", "", "Firebase project ID; required for all database operations")
	f.StringVar(&c.confirmProject, "confirm-project", "", "Must match -project to apply live writes")
	f.StringVar(&c.raw, "raw", "../data-source/rawTMDB.json", "Raw TMDB input/output")
	f.StringVar(&c.output, "output", "../data-source/candidate-searchIndex.json", "Candidate catalog output")
	f.StringVar(&c.catalog, "catalog", "../../src/data/searchIndex.json", "Released catalog supported by the deployed app and Functions")
	f.StringVar(&c.reviewed, "reviewed", "../../content/reviewed-movies.json", "Editorially approved clues")
	f.StringVar(&c.planOutput, "plan-output", "../data-source/schedule-plan.json", "Private schedule preview/audit output")
	f.IntVar(&c.horizon, "horizon-days", 30, "Maintain tomorrow through this many days ahead (1-90)")
	f.IntVar(&c.pages, "pages", 250, "TMDB discovery pages (1-500)")
	if err := f.Parse(args); err != nil {
		return c, err
	}
	if f.NArg() != 0 {
		return c, errors.New("unexpected positional arguments")
	}
	if !c.fetch && !c.process && !c.upload && !c.schedule {
		return c, errors.New("select -fetch, -process, -upload, or -schedule")
	}
	if c.horizon < 1 || c.horizon > 90 || c.pages < 1 || c.pages > 500 {
		return c, errors.New("invalid horizon or page count")
	}
	if (c.upload || c.schedule) && c.project == "" {
		return c, errors.New("database operations require -project")
	}
	if c.live && c.apply && (c.confirmProject != c.project || c.project == "") {
		return c, errors.New("live writes require -confirm-project matching -project")
	}
	if c.live && os.Getenv("FIRESTORE_EMULATOR_HOST") != "" {
		return c, errors.New("-live conflicts with FIRESTORE_EMULATOR_HOST; refusing an ambiguous target")
	}
	if c.process {
		output, _ := filepath.Abs(c.output)
		catalog, _ := filepath.Abs(c.catalog)
		if output == catalog {
			return c, errors.New("candidate output cannot overwrite the released catalog")
		}
	}
	return c, nil
}

func main() {
	c, err := parseConfig(os.Args[1:])
	if err == nil {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Minute)
		defer cancel()
		err = run(ctx, c)
	}
	if err != nil {
		log.Printf("Pipeline failed: %v", err)
		os.Exit(1)
	}
	log.Print("Pipeline completed successfully")
}

func run(ctx context.Context, c config) error {
	var movies []TMDBMovie
	if c.fetch {
		key := os.Getenv("TMDB_API_KEY")
		if key == "" {
			return errors.New("TMDB_API_KEY is required for fetching")
		}
		var err error
		movies, err = fetchMovies(ctx, newTMDBClient(key), c.pages)
		if err != nil {
			return err
		}
		if err = writeJSON(c.raw, movies); err != nil {
			return err
		}
	} else if c.process || c.upload {
		if err := readJSON(c.raw, &movies); err != nil {
			return err
		}
	}
	if c.process || c.upload {
		if err := validateMovies(movies); err != nil {
			return err
		}
	}
	if c.process {
		if err := writeJSON(c.output, makeIndex(movies)); err != nil {
			return err
		}
		log.Printf("Wrote candidate catalog (%d movies); release catalog unchanged", len(movies))
	}
	if !c.upload && !c.schedule {
		return nil
	}
	if !c.live && os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
		if err := os.Setenv("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080"); err != nil {
			return err
		}
	}
	log.Printf("Project=%s live=%t apply=%t", c.project, c.live, c.apply)
	client, err := firestore.NewClient(ctx, c.project)
	if err != nil {
		return fmt.Errorf("initialize Firestore: %w", err)
	}
	defer client.Close()
	if c.upload {
		if err := uploadImports(ctx, client, movies, c.apply); err != nil {
			return err
		}
	}
	if c.schedule {
		catalog, version, err := loadCatalog(c.catalog)
		if err != nil {
			return err
		}
		var reviewed []ReviewedMovie
		if err := readJSON(c.reviewed, &reviewed); err != nil {
			return err
		}
		approved, err := validateReviewed(reviewed, catalog, time.Now())
		if err != nil {
			return err
		}
		return publishSchedule(ctx, client, approved, version, time.Now(), c.horizon, c.includeToday, c.apply, c.planOutput)
	}
	return nil
}

func readJSON(path string, target any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}
	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("decode %s: %w", path, err)
	}
	return nil
}

// Replace a draft only after a complete, valid download/encoding. Temp files live
// beside their destination so rename cannot cross filesystem boundaries.
func writeJSON(path string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".pipeline-*.json")
	if err != nil {
		return err
	}
	temp := f.Name()
	defer os.Remove(temp)
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(temp, path)
}

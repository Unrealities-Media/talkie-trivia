package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"time"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/iterator"
	"google.golang.org/api/option"
)

// --- CONFIGURATION ---
const (
	projectID    = "talkie-trivia-app"
	minVoteCount = 500
	pagesToFetch = 250
	batchSize    = 400

	secretsPath        = "../secrets.json"
	serviceAccountPath = "../serviceAccountKey.json"
	dataSourceDir      = "../data-source"
	rawFilePath        = "../data-source/rawTMDB.json"
	appDataDir         = "../../src/data"
	tmdbBaseURL        = "https://api.themoviedb.org/3"
)

// --- FLAGS ---
var (
	flagFetch    = flag.Bool("fetch", false, "Fetch fresh data from TMDB API")
	flagProcess  = flag.Bool("process", false, "Generate local searchIndex.json")
	flagUpload   = flag.Bool("upload", false, "Upload movies to Firestore")
	flagSchedule = flag.Bool("schedule", false, "Schedule daily games")
	flagAll      = flag.Bool("all", false, "Run all steps")
	flagProd     = flag.Bool("prod", false, "Target PRODUCTION database. Default is EMULATOR.")
)

// --- DATA STRUCTURES ---
type TMDBDiscoverResp struct {
	Results []struct {
		ID int `json:"id"`
	} `json:"results"`
}

type TMDBMovie struct {
	ID          int     `json:"id"`
	Title       string  `json:"title"`
	Overview    string  `json:"overview"`
	Tagline     string  `json:"tagline"`
	PosterPath  string  `json:"poster_path"`
	ReleaseDate string  `json:"release_date"`
	Popularity  float64 `json:"popularity"`
	VoteAverage float64 `json:"vote_average"`
	VoteCount   int     `json:"vote_count"`
	ImdbID      string  `json:"imdb_id"`
	Genres      []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"genres"`
	Credits struct {
		Cast []struct {
			Name  string `json:"name"`
			Order int    `json:"order"`
		} `json:"cast"`
		Crew []struct {
			Name string `json:"name"`
			Job  string `json:"job"`
		} `json:"crew"`
	} `json:"credits"`
}

type AppIndexItem struct {
	ID       int      `json:"i"`
	Title    string   `json:"t"`
	Year     string   `json:"y"`
	Poster   string   `json:"p"`
	Director string   `json:"d"`
	Cast     []string `json:"c"`
	Genres   []string `json:"g"`
}

type FirestoreMovie struct {
	ID             int    `firestore:"id"`
	Title          string `firestore:"title"`
	Overview       string `firestore:"overview"`
	PosterPath     string `firestore:"poster_path"`
	ReleaseDate    string `firestore:"release_date"`
	Tagline        string `firestore:"tagline"`
	Director       string `firestore:"director"`
	ImdbID         string `firestore:"imdb_id"`
	ManualOverview string `firestore:"manual_overview,omitempty"`
}

type DailyGame struct {
	MovieID int       `firestore:"movieId"`
	Date    time.Time `firestore:"date"`
}

type Secrets struct {
	TMDBKey string `json:"TMDBKey"`
}

// --- MAIN PIPELINE ---
func main() {
	flag.Parse()
	log.Println("🎬 STARTING DATA PIPELINE CLI")

	// 0. Safety Checks & Env Setup
	if *flagProd {
		log.Println("⚠️  WARNING: Target is PRODUCTION (Live).")
		os.Unsetenv("FIRESTORE_EMULATOR_HOST")
	} else {
		log.Println("🛠  Target is EMULATOR (Localhost). Use -prod to deploy to live.")
		os.Setenv("FIRESTORE_EMULATOR_HOST", "localhost:8080")
	}

	os.MkdirAll(dataSourceDir, os.ModePerm)
	os.MkdirAll(appDataDir, os.ModePerm)

	var movies []TMDBMovie

	// 1. DATA SOURCE
	if *flagAll || *flagFetch {
		apiKey := loadSecrets()
		movies = fetchMovies(apiKey)
		saveRawFile(movies)
	} else {
		log.Println("📂 Loading local data from rawTMDB.json...")
		movies = loadRawFile()
		if len(movies) == 0 {
			log.Fatal("❌ No local data found. Run with -fetch first.")
		}
		log.Printf("✅ Loaded %d movies from disk.", len(movies))
	}

	// 2. PROCESS (Generate App Index)
	if *flagAll || *flagProcess {
		processLocalFiles(movies)
	}

	// 3. UPLOAD (Firestore Movies)
	if *flagAll || *flagUpload {
		uploadToFirestore(movies)
	}

	// 4. SCHEDULE (Daily Games)
	if *flagAll || *flagSchedule {
		scheduleGames(movies)
	}

	if !*flagAll && !*flagFetch && !*flagProcess && !*flagUpload && !*flagSchedule {
		log.Println("⚠️  No action flags provided. Use -all, -fetch, -process, -upload, or -schedule.")
	} else {
		log.Println("🚀 PIPELINE COMPLETE.")
	}
}

// --- FILE IO ---
func loadSecrets() string {
	file, err := os.Open(secretsPath)
	if err != nil {
		log.Fatalf("Missing secrets.json: %v", err)
	}
	defer file.Close()
	var s Secrets
	json.NewDecoder(file).Decode(&s)
	return s.TMDBKey
}

func saveRawFile(movies []TMDBMovie) {
	rawBytes, _ := json.MarshalIndent(movies, "", "  ")
	err := ioutil.WriteFile(rawFilePath, rawBytes, 0644)
	if err != nil {
		log.Fatalf("Failed to save rawTMDB.json: %v", err)
	}
	log.Println("💾 Saved rawTMDB.json")
}

func loadRawFile() []TMDBMovie {
	file, err := os.Open(rawFilePath)
	if err != nil {
		return nil
	}
	defer file.Close()
	var movies []TMDBMovie
	json.NewDecoder(file).Decode(&movies)
	return movies
}

// --- STEP 1: FETCH ---
func fetchMovies(apiKey string) []TMDBMovie {
	client := &http.Client{Timeout: 10 * time.Second}
	var movies []TMDBMovie
	seen := make(map[int]bool)

	log.Println("📡 Fetching from TMDB...")

	for page := 1; page <= pagesToFetch; page++ {
		if page%10 == 0 {
			log.Printf("   Page %d/%d... (Movies found so far: %d)", page, pagesToFetch, len(movies))
		}

		u, _ := url.Parse(tmdbBaseURL + "/discover/movie")
		q := u.Query()
		q.Set("api_key", apiKey)
		q.Set("language", "en-US")
		q.Set("sort_by", "popularity.desc")
		q.Set("vote_count.gte", strconv.Itoa(minVoteCount))
		q.Set("page", strconv.Itoa(page))
		u.RawQuery = q.Encode()

		resp, err := client.Get(u.String())
		if err != nil {
			log.Printf("   Error fetching page %d: %v", page, err)
			continue
		}

		var disc TMDBDiscoverResp
		json.NewDecoder(resp.Body).Decode(&disc)
		resp.Body.Close()

		for _, res := range disc.Results {
			if seen[res.ID] {
				continue
			}
			seen[res.ID] = true

			movie := fetchMovieDetails(client, apiKey, res.ID)
			if validateMovie(movie) {
				movies = append(movies, movie)
			}
			time.Sleep(25 * time.Millisecond)
		}
	}
	return movies
}

func fetchMovieDetails(client *http.Client, apiKey string, id int) TMDBMovie {
	u, _ := url.Parse(fmt.Sprintf("%s/movie/%d", tmdbBaseURL, id))
	q := u.Query()
	q.Set("api_key", apiKey)
	q.Set("append_to_response", "credits")
	u.RawQuery = q.Encode()

	resp, err := client.Get(u.String())
	if err != nil {
		return TMDBMovie{}
	}
	defer resp.Body.Close()

	var m TMDBMovie
	json.NewDecoder(resp.Body).Decode(&m)
	return m
}

func validateMovie(m TMDBMovie) bool {
	if m.Title == "" || m.Overview == "" || m.PosterPath == "" {
		return false
	}
	if len(m.Overview) < 50 {
		return false
	}
	return true
}

// --- STEP 2: PROCESS ---
func processLocalFiles(movies []TMDBMovie) {
	log.Println("⚙️  Generating App Search Index...")
	var index []AppIndexItem
	for _, m := range movies {
		year := ""
		if len(m.ReleaseDate) >= 4 {
			year = m.ReleaseDate[:4]
		}

		director := "N/A"
		for _, c := range m.Credits.Crew {
			if c.Job == "Director" {
				director = c.Name
				break
			}
		}

		var cast []string
		for i, c := range m.Credits.Cast {
			if i >= 4 {
				break
			}
			cast = append(cast, c.Name)
		}

		var genres []string
		for i, g := range m.Genres {
			if i >= 2 {
				break
			}
			genres = append(genres, g.Name)
		}

		index = append(index, AppIndexItem{
			ID:       m.ID,
			Title:    m.Title,
			Year:     year,
			Poster:   m.PosterPath,
			Director: director,
			Cast:     cast,
			Genres:   genres,
		})
	}

	sort.Slice(index, func(i, j int) bool {
		return index[i].Title < index[j].Title
	})

	indexBytes, _ := json.Marshal(index)
	indexPath := filepath.Join(appDataDir, "searchIndex.json")
	ioutil.WriteFile(indexPath, indexBytes, 0644)
	log.Printf("💾 Saved src/data/searchIndex.json (%d items)", len(index))
}

// --- STEP 3: UPLOAD ---
func uploadToFirestore(movies []TMDBMovie) {
	log.Println("☁️  Uploading Movies to Firestore...")
	ctx := context.Background()
	sa := option.WithCredentialsFile(serviceAccountPath)
	client, err := firestore.NewClient(ctx, projectID, sa)
	if err != nil {
		log.Fatalf("Firestore init failed: %v", err)
	}
	defer client.Close()

	batch := client.Batch()
	count := 0
	total := len(movies)

	for i, m := range movies {
		cleanOverview := sanitizeString(m.Title, m.Overview)

		director := "N/A"
		for _, c := range m.Credits.Crew {
			if c.Job == "Director" {
				director = c.Name
				break
			}
		}

		doc := FirestoreMovie{
			ID:          m.ID,
			Title:       m.Title,
			Overview:    cleanOverview,
			PosterPath:  m.PosterPath,
			ReleaseDate: m.ReleaseDate,
			Tagline:     m.Tagline,
			Director:    director,
			ImdbID:      m.ImdbID,
		}

		ref := client.Collection("movies").Doc(strconv.Itoa(m.ID))
		batch.Set(ref, doc)
		count++

		if count >= batchSize || i == total-1 {
			_, err := batch.Commit(ctx)
			if err != nil {
				log.Printf("❌ Batch failed at index %d: %v", i, err)
			} else {
				fmt.Printf("\r   Uploaded %d/%d movies...", i+1, total)
			}
			batch = client.Batch()
			count = 0
			// Small sleep to avoid write hotspots in Emulator
			time.Sleep(50 * time.Millisecond)
		}
	}
	fmt.Println("\n✅ Upload Complete.")
}

// --- STEP 4: SCHEDULE ---
func scheduleGames(movies []TMDBMovie) {
	log.Println("🗓  Scheduling Games...")
	if len(movies) == 0 {
		log.Println("❌ No movies available to schedule.")
		return
	}

	ctx := context.Background()
	sa := option.WithCredentialsFile(serviceAccountPath)
	client, err := firestore.NewClient(ctx, projectID, sa)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// 1. Determine Start Date
	startDate := time.Now()
	startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.UTC)

	iter := client.Collection("dailyGames").OrderBy("date", firestore.Desc).Limit(1).Documents(ctx)
	doc, err := iter.Next()

	if err == iterator.Done {
		log.Println("   No existing schedule. Starting TODAY.")
	} else if err != nil {
		log.Printf("   ⚠️ Error checking schedule: %v", err)
		log.Println("   Defaulting to TODAY.")
	} else {
		data := doc.Data()
		if lastDate, ok := data["date"].(time.Time); ok {
			startDate = lastDate.AddDate(0, 0, 1)
			log.Printf("   Found schedule ending %s. Appending from %s.",
				lastDate.Format("2006-01-02"), startDate.Format("2006-01-02"))
		}
	}

	// 2. Shuffle
	rand.Seed(time.Now().UnixNano())
	shuffled := make([]TMDBMovie, len(movies))
	copy(shuffled, movies)
	rand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	batch := client.Batch()
	count := 0
	daysToSchedule := 365
	movieIdx := 0

	log.Printf("   Scheduling %d days...", daysToSchedule)

	for i := 0; i < daysToSchedule; i++ {
		if movieIdx >= len(shuffled) {
			movieIdx = 0
		}

		gameDate := startDate.AddDate(0, 0, i)
		dateID := gameDate.Format("2006-01-02")

		game := DailyGame{
			MovieID: shuffled[movieIdx].ID,
			Date:    gameDate,
		}

		ref := client.Collection("dailyGames").Doc(dateID)
		batch.Set(ref, game)

		movieIdx++
		count++

		if count >= batchSize || i == daysToSchedule-1 {
			_, err := batch.Commit(ctx)
			if err != nil {
				log.Printf("❌ Schedule Batch failed at day %d: %v", i, err)
			} else {
				fmt.Printf("\r   Scheduled through %s...", dateID)
			}
			batch = client.Batch()
			count = 0
			time.Sleep(50 * time.Millisecond)
		}
	}
	fmt.Println("\n✅ Scheduling Complete.")
}

func sanitizeString(title, overview string) string {
	re := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(title) + `\b`)
	return re.ReplaceAllString(overview, "[The Protagonist]")
}

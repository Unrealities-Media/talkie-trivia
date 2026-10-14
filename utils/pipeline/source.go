package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type TMDBMovie struct {
	ID            int    `json:"id"`
	Title         string `json:"title"`
	OriginalTitle string `json:"original_title"`
	Overview      string `json:"overview"`
	Tagline       string `json:"tagline"`
	PosterPath    string `json:"poster_path"`
	ReleaseDate   string `json:"release_date"`
	ImdbID        string `json:"imdb_id"`
	Adult         bool   `json:"adult"`
	Genres        []struct {
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
	Aliases  []string `json:"a,omitempty"`
}

type tmdbClient struct {
	client       *http.Client
	baseURL, key string
}

func newTMDBClient(key string) tmdbClient {
	return tmdbClient{client: &http.Client{Timeout: 20 * time.Second}, baseURL: "https://api.themoviedb.org/3", key: key}
}

func (c tmdbClient) get(ctx context.Context, path string, query url.Values, target any) error {
	query.Set("api_key", c.key)
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path+"?"+query.Encode(), nil)
	if err != nil {
		return errors.New("invalid TMDB request")
	}
	response, err := c.client.Do(request)
	// Do not log request URLs: the query contains credentials.
	if err != nil {
		return fmt.Errorf("TMDB request failed for %s", path)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("TMDB %s returned HTTP %d", path, response.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 4*1024*1024+1))
	if err != nil || len(data) > 4*1024*1024 {
		return fmt.Errorf("TMDB response unreadable or too large for %s", path)
	}
	if json.Unmarshal(data, target) != nil {
		return fmt.Errorf("TMDB returned invalid JSON for %s", path)
	}
	return nil
}

func fetchMovies(ctx context.Context, client tmdbClient, pages int) ([]TMDBMovie, error) {
	movies := []TMDBMovie{}
	seen := map[int]bool{}
	for page := 1; page <= pages; page++ {
		var discover struct {
			Results []struct {
				ID int `json:"id"`
			} `json:"results"`
		}
		query := url.Values{"language": {"en-US"}, "sort_by": {"popularity.desc"}, "vote_count.gte": {"500"}, "include_adult": {"false"}, "page": {strconv.Itoa(page)}}
		if err := client.get(ctx, "/discover/movie", query, &discover); err != nil {
			return nil, err
		}
		if len(discover.Results) == 0 {
			return nil, fmt.Errorf("empty discovery page %d; refusing a partial refresh", page)
		}
		for _, result := range discover.Results {
			if result.ID <= 0 {
				return nil, errors.New("invalid discovered movie ID")
			}
			if seen[result.ID] {
				continue
			}
			seen[result.ID] = true
			var movie TMDBMovie
			if err := client.get(ctx, fmt.Sprintf("/movie/%d", result.ID), url.Values{"append_to_response": {"credits"}, "language": {"en-US"}}, &movie); err != nil {
				return nil, err
			}
			if movie.ID != result.ID {
				return nil, errors.New("movie detail ID mismatch")
			}
			if movie.Adult {
				continue
			}
			if err := validateMovie(movie); err != nil {
				return nil, err
			}
			movies = append(movies, movie)
		}
	}
	if err := validateMovies(movies); err != nil {
		return nil, err
	}
	return movies, nil
}

func validateMovie(m TMDBMovie) error {
	_, dateErr := time.Parse("2006-01-02", m.ReleaseDate)
	if m.ID <= 0 || strings.TrimSpace(m.Title) == "" || len(strings.TrimSpace(m.Overview)) < 50 || !strings.HasPrefix(m.PosterPath, "/") || dateErr != nil || m.Adult {
		return fmt.Errorf("movie %d has incomplete or excluded source data", m.ID)
	}
	return nil
}
func validateMovies(movies []TMDBMovie) error {
	if len(movies) == 0 {
		return errors.New("empty movie input")
	}
	seen := map[int]bool{}
	for _, movie := range movies {
		if err := validateMovie(movie); err != nil {
			return err
		}
		if seen[movie.ID] {
			return fmt.Errorf("duplicate movie ID %d", movie.ID)
		}
		seen[movie.ID] = true
	}
	return nil
}
func makeIndex(movies []TMDBMovie) []AppIndexItem {
	index := make([]AppIndexItem, 0, len(movies))
	for _, movie := range movies {
		item := AppIndexItem{ID: movie.ID, Title: movie.Title, Year: movie.ReleaseDate[:4], Poster: movie.PosterPath, Cast: []string{}, Genres: []string{}}
		if original := strings.TrimSpace(movie.OriginalTitle); original != "" && !strings.EqualFold(original, strings.TrimSpace(movie.Title)) {
			item.Aliases = []string{original}
		}
		for _, person := range movie.Credits.Crew {
			if person.Job == "Director" {
				item.Director = person.Name
				break
			}
		}
		cast := append(movie.Credits.Cast[:0:0], movie.Credits.Cast...)
		sort.SliceStable(cast, func(i, j int) bool { return cast[i].Order < cast[j].Order })
		for _, person := range cast {
			if len(item.Cast) == 4 {
				break
			}
			if person.Name != "" {
				item.Cast = append(item.Cast, person.Name)
			}
		}
		for _, genre := range movie.Genres {
			if len(item.Genres) == 2 {
				break
			}
			if genre.Name != "" {
				item.Genres = append(item.Genres, genre.Name)
			}
		}
		index = append(index, item)
	}
	sort.Slice(index, func(i, j int) bool {
		if index[i].Title == index[j].Title {
			return index[i].ID < index[j].ID
		}
		return index[i].Title < index[j].Title
	})
	return index
}

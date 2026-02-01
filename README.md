# Talkie Trivia 🎬

Talkie Trivia is an engaging daily trivia game built with **React Native** and **Expo**. The goal is simple yet challenging: guess the movie based on a progressively revealing plot summary.

## ✨ Features

* **Daily Challenges:** A new movie to guess every day, synced globally via Cloud Schedule.
* **Smart Search:** Instant, offline-ready fuzzy search using a local index.
* **Hybrid Data Architecture:**
  * **Fast:** Search logic runs instantly on-device (~1.5MB footprint).
  * **Rich:** Full movie details (high-res images, full plots) are fetched from the cloud only when needed.
* **Difficulty Levels:** From Basic (all hints revealed) to Extreme (no hints, fewer guesses).
* **Player Statistics:** Tracks streaks, win rates, and scores securely in Firestore.
* **Authentication:** Anonymous and Google Sign-In support.

## 🛠 Tech Stack

### Frontend

* **Framework:** React Native (Expo Managed Workflow)
* **Language:** TypeScript
* **State Management:** Zustand (w/ Immer)
* **Navigation:** Expo Router
* **Styling:** Custom hook-based theming system
* **Animations:** React Native Reanimated

### Backend & Data

* **Database:** Google Firestore
* **Auth:** Firebase Authentication
* **Compute:** Cloud Functions (Score verification & Stats updates)
* **Data Pipeline:** Single Go CLI tool for fetching, optimizing, and scheduling data.

## 📂 Project Structure

```text
src/
├── components/ # Reusable UI components
├── data/       # Local index (searchIndex.json - Generated)
├── services/   # Hybrid Data Services (Firestore + Local Fallbacks)
├── state/      # Zustand global store
├── app/        # Expo Router screens
└── utils/      # Helper functions and hooks

utils/
├── data-source/ # Ignored by Git. Contains raw heavy JSON.
├── pipeline/    # Unified Go CLI tool.
├── secrets.json # API Keys (Ignored)
└── serviceAccountKey.json # Firebase Creds (Ignored)
```

## ⚙️ Data Pipeline (Unified CLI)

The project uses a single, robust Go tool located in `utils/pipeline` to manage the entire data lifecycle. It handles fetching from TMDB, generating app assets, populating Firestore, and scheduling games.

### Prerequisites

1. **Secrets:** `utils/secrets.json` containing `{"TMDBKey": "your_key"}`.
2. **Firebase Access:** `utils/serviceAccountKey.json`.

### CLI Usage

Navigate to the directory:

```bash
cd utils/pipeline
```

The script defaults to **Development Mode** (targeting Firebase Emulators at `localhost:8080`) unless you pass the `-prod` flag.

#### 1. Full Reset (Fetch Fresh Data + Reset Dev DB)

Fetches ~2,000 movies from TMDB, processes them, uploads to Emulator, and schedules games.

```bash
go run main.go -all
```

#### 2. Deploy to Production (Live)

Uses existing local data (skips fetch) to update the Live Database.
**Warning:** This writes to the real Firestore project.

```bash
go run main.go -prod -process -upload -schedule
```

#### Available Flags

| Flag | Description |
| :--- | :--- |
| `-fetch` | Download fresh data from TMDB API (Slow). |
| `-process` | Generate `src/data/searchIndex.json` (Required for App Bundle). |
| `-upload` | Upload full movie details to Firestore `movies` collection. |
| `-schedule` | Assign movies to dates in `dailyGames`. Smart-appends to existing schedule. |
| `-all` | Run all steps in sequence. |
| `-prod` | **Target Production.** If omitted, targets Local Emulator. |

## 🚀 Getting Started (Development)

1. **Install dependencies:**

    ```bash
    npm install
    ```

2. **Start Emulators:**

    ```bash
    firebase emulators:start
    ```

3. **Seed Data (First Time Only):**

    ```bash
    cd utils/pipeline && go run main.go -all
    ```

4. **Run the App:**

    ```bash
    npx expo start
    ```

## 🤝 Maintenance Guide

### Extending the Schedule (Yearly)

Run the scheduler against production. It automatically detects the last scheduled game and appends 365 new days.

```bash
go run main.go -prod -schedule
```

### Fixing Spoilers (Manual Override)

If a plot summary is too obvious:

1. Go to Firebase Console > Firestore > `movies`.
2. Find the document.
3. Add field: `manual_overview` (string).
4. Enter the sanitized text. The app prioritizes this field immediately.

## 📄 License

MIT License

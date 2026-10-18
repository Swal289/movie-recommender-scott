# movie-recommender

[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=fn5-310_movie-recommender&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=fn5-310_movie-recommender)

This project is for a website to recommend movies to users based on an initial starting movie, or a list of movies they enjoyed. This utilises clustering among nodes, visually indicating how similar a movie may be to each another.

## Getting Started
### Prerequisites
Node.js is required to run the project. This can be downloaded at [https://nodejs.org/en/download](https://nodejs.org/en/download), and going through the install instructions for your respective OS and package manager.

You can confirm that the install is successful by running the below commands in the terminal of your OS:
```
node --version
npm --version
npx --version
```
If all of the above commands each provide a version number (whether they are the same or not), you have successfully installed Node.js.

After this, clone the repo and move into the project folder. All commands in this README are run from this folder (the one containing `package.json`):
```shell
git clone https://github.com/Team1-SOFTENG310/movie-recommender.git
cd movie-recommender
```

Install the node dependencies for the root, server and client with:
```shell
npm run install:all
```

> **Windows users:** if PowerShell says `npm.ps1 cannot be loaded because running scripts is disabled on this system`, run the following once and answer `Y`, then try again (or use Command Prompt instead of PowerShell):
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
> If you see `ENOENT: no such file or directory, open '...\package.json'`, you are one folder too high; `cd` into the project folder first.
>
> Avoid keeping the project inside a OneDrive-synced folder (such as `OneDrive\Desktop`). OneDrive tries to sync the thousands of files in `node_modules`, which can make installs very slow or fail with `EPERM` errors.

### Setting up `.env`

Copy `.env.example` to a new file called `.env` in the project root and fill in your values. From the project folder:
```shell
cp .env.example .env      # macOS / Linux
copy .env.example .env    # Windows
```

> **Windows users:** make sure the file is named exactly `.env`. If you create it in Notepad, set "Save as type" to **All Files**, otherwise it is saved as `.env.txt` and will not be found.

**TMDB key:** create a free account at [themoviedb.org](https://www.themoviedb.org/signup), then go to **Settings → API**. Use the value labelled **API Key** (the short, 32-character v3 key), *not* the longer "API Read Access Token". The app sends the key as an `api_key` query parameter, so the read access token will cause every TMDB request to fail with `401`.

**MongoDB:** the website uses MongoDB for user profiles, which requires login credentials and for your current IP address to be allowed in MongoDB Atlas. Please get in contact on Discord or at swal289@aucklanduni.ac.nz. MongoDB is optional for working on features that don't use accounts (see degraded mode below).

**AI recommendations:** the "Generate AI recommendations" button on a movie's graph calls the backend at `/api/llm-recommender`, which needs an OpenAI key in `LLM_API_KEY` (`OPENAI_API_KEY` also works). Ask the team for the key; never commit it. To work on the UI without a key, set `VITE_AI_MOCK=true`, which fills the card with TMDB's own recommendations instead.

Your `.env` should look like this once completed:
```
TMDB_API_KEY=
VITE_TMDB_API_KEY=yourKeyHere
VITE_FRONTEND_PORT=5173
BACKEND_PORT=5000
MONGODB_USERNAME="user"
MONGODB_PASSWORD="password"
MONGODB_URI="uri"
SESSION_SECRET="replace-with-a-long-random-secret"
LLM_API_KEY=
# VITE_AI_MOCK=true
```
`TMDB_API_KEY` is used by the server and falls back to `VITE_TMDB_API_KEY` when empty.
Never put secrets in `VITE_*` variables: Vite includes them in the browser bundle.

Without a reachable `MONGODB_URI`, the server still starts in development ("degraded mode") and `/api/health` returns `503`. With `NODE_ENV=production` it refuses to start instead. To check your MongoDB connection, run `npm run test:db` from `server/`.

### Running the Website
The dev servers for both the ExpressJS server and React client can be run concurrently through one command from the project root:
```
npm run dev
```
The frontend server will be open on `localhost:5173` by default, while the backend server will be at `localhost:5000`.

If you change `.env`, stop the servers (`Ctrl+C`) and run `npm run dev` again so the new values are picked up.

### Running the Tests
Run the client and server test suites from the project root with:
```
npm test
```

### User Accounts

Use the **Register** link on the homepage or visit `/signup` to create an
account. Existing users can select **Log in** or visit `/login`, using either their username or email address and password.

After successful registration or login, the homepage displays the username and a **Log out** button. The application checks for an existing session when it loads, allowing users to remain logged in after refreshing.

Account features require the backend to be running and connected to MongoDB. If the backend starts in degraded mode because MongoDB is unavailable, registration and login are unavailable.

## License
`movie-recommender` is licensed under the [MIT License](LICENSE).

## Learn More
If you want to contribute or learn more about the project, please consider viewing the [Contributor Guidelines](CONTRIBUTING.md).

You may also wish to view our [Code of Conduct](CODE_OF_CONDUCT.md).

## Contact
To reach out to a team member of fn5, feel free to reach out in person (group 5), or to email at `placeholderemail@placeholder.com`
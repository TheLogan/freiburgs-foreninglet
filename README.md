# Freiburgs Foreninglet Portal

## About the Project

**Freiburgs Foreninglet Portal** shows the **Freiburg** LARP club's upcoming events on the club's Google Site. It is meant to be embedded as a full page there, and its colours and font match that site.

The events live on [Foreninglet](https://www.foreninglet.dk) (`bifrost.foreninglet.dk`), which the national LARP organisation runs and which has no API. Visitors do **not** log in. Instead, the server signs in with a service account that the national organisation created for this purpose, reads the event pages and shows them in a simpler form. Sign-up and payment happen on Foreninglet itself.

### Features

- **Upcoming events**: the club's events from today onwards, soonest first
- **Event facts**: date (or date range), location ("Mødested"), price, free places and the sign-up deadline ("Tilmeldingsfrist")
- **Sign-up hand-off**: the "Tilmeld" button opens the event's page on Foreninglet in a new tab, where members sign up and pay as themselves
- **Danish interface** styled like the club's Google Site, for desktop and phones

### How it works

1. On startup the server signs in to Foreninglet with `FORENINGLET_USERNAME` and `FORENINGLET_PASSWORD`, and keeps that session in memory.
2. `GET /api/events/upcoming` submits Foreninglet's activity search (`/memberportal/activity/search`) with today's date as the start date, then loads each event's own page for price, location, free places and deadline.
3. The result is cached for 5 minutes and shared between all visitors, so normal traffic costs Foreninglet only a handful of requests every few minutes.
4. If Foreninglet reports the session as expired, the server signs in again and retries once. If signing in fails, it logs the reason, returns "temporarily unavailable" to visitors and waits 60 seconds before trying again, so the account isn't locked out.

> **Keep the credentials secret.** The service account has administrator rights on the club's events in Foreninglet (edit, cancel, delete, see registrations). The app only ever *reads* event pages with it and never forwards visitor input to Foreninglet. Keep it that way.

### Tech Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Framework  | [Nuxt 4](https://nuxt.com) (Vue 3) |
| UI library | [Vuetify 4](https://vuetifyjs.com) |
| Language   | TypeScript                        |
| Runtime    | Node.js 22                        |
| Container  | Docker                            |

---

## Prerequisites

Before installing, make sure the following are available on your system:

| Tool      | Minimum version | Download                                      |
|-----------|-----------------|-----------------------------------------------|
| Node.js   | 22.x            | https://nodejs.org                            |
| npm       | 10.x            | Bundled with Node.js                          |
| Git       | any             | https://git-scm.com                           |
| Docker    | 24.x *(optional)* | https://docs.docker.com/get-docker/         |

---

## Installation — Local Development

### Linux

```bash
# 1. Install Node.js 22 via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc          # or restart your terminal
nvm install 22
nvm use 22

# 2. Clone the repository
git clone https://github.com/YOUR_GITHUB_USERNAME/freiburgs-foreninglet.git
cd freiburgs-foreninglet

# 3. Install dependencies
npm install

# 4. Add the Foreninglet credentials (see "Environment Variables")
cp .env.example .env      # then fill in the username and password

# 5. Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

---

### Windows

```powershell
# 1. Install Node.js 22
#    Download the LTS installer from https://nodejs.org and run it, OR
#    use nvm-windows (https://github.com/coreybutler/nvm-windows):

nvm install 22
nvm use 22

# 2. Clone the repository (PowerShell or Git Bash)
git clone https://github.com/YOUR_GITHUB_USERNAME/freiburgs-foreninglet.git
cd freiburgs-foreninglet

# 3. Install dependencies
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
npm install

# 4. Add the Foreninglet credentials (see "Environment Variables")
Copy-Item .env.example .env   # then fill in the username and password

# 5. Start the development server
npm run dev
```

The app will be available at **http://localhost:3000**.

> **Tip for Windows users:** Use [Windows Terminal](https://aka.ms/terminal) with PowerShell 7+ for the best experience.

---

## Building for Production (without Docker)

```bash
# Build the optimised server bundle
npm run build

# Preview the production build locally
npm run preview
```

The production output is written to `.output/`. Run it directly with:

```bash
node --env-file=.env .output/server/index.mjs
```

The production server does not read `.env` by itself. Use `--env-file` as above, or set the variables in the environment.

---

## Docker

### Build the Image Locally

```bash
# Clone the repository if you haven't already
git clone https://github.com/YOUR_GITHUB_USERNAME/freiburgs-foreninglet.git
cd freiburgs-foreninglet

# Build the Docker image (tagged as freiburgs-foreninglet:latest)
docker build -t freiburgs-foreninglet:latest .
```

### Run from a Locally Built Image

```bash
docker run -d \
  --name freiburgs-foreninglet \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  freiburgs-foreninglet:latest
```

The portal is now accessible at **http://localhost:3000**. `.env` is excluded from the image, so the credentials are passed in with `--env-file` when the container starts.

To stop and remove the container:

```bash
docker stop freiburgs-foreninglet
docker rm freiburgs-foreninglet
```

---

### Pull from GitHub Container Registry

Pre-built images are published to the [GitHub Container Registry](https://ghcr.io) automatically on every push to `main` and on every version tag.

```bash
# Pull the latest image
docker pull ghcr.io/YOUR_GITHUB_USERNAME/freiburgs-foreninglet:latest

# Run the container
docker run -d \
  --name freiburgs-foreninglet \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  ghcr.io/YOUR_GITHUB_USERNAME/freiburgs-foreninglet:latest
```

> Replace `YOUR_GITHUB_USERNAME` with the GitHub user or organisation that owns the repository.

Available image tags:

| Tag               | Description                                          |
|-------------------|------------------------------------------------------|
| `latest`          | Latest build from the `main` branch                 |
| `sha-<git-sha>`   | Pinned to a specific commit                         |
| `1.2.3`           | Specific release version (from a `v1.2.3` git tag)  |
| `1.2` / `1`       | Floating major/minor version aliases                |

#### Using Docker Compose (recommended for production)

Create a `compose.yaml` in your deployment directory:

```yaml
services:
  foreninglet:
    image: ghcr.io/YOUR_GITHUB_USERNAME/freiburgs-foreninglet:latest
    container_name: freiburgs-foreninglet
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file: .env          # FORENINGLET_USERNAME and FORENINGLET_PASSWORD
    environment:
      NODE_ENV: production
```

Then start it with:

```bash
docker compose up -d
```

---

## CI/CD — GitHub Actions

The workflow file at [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml) automatically builds and pushes a multi-platform (`linux/amd64` + `linux/arm64`) Docker image to GitHub Container Registry on:

- Every push to the `main` branch
- Every git tag matching `v*.*.*` (semantic version release)

No secrets need to be configured — the workflow uses the built-in `GITHUB_TOKEN`.

To trigger a versioned release, create and push a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Environment Variables

| Variable                | Required | Default      | Description                                        |
|-------------------------|----------|--------------|----------------------------------------------------|
| `FORENINGLET_USERNAME`  | **Yes**  |              | Email of the Foreninglet service account           |
| `FORENINGLET_PASSWORD`  | **Yes**  |              | Password of the Foreninglet service account        |
| `PORT`                  | No       | `3000`       | Port the HTTP server listens on                    |
| `HOST`                  | No       | `0.0.0.0`    | Host/interface the server binds to                 |
| `NODE_ENV`              | No       | `production` | Runtime environment                                |

Copy [`.env.example`](.env.example) to `.env` and fill in the two Foreninglet values. `.env` is ignored by git and Docker, so it never ends up in the repository or the image.

If the credentials are missing or wrong, the server logs `[adminSession] Foreninglet login failed: …` at startup and the page shows "Arrangementerne kunne ikke hentes lige nu".

---

## Embedding in the Google Site

1. Deploy the app somewhere reachable over **HTTPS** (Google Sites won't embed plain HTTP).
2. In the Google Sites editor, add a new page, e.g. "Arrangementer". It appears in the left-hand menu automatically.
3. On that page choose **Insert → Embed → By URL**, paste the app's address and choose to embed the whole page.
4. Stretch the embed to the full content width. Google Sites gives embeds a fixed height, so set it to fit the events, e.g. about 700px for 3–4 events.

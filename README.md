# Freiburgs Foreninglet Portal

## About the Project

**Freiburgs Foreninglet Portal** is a self-hosted web portal for the **Freiburgs** LARP club. It provides members with a clean, modern interface to interact with the club's [Foreninglet](https://www.foreninglet.dk) membership management system — without having to navigate the default Foreninglet web UI directly.

### Features

- **Member login** — authenticate securely using your Foreninglet credentials
- **Upcoming events** — browse all available club activities and sign-up links
- **Event subscription** — subscribe to activities and complete payment checkout flows
- **My events** — view a personalised list of events you are already enrolled in
- **Profile overview** — see your member information pulled live from Foreninglet

### How it works

The portal acts as a server-side proxy to the Foreninglet platform (`bifrost.foreninglet.dk`). When you log in, your session cookie is stored server-side and used to fetch and parse data from Foreninglet on your behalf. No credentials are stored persistently.

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

# 4. Start the development server
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
npm install

# 4. Start the development server
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
node .output/server/index.mjs
```

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
  --restart unless-stopped \
  freiburgs-foreninglet:latest
```

The portal is now accessible at **http://localhost:3000**.

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

The application does not require any mandatory environment variables to run. The following optional variables can be passed to the Docker container to customise behaviour:

| Variable    | Default     | Description                              |
|-------------|-------------|------------------------------------------|
| `PORT`      | `3000`      | Port the HTTP server listens on          |
| `HOST`      | `0.0.0.0`   | Host/interface the server binds to       |
| `NODE_ENV`  | `production`| Runtime environment                      |

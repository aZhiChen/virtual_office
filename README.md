# Virtual Office - Pixel Art Style

A multiplayer virtual office with pixel art aesthetics. Users can customize avatars, adopt pets, chat with colleagues, and let an LLM auto-reply when AFK.

## Tech Stack

- **Frontend**: Next.js (App Router) + Phaser 3 + Tailwind CSS
- **Backend**: Python + FastAPI + SQLite + WebSocket
- **LLM**: OpenAI-compatible API (configurable)

## Quick Start

### Backend (conda)

```bash
# Create and activate the conda environment
conda activate virtual_office

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Set up environment config
cp .env.example .env
# Edit .env with your LLM API key (LLM_API_KEY, LLM_BASE_URL)

# Start the backend server
python -m uvicorn app.main:app --reload --port 8000
```

### Backend (venv alternative)

```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in your browser.

## Features

- Pixel art avatar customization (skin, hair, clothing)
- Virtual pets (9 types: cat, dog, snake, crab, rabbit, gecko, lizard, turtle, bird)
- Real-time multiplayer office with WebSocket
- 12 individual workstations, meeting room, dining area, game room, pet area
- AFK mode with LLM-powered auto-reply based on personality settings
- Keyboard-controlled character and pet movement

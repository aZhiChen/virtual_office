# Virtual Office - Pixel Art Style
<img width="1911" height="842" alt="image" src="https://github.com/user-attachments/assets/001e7eb3-5a92-43cb-b2d6-e5607e5eef85" />
<img width="1920" height="724" alt="image" src="https://github.com/user-attachments/assets/b9effc37-d1e3-423d-8747-3430e2df353b" />


A multiplayer virtual office with pixel art aesthetics, where users can:

- Customize avatars, adopt pets, chat with colleagues, and let an LLM auto-reply when AFK  
- Create to-do lists and check off completed items  
- Post personal announcements on the bulletin board, while the system also shares office updates  
- Set their status to let others know what they're up to

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
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
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
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
For Dev:
```bash
cd frontend
npm install
npm run dev
```

For Production:
```bash
cd frontend
npm install
npm run build
npm run start
```

Open http://server_ip:3000 in your browser.

## Features

A multiplayer virtual office with pixel art aesthetics, offering:

- **Pixel Art Customization** – Customize your avatar's skin, hair, and clothing  
- **Virtual Pets** – Choose from 9 types: cat, dog, snake, crab, rabbit, gecko, lizard, turtle, and bird  
- **Real-Time Multiplayer** – Explore the office with WebSocket-powered real-time interaction  
- **Office Spaces** – Access 12 individual workstations, meeting room, dining area, game room, and pet area  
- **AFK Mode** – Let an LLM auto-reply based on your personality settings when you're away  
- **Character & Pet Movement** – Control both your character and pet with keyboard  
- **To-Do Lists** – Create tasks and check them off when completed  
- **Bulletin Board** – Post personal announcements and receive system updates about office happenings  
- **User Status** – Set your status to let others know what you're up to



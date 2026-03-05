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
- <img width="1031" height="890" alt="image" src="https://github.com/user-attachments/assets/e265154e-760c-4eea-bad1-14140a2d6b7c" />
- **Real-Time Multiplayer** – Explore the office with WebSocket-powered real-time interaction  
- **Office Spaces** – Access 12 individual workstations, meeting room, dining area, game room, and pet area  
- **AFK Mode** – Let an LLM auto-reply based on your personality settings when you're away
- <img width="332" height="381" alt="image" src="https://github.com/user-attachments/assets/d1eca089-b5ee-40c7-bbd7-c373eda80a55" />
- **Character & Pet Movement** – Control both your character and pet with keyboard  
- **To-Do Lists** – Create tasks and check them off when completed
- <img width="394" height="266" alt="image" src="https://github.com/user-attachments/assets/a5ab446e-894c-4f4b-8cae-a201c308ab08" />
- <img width="393" height="166" alt="image" src="https://github.com/user-attachments/assets/e9fd13ea-e1ae-44a0-a87f-690d9d06a5df" />
- <img width="392" height="168" alt="image" src="https://github.com/user-attachments/assets/639b0e52-bff2-48ab-a49e-a556cc08f447" />
- **Bulletin Board** – Post personal announcements and receive system updates about office happenings
- <img width="562" height="292" alt="image" src="https://github.com/user-attachments/assets/7446fb36-2f6a-402c-a51f-6646ddee74b8" />
- <img width="558" height="699" alt="image" src="https://github.com/user-attachments/assets/20828a08-3d04-4508-b90b-21b2cf3eb387" />
- **User Status** – Set your status to let others know what you're up to
- <img width="161" height="98" alt="image" src="https://github.com/user-attachments/assets/9406cc56-b742-4716-ae56-c63bd7fa6a57" />




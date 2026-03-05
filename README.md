<p align="center">
  <img width="76" height="76" alt="virtual_office_logo" src="https://github.com/user-attachments/assets/906ec4e7-eedf-47a8-b487-41bcd915bb65">
  <img width="180" height="48" alt="virtual" src="https://github.com/user-attachments/assets/007f6ac6-eb4e-4711-911c-62d2adbee144">
  <img width="176" height="52" alt="office" src="https://github.com/user-attachments/assets/c58d363d-98d0-44b1-bb29-f885c26f509f">
</p>


<hr align="center" width="100%">

<h1 align="center">Virtual Office - Pixel Art Style</h1>

<!-- 简介部分 -->
<p style="font-size: 1.2rem; margin: 2rem 0;">
  A multiplayer virtual office with pixel art aesthetics, where users can:
</p>

<ul style="list-style-type: none; padding-left: 0; text-align: center; margin-bottom: 2rem;">
  <li style="margin-bottom: 0.5rem;">✨ Customize avatars, adopt pets, chat with colleagues, and let an LLM auto-reply when AFK</li>
  <li style="margin-bottom: 0.5rem;">✅ Create to-do lists and check off completed items</li>
  <li style="margin-bottom: 0.5rem;">📋 Post personal announcements on the bulletin board, while the system also shares office updates</li>
  <li style="margin-bottom: 0.5rem;">🔵 Set their status to let others know what they're up to</li>
</ul>

<h2 >⚙️ Tech Stack</h2>

<p >
  <strong>Frontend:</strong> Next.js (App Router) + Phaser 3 + Tailwind CSS<br>
  <strong>Backend:</strong> Python + FastAPI + SQLite + WebSocket<br>
  <strong>LLM:</strong> OpenAI-compatible API (configurable)
</p>

<h2>🚀 Quick Start</h2>

<h3>Backend (conda)</h3>

<pre  style="background: #f6f8fa; padding: 1rem; border-radius: 6px; max-width: 800px; margin: 1rem auto; text-align: left;"><code># Create and activate the conda environment
conda activate virtual_office

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Set up environment config
cp .env.example .env
# Edit .env with your LLM API key (LLM_API_KEY, LLM_BASE_URL)

# Start the backend server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
</code></pre>

<h3 >Backend (venv alternative)</h3>

<pre style="background: #f6f8fa; padding: 1rem; border-radius: 6px; max-width: 800px; margin: 1rem auto; text-align: left;"><code>cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
</code></pre>

<h3 >Frontend</h3>

<p ><strong>For Dev:</strong></p>
<pre align="center" style="background: #f6f8fa; padding: 1rem; border-radius: 6px; max-width: 800px; margin: 1rem auto; text-align: left;"><code>cd frontend
npm install
npm run dev
</code></pre>

<p ><strong>For Production:</strong></p>
<pre align="center" style="background: #f6f8fa; padding: 1rem; border-radius: 6px; max-width: 800px; margin: 1rem auto; text-align: left;"><code>cd frontend
npm install
npm run build
npm run start
</code></pre>

<p >Open http://server_ip:3000 in your browser.</p>

<h2 >📋 Features</h2>

<p  style="font-size: 1.1rem; margin-bottom: 2rem;">A multiplayer virtual office with pixel art aesthetics, offering:</p>

<!-- 使用表格来组织Features，使图片和文字对齐 -->
<table align="center" style="margin: 0 auto; max-width: 1000px;">
  <tr>
    <td><strong>🎨 Pixel Art Customization</strong><br>Customize your avatar's skin, hair, and clothing<br><br><strong>🐾 Virtual Pets</strong><br>Choose from 9 types: cat, dog, snake, crab, rabbit, gecko, lizard, turtle, and bird<br>
    </td>
    <td style="text-align: center;"><br><img width="400" src="https://github.com/user-attachments/assets/e265154e-760c-4eea-bad1-14140a2d6b7c" /></td>
  </tr>
  <tr>
    <td><strong>🌐 Real-Time Multiplayer</strong><br>Explore the office with WebSocket-powered real-time interaction<br><br><strong>🏢 Office Spaces</strong><br>Access 12 individual workstations, meeting room, dining area, game room, and pet area<br><br><strong>🎮 Character & Pet Movement</strong><br>Control both your character and pet with keyboard<br></td>
    <td><br><img width="400" height="180" alt="image" src="https://github.com/user-attachments/assets/001e7eb3-5a92-43cb-b2d6-e5607e5eef85" />
  <img width="400" height="180" alt="image" src="https://github.com/user-attachments/assets/b9effc37-d1e3-423d-8747-3430e2df353b" />
</td>
  </tr>
  <tr>  
    <td><strong>😴 AFK Mode</strong><br>Let an LLM auto-reply based on your personality settings when you're away<br></td>
    <td><img width="400" src="https://github.com/user-attachments/assets/d1eca089-b5ee-40c7-bbd7-c373eda80a55" /></td>
  </tr>
  <tr>
    <td><strong>✅ To-Do Lists</strong><br>Create tasks and check them off when completed</td>
    <td>
      <img width="400" src="https://github.com/user-attachments/assets/a5ab446e-894c-4f4b-8cae-a201c308ab08" /><br>
      <img width="400" src="https://github.com/user-attachments/assets/639b0e52-bff2-48ab-a49e-a556cc08f447" />
    </td>
  </tr>
  <tr>
    <td><strong>📋 Bulletin Board</strong><br>Post personal announcements and receive system updates about office happenings</td>
    <td><img width="400" src="https://github.com/user-attachments/assets/20828a08-3d04-4508-b90b-21b2cf3eb387" /></td>
  </tr>
  <tr>
    <td><strong>🔵 User Status</strong><br>Set your status to let others know what you're up to<br></td>
    <td><img width="400" src="https://github.com/user-attachments/assets/9406cc56-b742-4716-ae56-c63bd7fa6a57" /></td>
  </tr>
</table>


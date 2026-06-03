# TAPO Meteor Network - Local Backend

This directory contains the Python application needed to connect to your real RTSP cameras, process the video for meteors/fireballs using OpenCV, and serve the React dashboard.

## Requirements
- Python 3.9+ 
- Node.js (for building the UI)

## Setup Instructions

1. **Build the Frontend Dashboard**
   Open a terminal in the root folder (one directory up from this one) and run:
   ```bash
   npm install
   npm run build
   ```
   This will generate a `dist` folder.

2. **Setup Python Environment**
   Open a terminal in this `tpn-backend` folder and run:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure your Cameras**
   Copy `config.example.json` to `config.local.json`, then enter your private RTSP URLs in `config.local.json`.
   `config.local.json` is ignored by git and is preferred automatically when present.
   Example:
   `rtsp://your_tapo_user:your_tapo_password@192.168.1.50:554/stream1`

4. **Run the Detector**
   ```bash
   python app.py
   ```
   The backend will start processing both cameras simultaneously.
   Open your browser to `http://localhost:5000` to see the dashboard. The dashboard will automatically fetch real detections as they happen!

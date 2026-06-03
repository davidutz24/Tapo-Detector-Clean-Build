# TAPO Meteor Network

Local dashboard and Python backend for monitoring TAPO RTSP cameras and saving meteor/fireball candidates.

## Run locally

1. Install frontend dependencies:
   ```bash
   npm install
   ```
2. Build the dashboard:
   ```bash
   npm run build
   ```
3. Configure cameras in `tpn-backend/config.local.json`.
   Use `tpn-backend/config.example.json` as the template. Keep real RTSP credentials only in `config.local.json`.
4. Install backend dependencies:
   ```bash
   cd tpn-backend
   pip install -r requirements.txt
   ```
5. Start the detector:
   ```bash
   python app.py
   ```

The app opens at `http://localhost:5000`.

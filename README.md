# Qubit Companion - Resolume Arena Local Controller

Qubit Companion is a local-only Next.js application for uploading media and controlling Resolume Arena from a browser. It is designed to run on the same Windows PC as Resolume, work completely offline after dependencies are installed, and be usable from touch screens or other devices on the same LAN.

## Features

- Next.js App Router, React, TypeScript, TailwindCSS
- No Express, Electron, NestJS, cloud services, or external database
- Local JSON metadata in `storage/database.json`
- Local uploads in `storage/uploads`
- Cached generated thumbnails in `storage/thumbnails`
- Drag-and-drop uploads with progress
- PNG, JPG, JPEG, GIF, MP4, MOV, and WebM support
- Search, sort, filters, favorites, pagination, and recent uploads
- Preview, rename, delete, replace, duplicate, copy path, and open upload folder
- Resolume status, composition, layers, clips, load media, trigger, stop, and clear-layer API routes
- Advanced Resolume controls for discovered transform, expand, effect, audio, transport, and custom parameters
- Effect add/remove helpers where the local Resolume REST API exposes effect endpoints
- Touch-friendly dashboard, media browser, settings, toasts, skeletons, and keyboard shortcuts

## Installation

Install Node.js LTS on the Windows machine that runs Resolume Arena.

```powershell
git clone <repo-url>
cd QubitCompanion
npm install
```

## Running locally

Development:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

Production build:

```powershell
npm run build
npm run start
```

The `dev` and `start` scripts bind to `0.0.0.0`, so another device on the same LAN can open:

```text
http://192.168.x.x:3000
```

Replace `192.168.x.x` with the Windows PC IP address. Allow Node.js through Windows Firewall for Private networks if prompted.

## Folder structure

```text
app/                  Next.js pages and route handlers
components/           Reusable UI components
hooks/                Client hooks
lib/                  Storage, path, constants, API helpers
services/             Resolume API service
types/                TypeScript domain types
utils/                Formatting and filename helpers
storage/uploads/      Local user media
storage/thumbnails/   Generated cached thumbnails
storage/database.json Local media metadata, created on first run
storage/settings.json Local settings, created on first run
scripts/              Windows startup helpers
```

## Resolume configuration

1. Open Resolume Arena.
2. Enable its HTTP/REST API in Resolume preferences.
3. Confirm the API port. The application default is `8080`.
4. In Qubit Companion, open **Settings**.
5. Set:
   - Resolume IP: `127.0.0.1`
   - Port: `8080`
6. Click **Test Connection**.

The app uses Resolume's local HTTP API at:

```text
http://127.0.0.1:8080/api/v1
```

If you control Resolume from another computer, keep Qubit Companion running on the Resolume PC and leave the Resolume IP set to `127.0.0.1`.

## API routes

- `POST /api/upload`
- `GET /api/files`
- `GET /api/files/[id]`
- `PATCH /api/files/[id]`
- `DELETE /api/files/[id]`
- `GET /api/files/[id]/thumbnail`
- `GET /api/files/[id]/raw`
- `POST /api/files/[id]/replace`
- `POST /api/files/[id]/duplicate`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/resolume/status`
- `POST /api/resolume/connect`
- `GET /api/resolume/composition`
- `GET /api/resolume/layers`
- `GET /api/resolume/clips`
- `POST /api/resolume/load`
- `GET /api/resolume/parameters`
- `PUT /api/resolume/parameters`
- `GET /api/resolume/effects`
- `POST /api/resolume/effects`
- `DELETE /api/resolume/effects`
- `POST /api/resolume/trigger`
- `POST /api/resolume/stop`
- `POST /api/resolume/clear-layer`
- `POST /api/system/open-folder`

## Windows auto startup

### Option 1: Task Scheduler

1. Build the app once:

   ```powershell
   npm install
   npm run build
   ```

2. Open **Task Scheduler**.
3. Create a task named `Qubit Companion`.
4. Trigger: **At log on** or **At startup**.
5. Action: **Start a program**.
6. Program:

   ```text
   powershell.exe
   ```

7. Arguments:

   ```text
   -ExecutionPolicy Bypass -File "C:\path\to\QubitCompanion\scripts\start-qubit-companion.ps1"
   ```

8. Start in:

   ```text
   C:\path\to\QubitCompanion
   ```

### Option 2: Startup Folder

1. Press `Win + R`.
2. Run:

   ```text
   shell:startup
   ```

3. Add a shortcut to:

   ```text
   C:\path\to\QubitCompanion\scripts\start-qubit-companion.bat
   ```

### Launch Resolume automatically

Use Task Scheduler or the Startup Folder with a shortcut to the Resolume Arena executable. Configure Resolume to open the desired composition on startup.

Recommended boot order:

1. Resolume Arena starts.
2. Qubit Companion starts.
3. Browser opens `http://localhost:3000`.

## Touch and keyboard usage

- Buttons and controls use large hit areas.
- Media grid is responsive for tablets and touch displays.
- Keyboard shortcuts in the media page:
  - `U`: jump to upload
  - `R`: refresh
  - `F`: toggle favorites

## Advanced Resolume controls

Open **Media**, choose a file, then click **Send**. The dialog now includes **Advanced Resolume Controls** below the load/trigger buttons.

Available targets:

- **Clip**: controls the selected layer/clip slot
- **Layer**: controls the selected layer
- **Composition**: controls composition-level parameters

The app reads the active Resolume composition JSON and finds editable parameters by ID. Parameters are grouped into:

- Transform / Expand
- Effects
- Audio
- Transport
- Other Parameters

For each discovered parameter, the UI shows a touch-friendly slider, toggle, or text input. Updates are sent through:

```text
PUT /api/v1/parameter/by-id/{id}
```

Effect add/remove controls call Resolume effect endpoints when they are available in your Resolume version. If a specific effect endpoint returns a 404, open Resolume's local API reference at:

```text
http://127.0.0.1:8080/api/docs/rest/
```

and confirm the exact effect name/id your installation expects.

## Troubleshooting

### Large video upload does not finish

- The browser uploader uses `POST /api/upload/raw` to stream large files directly to disk.
- The configured local limit is 8 GB per file.
- Keep the phone/tablet awake during LAN uploads.
- Use a strong private Wi-Fi network; guest networks and weak Wi-Fi can drop long uploads.
- Check that the Windows PC has enough free disk space in the `storage/uploads` drive.

### Resolume shows disconnected

- Confirm Resolume Arena is open.
- Confirm the HTTP API is enabled.
- Confirm the IP and port in Settings.
- Try `http://127.0.0.1:8080/api/v1/composition` in a browser on the Resolume PC.

### Upload fails

- Confirm the file type is PNG, JPG, JPEG, GIF, MP4, MOV, or WebM.
- Check free disk space.
- Confirm the app has write access to the project `storage` folder.

### LAN device cannot connect

- Confirm the app is running with `npm run dev` or `npm run start`.
- Confirm the scripts bind to `0.0.0.0`.
- Allow Node.js through Windows Firewall for Private networks.
- Use the Windows PC LAN address, not `localhost`, from other devices.

### Browser opens before the app is ready

Refresh the browser after a few seconds, or edit the startup script to add a short delay before `Start-Process`.

## Notes about thumbnails

Image and GIF thumbnails are served from the uploaded media with browser lazy loading. Video thumbnails use cached generated SVG thumbnails because the project intentionally avoids external native tools such as FFmpeg or Sharp.

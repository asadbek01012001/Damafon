# Damafon — Dahua Intercom Web System

## Arxitektura diagrammasi

```
┌──────────────────────────────────────────────────────────────────────┐
│                          LAN / INTERNET                              │
│                                                                      │
│  ┌────────────────┐  SIP/UDP(5060)  ┌─────────────────────────┐     │
│  │  Dahua Intercom│ ──────────────▶ │      Asterisk PBX       │     │
│  │  SIP Client    │                 │   (chan_pjsip + ARI)     │     │
│  │  RTSP :554     │                 └────────────┬────────────┘     │
│  └────────────────┘                              │ ARI WebSocket    │
│         │                                        │ ws://...:8088    │
│         │ RTSP                        ┌──────────▼──────────┐       │
│         ▼                             │   ASP.NET Core 8    │       │
│  ┌──────────────┐                     │      Backend        │       │
│  │    go2rtc    │                     │  ┌───────────────┐  │       │
│  │ RTSP→WebRTC  │                     │  │  AriService   │  │       │
│  │  port: 1984  │                     │  │  (Background) │  │       │
│  └──────┬───────┘                     │  │  SignalR Hub  │  │       │
│         │ WebRTC                      │  │  DoorService  │  │       │
│         │                             │  └───────────────┘  │       │
│  ┌──────▼──────────────────────────── │ ────────┐           │       │
│  │          React Browser             │         │           │       │
│  │  ┌─────────────────────────────┐   └─────────┘           │       │
│  │  │  IncomingCallModal           │◀── SignalR ────────────┘       │
│  │  │  VideoPlayer (WebRTC)        │                                │
│  │  │  SIP.js (Audio via Asterisk) │                                │
│  │  │  Door Open Button            │────▶ POST /api/door/open       │
│  │  └─────────────────────────────┘                                │
│  └──────────────────────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────────┘
```

## Ma'lumotlar oqimi (Data Flow)

```
1. Mehmon qo'ng'iroq tugmasini bosadi
   └─▶ Dahua → SIP INVITE → Asterisk (5060/UDP)

2. Asterisk Stasis app ishga tushadi
   └─▶ ARI WebSocket → Backend AriService.OnStasisStart()

3. Backend call session yaratadi
   └─▶ SignalR → Barcha ulangan browserlarga "IncomingCall" event

4. Browser "Qabul qilish" tugmasini ko'rsatadi
   └─▶ Ringtone + Browser notification

5. Foydalanuvchi "Qabul qilish" tugmasini bosadi
   ├─▶ SignalR → Backend.AnswerCall(channelId)
   ├─▶ ARI → Asterisk channel answer
   ├─▶ ARI → Bridge yaratiladi
   ├─▶ ARI → PJSIP/webphone ga outbound call
   └─▶ Browser SIP.js → Audio WebRTC session

6. Video stream
   └─▶ Browser → go2rtc WebRTC API → RTSP → Dahua camera

7. Eshikni ochish
   └─▶ Browser → POST /api/door/open → Backend → Dahua HTTP API

8. Qo'ng'iroqni tugatish
   └─▶ ARI → channel hangup → SignalR "CallEnded" → UI yopiladi
```

## Tezkor boshlash (Docker Compose)

```bash
# 1. Loyihani klonlash / yuklab olish
cd C:\Users\PC\Desktop\Damafon

# 2. .env faylini sozlash
cp .env.example .env
# .env faylida DAHUA_HOST, DAHUA_PASS ni o'zgartirinmiz

# 3. Hammasini ishga tushirish
docker compose up --build -d

# 4. Loglarni ko'rish
docker compose logs -f
```

Keyin brauzerda: http://localhost:3000

## Komponentlar portlari

| Xizmat      | Port       | Maqsad                          |
|-------------|------------|---------------------------------|
| React       | 3000       | Web interfeys                   |
| Backend     | 5000       | REST API + SignalR Hub          |
| Asterisk    | 5060       | SIP (UDP/TCP)                   |
| Asterisk    | 8088       | ARI WebSocket + SIP-WS          |
| go2rtc      | 1984       | WebRTC + API                    |
| go2rtc      | 8554       | RTSP relay                      |
| go2rtc      | 8555       | WebRTC ICE                      |

## Dahua SIP sozlamalari

Dahua intercom admin panelida:

```
Network > SIP
  SIP Server: <Asterisk server IP>
  SIP Port: 5060
  Username: dahua
  Password: dahua_sip_2024!
  Register: Enable
```

## go2rtc RTSP manzili

`go2rtc/go2rtc.yaml` faylida Dahua IP va parolni o'zgartiring:
```yaml
streams:
  dahua_main:
    - rtsp://admin:YOUR_PASSWORD@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0
```

## Xavfsizlik eslatmalari

- `.env` faylini **hech qachon** git ga push qilmang
- Production da HTTPS/WSS ishlatish shart
- Asterisk ARI paroli kuchli bo'lishi kerak
- Door API ni JWT authentication bilan himoya qiling
- go2rtc ni faqat ichki tarmoqda ishlatish tavsiya etiladi

## Fayl tuzilishi

```
Damafon/
├── docker-compose.yml
├── .env.example
├── asterisk/
│   ├── Dockerfile
│   ├── entrypoint.sh       ← TLS cert generatsiya
│   ├── pjsip.conf          ← SIP endpoints (Dahua + WebPhone)
│   ├── extensions.conf     ← Dialplan
│   ├── ari.conf            ← ARI user
│   ├── http.conf           ← HTTP server
│   ├── rtp.conf            ← RTP port range
│   └── modules.conf        ← Kerakli modullar
├── go2rtc/
│   └── go2rtc.yaml         ← RTSP streams config
├── backend/
│   ├── Dockerfile
│   └── Damafon.API/
│       ├── Program.cs
│       ├── appsettings.json
│       ├── Controllers/
│       │   ├── DoorController.cs    ← POST /api/door/open
│       │   └── CallController.cs   ← GET/DELETE /api/call
│       ├── Hubs/
│       │   └── IntercomHub.cs      ← SignalR real-time
│       ├── Models/
│       │   └── CallSession.cs
│       └── Services/
│           ├── AriService.cs       ← Asterisk ARI WebSocket listener
│           ├── AriRestClient.cs    ← Asterisk ARI REST calls
│           ├── CallSessionService.cs
│           └── DoorService.cs      ← Dahua HTTP API
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── IncomingCallModal.jsx  ← Qo'ng'iroq popup
        │   ├── VideoPlayer.jsx       ← WebRTC video
        │   └── StatusBar.jsx
        ├── hooks/
        │   ├── useSignalR.js         ← SignalR ulanish
        │   ├── useWebRTC.js          ← go2rtc WebRTC video
        │   └── useSipPhone.js        ← SIP.js audio
        └── services/
            └── apiService.js
```

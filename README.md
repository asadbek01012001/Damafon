# Damafon — Dahua VTO Intercom Web System

## Arxitektura diagrammasi

```
┌──────────────────────────────────────────────────────────────────────┐
│                          LAN / INTERNET                              │
│                                                                      │
│  ┌────────────────┐  SIP REGISTER/INVITE   ┌──────────────────────┐ │
│  │  Dahua VTO     │  UDP 5060 ──────────▶  │   Asterisk PBX       │ │
│  │  (Room: 8001)  │                        │  (chan_pjsip + ARI)  │ │
│  │  RTSP :554     │                        └─────────┬────────────┘ │
│  └────────────────┘                                  │ ARI WS       │
│         │ RTSP                              ┌─────────▼────────────┐ │
│         ▼                                  │  ASP.NET Core 8      │ │
│  ┌──────────────┐                          │  Backend :5050       │ │
│  │   go2rtc     │                          │  SignalR /hubs/      │ │
│  │ RTSP→WebRTC  │◀── WebRTC video ────────▶│  AriService          │ │
│  │  :1984/:8555 │                          │  DoorService         │ │
│  └──────┬───────┘                          └──────────────────────┘ │
│         │                                            │ SignalR       │
│  ┌──────▼─────────────────────────────────────────── │ ───────────┐ │
│  │                React Browser :4004                 │           │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │  IncomingCallModal                                        │  │ │
│  │  │    SIP.js (WebRTC audio, ws://server:8088/ws)            │  │ │
│  │  │    VideoPlayer (go2rtc WebRTC video, :1984)              │  │ │
│  │  │    "Eshikni och" → POST /api/door/open → Dahua HTTP API  │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## Qo'ng'iroq oqimi (Call Flow)

```
Dahua tugma ──▶ SIP INVITE ──▶ Asterisk
                                   │
                         ARI StasisStart event
                                   │
                         Backend AriService
                                   │
                         SignalR "IncomingCall"
                                   │
                         Brauzer modal + ringtone
                                   │
                    Foydalanuvchi "Qabul qilish"
                                   │
                    SignalR AnswerCall(channelId)
                                   │
                         ARI: Channel answer
                         ARI: Bridge create
                         ARI: Dahua → Bridge
                         ARI: Originate → PJSIP/webphone
                                   │
                    Asterisk SIP INVITE → WebSocket
                                   │
                         SIP.js onInvite
                         DTLS/ICE handshake
                         SRTP audio established
                                   │
            ┌──────────────────────┴──────────────────┐
            │  Audio: Dahua ←──── Bridge ────▶ Browser │
            │  Video: RTSP ──── go2rtc ───▶ WebRTC     │
            └─────────────────────────────────────────┘
```

---

## 1. Tezkor boshlash

```bash
# 1. .env faylini sozlang
# HOST_IP = serverni LAN IP si (muhim!)
# DAHUA_HOST = Dahua qurilma IP si
# DAHUA_SIP_PASSWORD = Dahua admin panelida qo'yadigan parol
nano .env

# 2. Hammasini ishga tushiring
docker compose up --build -d

# 3. Loglarni kuzating
docker compose logs -f asterisk
docker compose logs -f backend
```

Brauzerda: `http://<HOST_IP>:4004`

---

## 2. .env sozlash (muhim!)

```bash
# Server
HOST_IP=172.24.201.4        # Serverni haqiqiy LAN IP si — Dahua ham shunga ulanadi

# Dahua qurilma
DAHUA_HOST=10.143.122.138   # Dahua IP si
DAHUA_PORT=80
DAHUA_USER=admin
DAHUA_PASS=Abc112233
DAHUA_CHANNEL=1

# Dahua SIP (pjsip.conf bilan mos bo'lishi kerak)
DAHUA_ROOM_NO=8001           # Dahua Local Number (Room No)
DAHUA_SIP_PASSWORD=dahua_sip_2024!  # Dahua admin panelida o'rnatiladi

JWT_SECRET=change_this_in_production_minimum_32_chars!
```

---

## 3. Dahua VTO SIP sozlamalari

**Dahua admin panelida** (http://DAHUA_IP):

```
Network → SIP Server
  ├─ SIP Server IP  : 172.24.201.4    (HOST_IP)
  ├─ SIP Port       : 5060
  ├─ Password       : dahua_sip_2024! (DAHUA_SIP_PASSWORD bilan mos!)
  └─ Register       : Enable

Local Config → Local No (Room Number)
  └─ Room No: 8001  (DAHUA_ROOM_NO bilan mos!)
```

**MUHIM:** Dahua VTO da SIP Username avtomatik `Room Number` ga teng bo'ladi
(odatda 8001, 8002 kabi). Buni o'zgartirib bo'lmaydi. Shuning uchun
`pjsip.conf` dagi `auth username` ham `8001` bo'lishi kerak — bu `DAHUA_ROOM_NO`
orqali avtomatik o'rnatiladi.

**Qo'ng'iroq raqami (Call Number):**
```
Talk → Call No: 0   (yoki istalgan raqam — dialplan hammani qabul qiladi)
```

---

## 4. Portlar

| Xizmat   | Port         | Protokol | Maqsad                    |
|----------|--------------|----------|---------------------------|
| Frontend | 4004         | HTTP     | React web app             |
| Backend  | 5050         | HTTP     | REST API + SignalR        |
| Asterisk | 5060         | UDP/TCP  | SIP (Dahua REGISTER/INVITE) |
| Asterisk | 8088         | WS       | SIP WebSocket (browser)   |
| Asterisk | 10000-10200  | UDP      | RTP media                 |
| go2rtc   | 1984         | HTTP     | WebRTC API + RTSP         |
| go2rtc   | 8555         | UDP/TCP  | WebRTC ICE                |

---

## 5. REGISTER ishlayotganini tekshirish

```bash
# Asterisk CLI ga kirish
docker exec -it damafon-asterisk asterisk -r

# Barcha SIP endpoint holatini ko'rish
asterisk*CLI> pjsip show endpoints

# Dahua endpoint holatini ko'rish (8001 — Room No)
asterisk*CLI> pjsip show endpoint dahua

# AOR (Address of Record) — Dahua ro'yxatdan o'tganmi?
asterisk*CLI> pjsip show aors

# REGISTER paketlarini kuzatish
asterisk*CLI> pjsip set logger on
asterisk*CLI> core set verbose 5

# SIP debug to'liq ko'rish
asterisk*CLI> pjsip set logger verbose on
```

**Kutilgan natija:** Dahua `Registered` holatida bo'lishi kerak.

---

## 6. SIP Call Flow debug

```bash
# Qo'ng'iroq paytida barcha SIP xabarlarni ko'rish
asterisk*CLI> pjsip set logger on
asterisk*CLI> core set verbose 9

# RTP oqimini tekshirish (audio paketlari)
asterisk*CLI> rtp set debug on

# Faol kanallarni ko'rish
asterisk*CLI> core show channels

# Bridge holatini ko'rish
asterisk*CLI> bridge show all

# ARI API orqali tekshirish (brauzerdan)
# http://HOST_IP:8088/ari/channels   (Basic auth: ari_user:ari_secret_2024!)
```

---

## 7. Packet troubleshooting (tcpdump)

```bash
# Docker konteyner ichida SIP paketlarini ushlash
docker exec -it damafon-asterisk bash
apt-get install -y tcpdump
tcpdump -i any -n -v port 5060 -w /tmp/sip.pcap

# Kompyuterga nusxalash va Wireshark bilan ko'rish
docker cp damafon-asterisk:/tmp/sip.pcap ./sip.pcap

# Wireshark filtr: sip || rtp
```

---

## 8. Eng ko'p uchraydigan Dahua SIP muammolari

### 1. REGISTER ishlaydi lekin qo'ng'iroq kelmaydi
```
Sabab: Dahua "Call Number" to'g'ri sozlanmagan yoki firewall
Tekshirish:
  asterisk*CLI> pjsip set logger on
  Dahua tugmasini bosing va INVITE xabarini kuting
Fix: Dahua admin > Talk > Call No = 0 (yoki boshqa raqam)
```

### 2. 401 Unauthorized — REGISTER rad etildi
```
Sabab: pjsip.conf auth username Room Number bilan mos emas
Tekshirish: docker logs damafon-asterisk | grep "401\|auth"
Fix: .env da DAHUA_ROOM_NO = Dahua Room Number
```

### 3. Audio bir tomonda eshitiladi (one-way audio)
```
Sabab: RTP NAT muammosi — Dahua private IP ni SDP ga yozadi
Fix (allaqachon qo'llangan):
  force_rport=yes
  rtp_symmetric=yes
  direct_media=no
```

### 4. Brauzerda audio yo'q (SIP.js ulangan lekin ovoz yo'q)
```
Sabab: ICE/DTLS muvaffaqiyatsiz yoki codec mos emas
Tekshirish: Brauzer DevTools > Console > SIP.js log
           Brauzer DevTools > Network > WS frames
Fix:
  - pjsip.conf da ice_support=yes (allaqachon bor)
  - HOST_IP to'g'ri ekanligini tekshiring
  - DTLS sertifikat mavjudligini tekshiring:
    docker exec damafon-asterisk ls /etc/asterisk/keys/
```

### 5. Video ko'rinmaydi (go2rtc)
```
Tekshirish: http://HOST_IP:1984 (go2rtc UI)
           Stream holati: green = ishlaydi
Fix:
  - RTSP URL to'g'riligini tekshiring: go2rtc.yaml
  - Dahua RTSP xizmatini yoqing: Network > Video Service > Enable
  - go2rtc.yaml da candidates IP to'g'riligini tekshiring
```

### 6. WebRTC ICE failed
```
Sabab: go2rtc yoki Asterisk noto'g'ri ICE kandidat reklamalaydi
Tekshirish: Brauzer DevTools > Network > STUN/ICE requests
Fix:
  - .env da HOST_IP = serverni haqiqiy LAN IP si
  - go2rtc.yaml candidates = HOST_IP:8555
  - docker-compose.yml da portlar ochiq: 8555, 10000-10200
```

---

## 9. NAT muammolari

Loyiha allaqachon NAT muammolarini hal qiladi:

```ini
; pjsip.conf da (Dahua endpoint)
force_rport=yes       ; SIP response ni to'g'ri portga yuboradi
rtp_symmetric=yes     ; RTP paketlari kelgan portga qaytariladi
rewrite_contact=yes   ; Contact header ni NAT orqasidagi IP bilan almashtiradi
direct_media=no       ; Barcha media Asterisk orqali o'tadi (bridge)

; Transport da
external_media_address=HOST_IP    ; Asterisk o'z tashqi IP sini biladi
external_signaling_address=HOST_IP
local_net=10.0.0.0/8             ; Bu IP lar uchun STUN ishlatilmaydi
```

---

## 10. Codec muammolari

```
Dahua VTO qo'llab-quvvatlaydigan codeclar: G.711 ulaw, G.711 alaw, G.726, G.729
Brauzer qo'llab-quvvatlaydigan codeclar: Opus, G.711 ulaw/alaw
Asterisk transcode qiladi: G.711 <-> Opus

pjsip.conf da:
  [dahua]   allow=ulaw,alaw,gsm       ← G.711
  [webphone] allow=opus,ulaw,alaw     ← Opus + G.711

Asterisk mixing bridge G.711 va Opus o'rtasida avtomatik transcode qiladi.
codec_opus moduli asterisk-modules paketida mavjud (Ubuntu 22.04).
```

---

## 11. ICE/STUN/TURN konfiguratsiya

```yaml
# go2rtc.yaml
webrtc:
  candidates:
    - ${HOST_IP}:8555   # Brauzer shu IP:port ga ulanadi

# rtp.conf  
stunaddr=stun.l.google.com:19302   # Asterisk STUN orqali IP aniqlaydi

# SIP.js (useSipPhone.js)
iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
```

**TURN server:** Agar server va brauzer turli tarmoqlarda bo'lsa (masalan internet orqali),
TURN server kerak bo'ladi. LAN ichida STUN yetarli.

---

## 12. Production best practices

### 12.1 HTTPS/WSS
```nginx
# Nginx reverse proxy bilan
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/damafon.crt;
    ssl_certificate_key /etc/ssl/private/damafon.key;
    
    # Frontend
    location / { proxy_pass http://localhost:4004; }
    
    # Backend SignalR
    location /hubs/ {
        proxy_pass http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Asterisk SIP-WS (wss://)
    location /ws {
        proxy_pass http://localhost:8088;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 12.2 JWT autentifikatsiya
```
JWT_SECRET eng kamida 32 belgili kuchli parol bo'lsin.
Door API ni [Authorize] attribute bilan himoya qiling.
```

### 12.3 go2rtc xavfsizligi
```yaml
# go2rtc.yaml
api:
  listen: "127.0.0.1:1984"   # Faqat lokal — tashqaridan kirish yo'q
```

### 12.4 Asterisk ARI
```
ARI ni tashqi portda ochiq qoldirmang.
Backend faqat Docker ichki tarmoqdan Asterisk ga ulanadi.
```

---

## 13. Fayl tuzilishi

```
Damafon/
├── .env                    ← HOST_IP, DAHUA_*, JWT_SECRET
├── docker-compose.yml      ← Barcha servislar
├── asterisk/
│   ├── pjsip.conf          ← Dahua(8001) + webphone endpoints; ENV(HOST_IP)
│   ├── extensions.conf     ← Dialplan: dahua_inbound → Stasis
│   ├── rtp.conf            ← RTP ports + STUN
│   ├── ari.conf            ← ARI user
│   ├── http.conf           ← HTTP :8088 (ARI + SIP-WS)
│   ├── modules.conf        ← pjsip preload
│   └── entrypoint.sh       ← TLS cert generatsiya
├── go2rtc/
│   └── go2rtc.yaml         ← RTSP streams + WebRTC candidates
├── backend/
│   └── Damafon.API/
│       ├── Services/AriService.cs      ← Asterisk ARI WebSocket
│       ├── Services/AriRestClient.cs   ← ARI REST calls
│       ├── Hubs/IntercomHub.cs         ← SignalR: Answer/Reject/Hangup
│       ├── Services/DoorService.cs     ← Dahua/Hikvision HTTP door unlock
│       └── Services/DeviceService.cs  ← Qurilma boshqaruvi
└── frontend/
    └── src/
        ├── hooks/useSipPhone.js  ← SIP.js WebRTC audio
        ├── hooks/useWebRTC.js    ← go2rtc WebRTC video
        └── hooks/useSignalR.js   ← SignalR real-time
```

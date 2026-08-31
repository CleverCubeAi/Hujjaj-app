# Hujjaj Agent — mobile app (v1)

Field app for travel-agency **agents** (role `agent`; manager and agency admin can sign in). It talks to the existing Express API. Super Admin is blocked and must use the web console.

## Requirements

- Node 20+
- Backend running (`http://localhost:3001` by default)
- **Expo Go from the App Store / Play Store (SDK 54).** Store Expo Go does not run SDK 55+. This app is pinned to SDK 54 so a store install works. Restart Metro after `npm start` and scan the QR code again.

## Run

```bash
cd mobile-hujjaj
cp .env.example .env
# Physical device: set EXPO_PUBLIC_API_URL to http://<your-lan-ip>:3001/api
npm start
```

Then press `i` (simulator), `a` (emulator), or scan the QR code with Expo Go.

| Environment | `EXPO_PUBLIC_API_URL` |
|---|---|
| iOS simulator | `http://localhost:3001/api` |
| Android emulator | `http://10.0.2.2:3001/api` |
| Physical phone | `http://192.168.x.x:3001/api` (same Wi-Fi as the API) |

Android cleartext HTTP is enabled for local development.

## Demo login

From the Al-Baraka seed (`SEED_DEMO=true`):

| Role | Email | Password |
|---|---|---|
| Agent (Rabat) | `youssef@albaraka.ma` | `Demo123!` |
| Agent (Marrakech) | `khadija@albaraka.ma` | `Demo123!` |
| Super admin (blocked here) | `admin@hujjaj.app` | `Admin123!` |

## Auth vs web

| | Web SPA | This app |
|---|---|---|
| Tokens | httpOnly cookies `hujjaj_access` / `hujjaj_refresh` | JSON `access_token` + `refresh_token` |
| Storage | Browser cookie jar | `expo-secure-store` |
| Login body | `{ email, password }` | `{ email, password, client: "mobile" }` |
| Refresh | `POST /auth/refresh` with cookie | `POST /auth/refresh` with `{ refresh_token }` |
| API calls | `credentials: 'include'` | `Authorization: Bearer <access>` |

The cookie path is unchanged. Mobile tokens are only returned when `client: "mobile"` (login) or when refresh is sent in the JSON body. Web login still returns `{ user }` only.

## Screens

Bottom tabs: **Home · Book · Trips · Reports · More**

- Home: agent KPIs from `GET /dashboard` (sales / collected / outstanding / counts)
- Book: quick booking wizard + local draft resume
- Trips: programs, flights, hotels (read-only)
- Reports: agent financial status (`GET /reports` + `/financial-status`)
- More: bookings, clients, pilgrims, messages, settings

## Manual test checklist

1. Login as `youssef@albaraka.ma` — Arabic RTL by default; toggle French on the login screen.
2. Home numbers match the web dashboard for that agent.
3. Quick-book 3 pilgrims (Omra, one flight, one hotel), take a payment, see `booking_number`.
4. Reports unpaid / totals match the web reports for the same agent.
5. Open a booking created by `khadija@albaraka.ma` — expect 403 / error.
6. Super admin login shows “use the web console”.
7. Airplane mode: wizard form still saves locally; locks/confirm refuse until online.

## Out of scope (v1)

Creating seasons/flights/hotels, bed/seat maps, Super Admin, LLM, agency billing, biometric unlock, handover create.

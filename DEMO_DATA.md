# Ashamel - Complete Demo Data Scenario

## Overview

This document provides a comprehensive demo data scenario for the Ashamel Hajj & Omra SaaS platform. It covers all major entities, relationships, and business calculations to demonstrate the full functionality of the system.

---

## 1. Agency Setup

### Agency: Al-Baraka Travel

| Field | Value |
|-------|-------|
| ID | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| Name | Al-Baraka Travel Agency |
| Country | Morocco |
| Status | active |
| Subscription Plan | premium |
| Logo URL | `/logos/albaraka.png` |

### Branches

| ID | Name | City | Is Headquarters |
|----|------|------|-----------------|
| `branch-001` | Casablanca HQ | Casablanca | true |
| `branch-002` | Rabat Office | Rabat | false |
| `branch-003` | Marrakech Office | Marrakech | false |

### Users

| ID | Full Name | Role | Branch | Email |
|----|-----------|------|--------|-------|
| `user-001` | Ahmed Bennani | agency_admin | Casablanca HQ | ahmed@albaraka.ma |
| `user-002` | Fatima Alaoui | manager | Casablanca HQ | fatima@albaraka.ma |
| `user-003` | Youssef Tazi | agent | Rabat Office | youssef@albaraka.ma |
| `user-004` | Khadija Idrissi | agent | Marrakech Office | khadija@albaraka.ma |

---

## 2. Season Configuration

### Active Season: Omra Ramadan 2026

| Field | Value |
|-------|-------|
| ID | `season-ramadan-2026` |
| Name | عمرة رمضان 2026 (Omra Ramadan 2026) |
| Type | ramadan |
| Start Date | 2026-03-01 |
| End Date | 2026-04-15 |
| Status | active |

### Additional Seasons

| ID | Name | Type | Period | Status |
|----|------|------|--------|--------|
| `season-hajj-2026` | حج 2026 | hajj | 2026-06-01 to 2026-06-30 | upcoming |
| `season-omra-summer-2026` | عمرة صيفية 2026 | omra | 2026-07-01 to 2026-09-30 | upcoming |

---

## 3. Flights Configuration

### Flight Inventory for Ramadan Season

| ID | Code | Route | Dates | Carrier | Direct |
|----|------|-------|-------|---------|--------|
| `flight-001` | RAM-350 | CMN → JED | 2026-03-05 → 2026-03-20 | Royal Air Maroc | Yes |
| `flight-002` | RAM-352 | CMN → JED | 2026-03-10 → 2026-03-25 | Royal Air Maroc | Yes |
| `flight-003` | SV-210 | CMN → MED | 2026-03-08 → 2026-03-23 | Saudia | No (1 transit) |
| `flight-004` | RAM-354 | CMN → JED | 2026-03-15 → 2026-03-30 | Royal Air Maroc | Yes |

### Flight Transit (for SV-210)

| Flight | Stop Order | City | Airport | Arrival | Departure | Layover |
|--------|------------|------|---------|---------|-----------|---------|
| SV-210 | 1 | Riyadh | RUH | 14:30 | 16:00 | 90 min |

### Flight Seat Inventory

| ID | Flight | Class | Purchased | Purchase Price | Sell Price | Sold | Available |
|----|--------|-------|-----------|----------------|------------|------|-----------|
| `fsi-001` | RAM-350 | economy | 50 | 7,500 MAD | 9,500 MAD | 12 | 38 |
| `fsi-002` | RAM-350 | business | 10 | 15,000 MAD | 20,000 MAD | 2 | 8 |
| `fsi-003` | RAM-352 | economy | 45 | 7,500 MAD | 9,500 MAD | 0 | 45 |
| `fsi-004` | SV-210 | economy | 60 | 7,000 MAD | 8,500 MAD | 8 | 52 |
| `fsi-005` | RAM-354 | economy | 50 | 7,500 MAD | 9,500 MAD | 0 | 50 |

**Flight Inventory Calculations:**
- Total seats purchased: 215
- Total purchase cost: (50×7,500) + (10×15,000) + (45×7,500) + (60×7,000) + (50×7,500) = 1,507,500 MAD
- Potential revenue (if all sold): (50×9,500) + (10×20,000) + (45×9,500) + (60×8,500) + (50×9,500) = 1,970,000 MAD
- **Potential margin: 462,500 MAD**

---

## 4. Accommodations Configuration

### Hotels in Makkah

| ID | Name | Name (AR) | City | Stars |
|----|------|-----------|------|-------|
| `hotel-001` | Dar Al-Tawhid InterContinental | دار التوحيد انتركونتيننتال | Makkah | 5★ |
| `hotel-002` | Swissotel Al Maqam | سويس اوتيل المقام | Makkah | 5★ |
| `hotel-003` | Al-Safwa Towers | أبراج الصفوة | Makkah | 4★ |

### Hotels in Madinah

| ID | Name | Name (AR) | City | Stars |
|----|------|-----------|------|-------|
| `hotel-004` | Dar Al-Taqwa | دار التقوى | Madinah | 5★ |
| `hotel-005` | Anwar Al-Madinah Mövenpick | أنوار المدينة موفنبيك | Madinah | 5★ |
| `hotel-006` | Al-Noor Hotel | فندق النور | Madinah | 3★ |

### Room Types per Hotel

#### Dar Al-Tawhid (Makkah - 5★)

| ID | Type | Beds/Room | Total Rooms | Total Beds | Price/Bed/Night |
|----|------|-----------|-------------|------------|-----------------|
| `rt-001` | double | 2 | 15 | 30 | 800 MAD |
| `rt-002` | triple | 3 | 10 | 30 | 700 MAD |
| `rt-003` | quad | 4 | 8 | 32 | 600 MAD |
| `rt-004` | quint | 5 | 5 | 25 | 500 MAD |

#### Al-Safwa Towers (Makkah - 4★)

| ID | Type | Beds/Room | Total Rooms | Total Beds | Price/Bed/Night |
|----|------|-----------|-------------|------------|-----------------|
| `rt-005` | double | 2 | 20 | 40 | 500 MAD |
| `rt-006` | triple | 3 | 15 | 45 | 450 MAD |
| `rt-007` | quad | 4 | 10 | 40 | 400 MAD |

#### Dar Al-Taqwa (Madinah - 5★)

| ID | Type | Beds/Room | Total Rooms | Total Beds | Price/Bed/Night |
|----|------|-----------|-------------|------------|-----------------|
| `rt-008` | double | 2 | 12 | 24 | 600 MAD |
| `rt-009` | triple | 3 | 10 | 30 | 550 MAD |
| `rt-010` | quad | 4 | 8 | 32 | 480 MAD |

#### Al-Noor Hotel (Madinah - 3★)

| ID | Type | Beds/Room | Total Rooms | Total Beds | Price/Bed/Night |
|----|------|-----------|-------------|------------|-----------------|
| `rt-011` | double | 2 | 25 | 50 | 300 MAD |
| `rt-012` | triple | 3 | 20 | 60 | 270 MAD |
| `rt-013` | quad | 4 | 15 | 60 | 240 MAD |

---

## 5. Hotel Bed Inventory

### Makkah - Dar Al-Tawhid (March 5-20, 2026 = 15 nights)

| ID | Room Type | Beds Purchased | Purchase/Bed | Sell/Bed | Check-in | Check-out | Nights |
|----|-----------|----------------|--------------|----------|----------|-----------|--------|
| `hbi-001` | double | 20 | 600 MAD | 800 MAD | 2026-03-05 | 2026-03-20 | 15 |
| `hbi-002` | triple | 24 | 520 MAD | 700 MAD | 2026-03-05 | 2026-03-20 | 15 |
| `hbi-003` | quad | 24 | 450 MAD | 600 MAD | 2026-03-05 | 2026-03-20 | 15 |

**Calculations for Dar Al-Tawhid:**

| Inventory | Total Purchase Cost | Potential Revenue | Margin/Bed | Total Potential Margin |
|-----------|--------------------|--------------------|------------|------------------------|
| hbi-001 | 20 × 600 × 15 = 180,000 MAD | 20 × 800 × 15 = 240,000 MAD | 200 MAD/night | 60,000 MAD |
| hbi-002 | 24 × 520 × 15 = 187,200 MAD | 24 × 700 × 15 = 252,000 MAD | 180 MAD/night | 64,800 MAD |
| hbi-003 | 24 × 450 × 15 = 162,000 MAD | 24 × 600 × 15 = 216,000 MAD | 150 MAD/night | 54,000 MAD |
| **Total** | **529,200 MAD** | **708,000 MAD** | - | **178,800 MAD** |

### Madinah - Dar Al-Taqwa (March 5-12, 2026 = 7 nights)

| ID | Room Type | Beds Purchased | Purchase/Bed | Sell/Bed | Check-in | Check-out | Nights |
|----|-----------|----------------|--------------|----------|----------|-----------|--------|
| `hbi-004` | double | 16 | 450 MAD | 600 MAD | 2026-03-05 | 2026-03-12 | 7 |
| `hbi-005` | triple | 21 | 400 MAD | 550 MAD | 2026-03-05 | 2026-03-12 | 7 |
| `hbi-006` | quad | 20 | 350 MAD | 480 MAD | 2026-03-05 | 2026-03-12 | 7 |

**Calculations for Dar Al-Taqwa:**

| Inventory | Total Purchase Cost | Potential Revenue | Margin/Bed | Total Potential Margin |
|-----------|--------------------|--------------------|------------|------------------------|
| hbi-004 | 16 × 450 × 7 = 50,400 MAD | 16 × 600 × 7 = 67,200 MAD | 150 MAD/night | 16,800 MAD |
| hbi-005 | 21 × 400 × 7 = 58,800 MAD | 21 × 550 × 7 = 80,850 MAD | 150 MAD/night | 22,050 MAD |
| hbi-006 | 20 × 350 × 7 = 49,000 MAD | 20 × 480 × 7 = 67,200 MAD | 130 MAD/night | 18,200 MAD |
| **Total** | **158,200 MAD** | **215,250 MAD** | - | **57,050 MAD** |

---

## 6. Extra Services Catalog

| ID | Name | Name (AR) | Category | Price | Active |
|----|------|-----------|----------|-------|--------|
| `svc-001` | Airport Transfer (Round-trip) | نقل المطار (ذهاب وإياب) | transport | 500 MAD | Yes |
| `svc-002` | Private Guide (Per Day) | مرشد خاص (يومي) | guide | 800 MAD | Yes |
| `svc-003` | Ziyarat Makkah Tour | جولة زيارات مكة | tours | 400 MAD | Yes |
| `svc-004` | Ziyarat Madinah Tour | جولة زيارات المدينة | tours | 350 MAD | Yes |
| `svc-005` | Travel Insurance | تأمين السفر | insurance | 300 MAD | Yes |
| `svc-006` | Meal Package (15 days) | وجبات (15 يوم) | meals | 1,500 MAD | Yes |
| `svc-007` | Zamzam Water (5L) | ماء زمزم (5 لتر) | other | 100 MAD | Yes |
| `svc-008` | SIM Card with Data | شريحة اتصال مع انترنت | other | 150 MAD | Yes |
| `svc-009` | Wheelchair Assistance | خدمة الكرسي المتحرك | other | 1,000 MAD | Yes |
| `svc-010` | VIP Lounge Access | صالة كبار الشخصيات | other | 600 MAD | Yes |

---

## 7. Discount Settings

| ID | Name | Type | Value | Max Amount | Min Booking | Default | Active |
|----|------|------|-------|------------|-------------|---------|--------|
| `disc-001` | Early Bird (30+ days) | percent | 5% | 2,000 MAD | 20,000 MAD | Yes | Yes |
| `disc-002` | Family Discount (4+) | percent | 10% | 5,000 MAD | 50,000 MAD | No | Yes |
| `disc-003` | Returning Customer | percent | 3% | 1,500 MAD | 15,000 MAD | No | Yes |
| `disc-004` | Senior Citizen (65+) | fixed | 500 MAD | - | 10,000 MAD | No | Yes |
| `disc-005` | Student Discount | percent | 7% | 2,500 MAD | 15,000 MAD | No | Yes |
| `disc-006` | Group Booking (10+) | percent | 15% | 10,000 MAD | 100,000 MAD | No | Yes |

### User Discount Permissions

| User | Discount | Usage Limit | Usage Count | Reset Period |
|------|----------|-------------|-------------|--------------|
| Ahmed (Admin) | All discounts | Unlimited | - | Never |
| Fatima (Manager) | Early Bird, Family, Returning | 10/month | 3 | Monthly |
| Youssef (Agent) | Early Bird, Returning | 5/month | 1 | Monthly |
| Khadija (Agent) | Early Bird | 3/month | 0 | Monthly |

---

## 8. Clients Database

| ID | Full Name | Full Name (AR) | Phone | Email | Branch |
|----|-----------|----------------|-------|-------|--------|
| `client-001` | Mohammed El Fassi | محمد الفاسي | +212 661-123456 | m.elfassi@email.com | Casablanca HQ |
| `client-002` | Aicha Benjelloun | عائشة بنجلون | +212 662-234567 | aicha.b@email.com | Casablanca HQ |
| `client-003` | Omar Chraibi | عمر الشرايبي | +212 663-345678 | omar.c@email.com | Rabat Office |
| `client-004` | Fatima Zahra Alami | فاطمة الزهراء العلمي | +212 664-456789 | fz.alami@email.com | Marrakech Office |
| `client-005` | Rachid Benkirane | رشيد بنكيران | +212 665-567890 | rachid.b@email.com | Casablanca HQ |

---

## 9. Demo Bookings

### Booking 1: El Fassi Family (4 Pilgrims)

**Booking Header:**

| Field | Value |
|-------|-------|
| ID | `booking-001` |
| Booking Number | BK-2026-0001 |
| Client | Mohammed El Fassi |
| Season | Omra Ramadan 2026 |
| Status | confirmed |
| Created By | Fatima Alaoui |
| Branch | Casablanca HQ |
| Same Selection | true |

**Pilgrims:**

| ID | Name | Name (AR) | Gender | DOB | Passport | Relationship | Is Mahram |
|----|------|-----------|--------|-----|----------|--------------|-----------|
| `pilgrim-001` | Mohammed El Fassi | محمد الفاسي | male | 1970-05-15 | MA1234567 | Head | Yes |
| `pilgrim-002` | Khadija El Fassi | خديجة الفاسي | female | 1975-08-20 | MA1234568 | Spouse | No |
| `pilgrim-003` | Youssef El Fassi | يوسف الفاسي | male | 1998-03-10 | MA1234569 | Child | Yes |
| `pilgrim-004` | Fatima El Fassi | فاطمة الفاسي | female | 2000-11-25 | MA1234570 | Child | No |

**Allocations:**

| Resource | Inventory | Quantity | Price/Unit | Total |
|----------|-----------|----------|------------|-------|
| Flight (RAM-350 Economy) | fsi-001 | 4 seats | 9,500 MAD | 38,000 MAD |
| Makkah (Dar Al-Tawhid Triple, 15 nights) | hbi-002 | 4 beds | 700 × 15 = 10,500 MAD | 42,000 MAD |
| Madinah (Dar Al-Taqwa Triple, 7 nights) | hbi-005 | 4 beds | 550 × 7 = 3,850 MAD | 15,400 MAD |

**Invoice Items:**

| Item Type | Description | Qty | Unit Price | Total |
|-----------|-------------|-----|------------|-------|
| package | Flight RAM-350 Economy | 4 | 9,500 MAD | 38,000 MAD |
| package | Makkah - Dar Al-Tawhid (Triple, 15N) | 4 | 10,500 MAD | 42,000 MAD |
| package | Madinah - Dar Al-Taqwa (Triple, 7N) | 4 | 3,850 MAD | 15,400 MAD |
| service | Airport Transfer | 4 | 500 MAD | 2,000 MAD |
| service | Ziyarat Makkah Tour | 4 | 400 MAD | 1,600 MAD |
| service | Ziyarat Madinah Tour | 4 | 350 MAD | 1,400 MAD |
| service | Travel Insurance | 4 | 300 MAD | 1,200 MAD |
| **Subtotal** | | | | **101,600 MAD** |
| discount | Family Discount (10%) | 1 | -5,000 MAD | -5,000 MAD |
| **TOTAL** | | | | **96,600 MAD** |

**Payments:**

| ID | Date | Amount | Method | Reference | Paid By |
|----|------|--------|--------|-----------|---------|
| `pay-001` | 2026-02-10 | 50,000 MAD | bank_transfer | VIR-2026-001 | Mohammed El Fassi |
| `pay-002` | 2026-02-25 | 30,000 MAD | cash | - | Mohammed El Fassi |
| **Total Paid** | | **80,000 MAD** | | | |
| **Remaining** | | **16,600 MAD** | | | |

**Room Assignment:**

| Accommodation | Room Type | Room Number | Pilgrims |
|---------------|-----------|-------------|----------|
| Dar Al-Tawhid | Triple | 305 | Mohammed, Khadija, Youssef |
| Dar Al-Tawhid | Triple | 306 | Fatima (shared with other booking) |
| Dar Al-Taqwa | Triple | 201 | Mohammed, Khadija, Youssef |
| Dar Al-Taqwa | Triple | 202 | Fatima (shared with other booking) |

---

### Booking 2: Benjelloun Group (2 Pilgrims)

**Booking Header:**

| Field | Value |
|-------|-------|
| ID | `booking-002` |
| Booking Number | BK-2026-0002 |
| Client | Aicha Benjelloun |
| Season | Omra Ramadan 2026 |
| Status | confirmed |
| Created By | Ahmed Bennani |
| Branch | Casablanca HQ |

**Pilgrims:**

| ID | Name | Gender | DOB | Passport | Relationship |
|----|------|--------|-----|----------|--------------|
| `pilgrim-005` | Aicha Benjelloun | female | 1965-02-14 | MA2345678 | Head |
| `pilgrim-006` | Hassan Benjelloun | male | 1962-09-30 | MA2345679 | Spouse |

**Invoice Calculation:**

| Item | Qty | Unit Price | Total |
|------|-----|------------|-------|
| Flight RAM-350 Economy | 2 | 9,500 MAD | 19,000 MAD |
| Makkah - Dar Al-Tawhid (Double, 15N) | 2 | 12,000 MAD | 24,000 MAD |
| Madinah - Dar Al-Taqwa (Double, 7N) | 2 | 4,200 MAD | 8,400 MAD |
| Airport Transfer | 2 | 500 MAD | 1,000 MAD |
| Travel Insurance | 2 | 300 MAD | 600 MAD |
| Wheelchair Assistance | 1 | 1,000 MAD | 1,000 MAD |
| **Subtotal** | | | **54,000 MAD** |
| Senior Citizen Discount | 2 | -500 MAD | -1,000 MAD |
| **TOTAL** | | | **53,000 MAD** |

**Payment Status:**
- Paid: 53,000 MAD (Fully Paid)
- Status: **paid**

---

### Booking 3: Chraibi Individual (1 Pilgrim)

**Booking Header:**

| Field | Value |
|-------|-------|
| ID | `booking-003` |
| Booking Number | BK-2026-0003 |
| Client | Omar Chraibi |
| Season | Omra Ramadan 2026 |
| Status | pending |
| Created By | Youssef Tazi |
| Branch | Rabat Office |

**Pilgrim:**

| ID | Name | Gender | DOB | Passport |
|----|------|--------|-----|----------|
| `pilgrim-007` | Omar Chraibi | male | 1985-07-22 | MA3456789 |

**Invoice Calculation:**

| Item | Qty | Unit Price | Total |
|------|-----|------------|-------|
| Flight SV-210 Economy | 1 | 8,500 MAD | 8,500 MAD |
| Makkah - Al-Safwa Towers (Quad, 15N) | 1 | 6,000 MAD | 6,000 MAD |
| Madinah - Al-Noor Hotel (Quad, 7N) | 1 | 1,680 MAD | 1,680 MAD |
| Airport Transfer | 1 | 500 MAD | 500 MAD |
| **TOTAL** | | | **16,680 MAD** |

**Payment Status:**
- Paid: 5,000 MAD (Advance)
- Remaining: 11,680 MAD
- Status: **pending**

---

### Booking 4: Large Group - Alami Family (8 Pilgrims)

**Booking Header:**

| Field | Value |
|-------|-------|
| ID | `booking-004` |
| Booking Number | BK-2026-0004 |
| Client | Fatima Zahra Alami |
| Season | Omra Ramadan 2026 |
| Status | confirmed |
| Created By | Khadija Idrissi |
| Branch | Marrakech Office |
| Same Selection | true |

**Pilgrims:**

| ID | Name | Gender | DOB | Relationship | Is Mahram |
|----|------|--------|-----|--------------|-----------|
| `pilgrim-008` | Driss Alami | male | 1955-01-10 | Head | Yes |
| `pilgrim-009` | Fatima Zahra Alami | female | 1960-04-05 | Spouse | No |
| `pilgrim-010` | Karim Alami | male | 1980-06-15 | Child | Yes |
| `pilgrim-011` | Naima Alami | female | 1983-09-20 | Child-in-law | No |
| `pilgrim-012` | Samir Alami | male | 1985-12-08 | Child | Yes |
| `pilgrim-013` | Laila Alami | female | 1988-03-25 | Child-in-law | No |
| `pilgrim-014` | Hamza Alami | male | 2005-07-12 | Grandchild | Yes |
| `pilgrim-015` | Yasmine Alami | female | 2008-11-30 | Grandchild | No |

**Invoice Calculation:**

| Item | Qty | Unit Price | Total |
|------|-----|------------|-------|
| Flight RAM-352 Economy | 8 | 9,500 MAD | 76,000 MAD |
| Makkah - Dar Al-Tawhid (Quad, 15N) | 8 | 9,000 MAD | 72,000 MAD |
| Madinah - Dar Al-Taqwa (Quad, 7N) | 8 | 3,360 MAD | 26,880 MAD |
| Airport Transfer | 8 | 500 MAD | 4,000 MAD |
| Ziyarat Makkah Tour | 8 | 400 MAD | 3,200 MAD |
| Ziyarat Madinah Tour | 8 | 350 MAD | 2,800 MAD |
| Travel Insurance | 8 | 300 MAD | 2,400 MAD |
| Meal Package (15 days) | 8 | 1,500 MAD | 12,000 MAD |
| **Subtotal** | | | **199,280 MAD** |
| Family Discount (10%) | 1 | -5,000 MAD | -5,000 MAD |
| Senior Citizen Discount (2) | 2 | -500 MAD | -1,000 MAD |
| **TOTAL** | | | **193,280 MAD** |

**Payments:**

| Date | Amount | Method |
|------|--------|--------|
| 2026-02-15 | 100,000 MAD | bank_transfer |
| 2026-03-01 | 50,000 MAD | card |
| **Total Paid** | **150,000 MAD** | |
| **Remaining** | **43,280 MAD** | |

---

### Booking 5: Draft with Hold (Benkirane)

**Booking Header:**

| Field | Value |
|-------|-------|
| ID | `booking-005` |
| Booking Number | BK-2026-0005 |
| Client | Rachid Benkirane |
| Season | Omra Ramadan 2026 |
| Status | draft |
| Hold Expires At | 2026-03-10 14:30:00 |
| Hold Session ID | `session-abc123` |

**Booking Locks (Active):**

| Resource Type | Accommodation | Room Type | Quantity | Expires At |
|---------------|---------------|-----------|----------|------------|
| bed | Dar Al-Tawhid | double | 2 | 2026-03-10 14:30:00 |
| flight_seat | RAM-354 | economy | 2 | 2026-03-10 14:30:00 |

---

## 10. Inventory Status Summary (After Bookings)

### Flight Seat Inventory Status

| Flight | Class | Purchased | Sold | Available | Held | Truly Available |
|--------|-------|-----------|------|-----------|------|-----------------|
| RAM-350 | economy | 50 | 6 | 44 | 0 | 44 |
| RAM-350 | business | 10 | 0 | 10 | 0 | 10 |
| RAM-352 | economy | 45 | 8 | 37 | 0 | 37 |
| SV-210 | economy | 60 | 1 | 59 | 0 | 59 |
| RAM-354 | economy | 50 | 0 | 50 | 2 | 48 |

### Hotel Bed Inventory Status (Makkah - Dar Al-Tawhid)

| Room Type | Beds Purchased | Sold | Available | Held | Truly Available |
|-----------|----------------|------|-----------|------|-----------------|
| Double | 20 | 2 | 18 | 2 | 16 |
| Triple | 24 | 4 | 20 | 0 | 20 |
| Quad | 24 | 8 | 16 | 0 | 16 |

### Hotel Bed Inventory Status (Madinah - Dar Al-Taqwa)

| Room Type | Beds Purchased | Sold | Available | Held | Truly Available |
|-----------|----------------|------|-----------|------|-----------------|
| Double | 16 | 2 | 14 | 0 | 14 |
| Triple | 21 | 4 | 17 | 0 | 17 |
| Quad | 20 | 8 | 12 | 0 | 12 |

---

## 11. Financial Summary

### Revenue by Booking

| Booking | Client | Pilgrims | Total | Paid | Remaining | Status |
|---------|--------|----------|-------|------|-----------|--------|
| BK-2026-0001 | El Fassi | 4 | 96,600 MAD | 80,000 MAD | 16,600 MAD | confirmed |
| BK-2026-0002 | Benjelloun | 2 | 53,000 MAD | 53,000 MAD | 0 MAD | paid |
| BK-2026-0003 | Chraibi | 1 | 16,680 MAD | 5,000 MAD | 11,680 MAD | pending |
| BK-2026-0004 | Alami | 8 | 193,280 MAD | 150,000 MAD | 43,280 MAD | confirmed |
| **TOTAL** | | **15** | **359,560 MAD** | **288,000 MAD** | **71,560 MAD** | |

### Expense Tracking

| Category | Season | Type | Amount | Description |
|----------|--------|------|--------|-------------|
| Flight Purchase | Ramadan 2026 | prepayment | 1,507,500 MAD | All flight seats |
| Hotel Purchase | Ramadan 2026 | prepayment | 687,400 MAD | All hotel beds |
| Airport Services | Ramadan 2026 | simple | 15,000 MAD | Bus rentals |
| Guides | Ramadan 2026 | simple | 8,000 MAD | Guide salaries |
| Marketing | Ramadan 2026 | simple | 5,000 MAD | Advertising |
| **TOTAL EXPENSES** | | | **2,222,900 MAD** | |

### Profit Projection (Ramadan 2026)

| Metric | Amount |
|--------|--------|
| **Total Inventory Cost** | 2,194,900 MAD |
| **Operational Expenses** | 28,000 MAD |
| **Total Expenses** | 2,222,900 MAD |
| **Potential Revenue (100% sold)** | 2,893,250 MAD |
| **Current Booked Revenue** | 359,560 MAD |
| **Current Collection Rate** | 80.1% |
| **Projected Gross Margin** | 670,350 MAD (23.2%) |

---

## 12. Calculation Verification Checklist

### Booking Total Calculations

```
✅ Booking 1 (El Fassi):
   Package: (4 × 9,500) + (4 × 10,500) + (4 × 3,850) = 38,000 + 42,000 + 15,400 = 95,400 MAD
   Services: (4 × 500) + (4 × 400) + (4 × 350) + (4 × 300) = 2,000 + 1,600 + 1,400 + 1,200 = 6,200 MAD
   Subtotal: 95,400 + 6,200 = 101,600 MAD
   Discount: 10% of 101,600 = 10,160 MAD → capped at 5,000 MAD
   Total: 101,600 - 5,000 = 96,600 MAD ✓

✅ Booking 2 (Benjelloun):
   Package: (2 × 9,500) + (2 × 12,000) + (2 × 4,200) = 19,000 + 24,000 + 8,400 = 51,400 MAD
   Services: (2 × 500) + (2 × 300) + (1 × 1,000) = 1,000 + 600 + 1,000 = 2,600 MAD
   Subtotal: 51,400 + 2,600 = 54,000 MAD
   Discount: 2 × 500 = 1,000 MAD (Senior Citizen)
   Total: 54,000 - 1,000 = 53,000 MAD ✓

✅ Booking 3 (Chraibi):
   Package: 8,500 + 6,000 + 1,680 = 16,180 MAD
   Services: 500 MAD
   Total: 16,180 + 500 = 16,680 MAD ✓

✅ Booking 4 (Alami):
   Package: (8 × 9,500) + (8 × 9,000) + (8 × 3,360) = 76,000 + 72,000 + 26,880 = 174,880 MAD
   Services: (8 × 500) + (8 × 400) + (8 × 350) + (8 × 300) + (8 × 1,500) = 4,000 + 3,200 + 2,800 + 2,400 + 12,000 = 24,400 MAD
   Subtotal: 174,880 + 24,400 = 199,280 MAD
   Discount: 10% of 199,280 = 19,928 → capped at 5,000 MAD + 2 × 500 = 6,000 MAD
   Total: 199,280 - 6,000 = 193,280 MAD ✓
```

### Inventory Availability Calculations

```
✅ Flight RAM-350 Economy:
   Purchased: 50 seats
   Sold: El Fassi (4) + Benjelloun (2) = 6 seats
   Available: 50 - 6 = 44 seats ✓

✅ Hotel Dar Al-Tawhid Triple:
   Purchased: 24 beds
   Sold: El Fassi (4) = 4 beds
   Available: 24 - 4 = 20 beds ✓

✅ Hotel Dar Al-Tawhid Quad:
   Purchased: 24 beds
   Sold: Alami (8) = 8 beds
   Available: 24 - 8 = 16 beds ✓
```

### Payment Balance Calculations

```
✅ Booking 1: Total 96,600 - Paid 80,000 = Remaining 16,600 MAD ✓
✅ Booking 2: Total 53,000 - Paid 53,000 = Remaining 0 MAD ✓
✅ Booking 3: Total 16,680 - Paid 5,000 = Remaining 11,680 MAD ✓
✅ Booking 4: Total 193,280 - Paid 150,000 = Remaining 43,280 MAD ✓
```

---

## 13. Test Scenarios

### Scenario A: New Booking with Inventory Check
1. Create booking for 3 pilgrims
2. Select Flight RAM-354 (48 available after holds)
3. Select Dar Al-Tawhid Double (16 available after holds)
4. Verify beds_sold increases by 3
5. Verify booking total calculation

### Scenario B: Hold Expiration
1. Wait for `booking-005` hold to expire
2. Verify booking status changes to `expired`
3. Verify locks are released
4. Verify inventory becomes available again

### Scenario C: Payment Completion
1. Record final payment for `booking-001` (16,600 MAD)
2. Verify `paid_amount` = `total_amount`
3. Verify status can be changed to `paid`

### Scenario D: Discount Calculation
1. Create booking totaling 25,000 MAD
2. Apply Early Bird discount (5%)
3. Verify discount = 1,250 MAD (5% of 25,000)
4. Verify final total = 23,750 MAD

### Scenario E: Overbooking Prevention
1. Attempt to book 50 beds in Dar Al-Tawhid Triple
2. Only 20 available
3. Verify system prevents overbooking
4. Verify appropriate error message

### Scenario F: Mahram Group Management
1. Book female pilgrim without mahram
2. Verify warning/validation
3. Assign to existing male mahram
4. Verify mahram_group association

---

## 14. SQL Insert Statements

For easy seeding, here are the SQL statements to insert this demo data:

```sql
-- Note: Run these after the existing reset-and-seed.sql

-- Insert additional clients
INSERT INTO clients (id, agency_id, full_name, full_name_ar, phone, email, branch_id)
VALUES
  ('client-001', 'YOUR_AGENCY_ID', 'Mohammed El Fassi', 'محمد الفاسي', '+212661123456', 'm.elfassi@email.com', 'branch-001'),
  ('client-002', 'YOUR_AGENCY_ID', 'Aicha Benjelloun', 'عائشة بنجلون', '+212662234567', 'aicha.b@email.com', 'branch-001'),
  ('client-003', 'YOUR_AGENCY_ID', 'Omar Chraibi', 'عمر الشرايبي', '+212663345678', 'omar.c@email.com', 'branch-002'),
  ('client-004', 'YOUR_AGENCY_ID', 'Fatima Zahra Alami', 'فاطمة الزهراء العلمي', '+212664456789', 'fz.alami@email.com', 'branch-003'),
  ('client-005', 'YOUR_AGENCY_ID', 'Rachid Benkirane', 'رشيد بنكيران', '+212665567890', 'rachid.b@email.com', 'branch-001');

-- Additional inserts would follow for bookings, pilgrims, payments, etc.
-- Full SQL script available upon request
```

---

## 15. API Test Calls

### Create Booking
```bash
POST /api/bookings
{
  "client_id": "client-001",
  "season_id": "season-ramadan-2026",
  "flight_seat_inventory_id": "fsi-001",
  "hotel_inventory_ids": ["hbi-002", "hbi-005"],
  "same_selection_for_all": true,
  "pilgrims": [
    {
      "full_name": "Mohammed El Fassi",
      "full_name_ar": "محمد الفاسي",
      "gender": "male",
      "date_of_birth": "1970-05-15",
      "passport_number": "MA1234567",
      "is_mahram": true
    }
    // ... more pilgrims
  ],
  "services": [
    { "extra_service_id": "svc-001", "quantity": 1 },
    { "extra_service_id": "svc-003", "quantity": 1 }
  ],
  "discount_id": "disc-002"
}
```

### Check Availability
```bash
GET /api/hotel-inventory/available?season_id=season-ramadan-2026&accommodation_id=hotel-001
```

### Process Payment
```bash
POST /api/payments/booking/booking-001
{
  "amount": 16600,
  "payment_method": "cash",
  "paid_by": "Mohammed El Fassi"
}
```

---

## Summary

This demo data provides:
- **1 Agency** with 3 branches and 4 users
- **3 Seasons** (1 active, 2 upcoming)
- **4 Flights** with seat inventory
- **6 Hotels** with multiple room types
- **10 Extra services**
- **6 Discount types**
- **5 Clients**
- **5 Bookings** (various statuses: confirmed, paid, pending, draft)
- **15 Pilgrims** total
- Complete financial tracking with verified calculations

Use this data to demonstrate:
- End-to-end booking workflow
- Inventory management (beds and flights)
- Payment processing
- Discount application
- Hold/lock mechanism
- Multi-branch operations
- Reporting and financial summary

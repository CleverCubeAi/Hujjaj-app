import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../api/endpoints';
import { BookingDraft, emptyDraft, getDraft, PilgrimDraft, saveDraft } from './draftStore';
import { lockBeds, lockFlight } from './lockSession';
import { isOnline } from '../offline/queue';
import { formatMad } from '../lib/format';
import { shareWhatsApp } from '../lib/whatsapp';
import { Button, Card, Chip, Screen, TextField } from '../ui/primitives';
import { colors, space } from '../theme/tokens';

const STEPS = ['client', 'program', 'travelers', 'trip', 'stay', 'extras', 'pay_confirm'] as const;

export function WizardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const [draft, setDraft] = useState<BookingDraft>(emptyDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [flightInv, setFlightInv] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [hotelInv, setHotelInv] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [otherLocks, setOtherLocks] = useState<any[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [created, setCreated] = useState<{ id: string; booking_number: string; remaining?: number } | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      if (draftId) {
        const existing = await getDraft(draftId);
        if (existing) setDraft(existing);
      }
    })();
  }, [draftId]);

  useEffect(() => {
    navigation.setOptions({ title: t(STEPS[draft.step]) });
  }, [draft.step, navigation, t]);

  const persist = async (next: BookingDraft) => {
    setDraft(next);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      saveDraft(next);
    }, 250);
  };

  useEffect(() => {
    api.getClients().then((d) => setClients(Array.isArray(d) ? d.slice(0, 12) : [])).catch(() => {});
    api.getSeasons().then((d) => setSeasons(Array.isArray(d) ? d : [])).catch(() => {});
    api.getServices().then((d) => setServices(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!draft.seasonId) return;
    api.getFlights(draft.seasonId).then((d) => setFlights(Array.isArray(d) ? d : [])).catch(() => {});
    api.getAccommodations(draft.seasonId).then((d) => setHotels(Array.isArray(d) ? d : [])).catch(() => {});
    api.getAvailableSeats({ season_id: draft.seasonId }).then((d) => setFlightInv(Array.isArray(d) ? d : [])).catch(() => {
      api.getFlightInventory({ season_id: draft.seasonId }).then((x) => setFlightInv(Array.isArray(x) ? x : [])).catch(() => {});
    });
    api.getHotelInventory({ season_id: draft.seasonId }).then((d) => setHotelInv(Array.isArray(d) ? d : [])).catch(() => {});
  }, [draft.seasonId, draft.step]);

  useEffect(() => {
    if (draft.step !== 3 && draft.step !== 4) return;
    const refresh = () => {
      if (!draft.seasonId) return;
      api.getAvailableSeats({ season_id: draft.seasonId }).then((d) => setFlightInv(Array.isArray(d) ? d : [])).catch(() => {});
      api.getHotelInventory({ season_id: draft.seasonId }).then((d) => setHotelInv(Array.isArray(d) ? d : [])).catch(() => {});
      api.getLocks({ season_id: draft.seasonId, exclude_session_id: draft.lockSessionId })
        .then((d) => setOtherLocks(Array.isArray(d) ? d : []))
        .catch(() => {});
    };
    refresh();
    const inv = setInterval(refresh, 15000);
    const locks = setInterval(refresh, 10000);
    const extend = setInterval(() => {
      api.extendLocks(draft.lockSessionId).catch(() => {});
    }, 5 * 60 * 1000);
    return () => {
      clearInterval(inv);
      clearInterval(locks);
      clearInterval(extend);
    };
  }, [draft.step, draft.seasonId, draft.lockSessionId]);

  useEffect(() => {
    return () => {
      api.releaseLocks(draft.lockSessionId).catch(() => {});
    };
  }, [draft.lockSessionId]);

  const qty = Math.max(draft.pilgrims.length, 1);
  const selectedFlightInv = flightInv.find((i: any) => i.id === draft.flightInventoryId || i.flight_id === draft.flightId);
  const selectedHotelBatches = hotelInv.filter((i: any) => (draft.hotelInventoryIds || []).includes(i.id));
  const roomPrice = selectedHotelBatches.reduce((s: number, i: any) => s + Number(i.sell_price_per_bed || 0), 0) * qty;
  const flightPrice = Number(selectedFlightInv?.sell_price_per_seat || selectedFlightInv?.sell_price || 0) * qty;
  const extrasTotal = draft.extras.reduce((s, e) => s + Number(e.price || 0) * e.quantity * qty, 0);
  const total = roomPrice + flightPrice + extrasTotal;

  const canNext = useMemo(() => {
    if (draft.step === 0) return !!(draft.clientId || (draft.newClient?.full_name && draft.newClient?.phone));
    if (draft.step === 1) return !!draft.seasonId;
    if (draft.step === 2) {
      return draft.pilgrims.length > 0 && draft.pilgrims.every((p) => p.full_name_ar && p.gender);
    }
    if (draft.step === 3) return !!draft.flightId;
    if (draft.step === 4) return !!(draft.accommodationId && (draft.hotelInventoryIds?.length || draft.roomTypeId));
    return true;
  }, [draft]);

  const lockResource = async (kind: 'flight' | 'bed', next: BookingDraft) => {
    if (!(await isOnline())) {
      Alert.alert(t('cannot_lock_offline'));
      return;
    }
    try {
      if (kind === 'flight' && next.flightId && next.seasonId) {
        await lockFlight(next.lockSessionId, next.seasonId, next.flightId, Math.max(next.pilgrims.length, 1));
      }
      if (kind === 'bed' && next.accommodationId && next.roomTypeId && next.seasonId) {
        await lockBeds(
          next.lockSessionId,
          next.seasonId,
          next.accommodationId,
          next.roomTypeId,
          Math.max(next.pilgrims.length, 1),
        );
      }
    } catch (e: any) {
      setError(e.message || t('lock_warning'));
    }
  };

  const submitBooking = async () => {
    setBusy(true);
    setError('');
    try {
      if (!(await isOnline())) throw new Error(t('cannot_lock_offline'));
      let clientId = draft.clientId;
      if (!clientId && draft.newClient) {
        const c = await api.createClient(draft.newClient);
        clientId = c.id;
      }
      if (!clientId) throw new Error(t('select_client'));
      const booking = await api.createBooking({
        client_id: clientId,
        season_id: draft.seasonId,
        flight_id: draft.flightId,
        flight_seat_inventory_id: draft.flightInventoryId,
        accommodation_id: draft.accommodationId,
        room_type_id: draft.roomTypeId,
        hotel_inventory_ids: draft.hotelInventoryIds,
        same_selection_for_all: true,
        notes: draft.notes,
        pilgrims: draft.pilgrims.map((p) => ({
          full_name: p.full_name || p.full_name_ar,
          full_name_ar: p.full_name_ar,
          gender: p.gender,
          passport_number: p.passport_number || '',
          phone: p.phone,
          is_mahram: !!p.is_mahram,
        })),
        extra_services: draft.extras.map((e) => ({ service_id: e.service_id, quantity: e.quantity, pilgrim_ids: [] })),
      });
      const amount = Number(paymentAmount);
      await api.confirmBooking(booking.id);
      if (amount > 0) {
        await api.createPayment(booking.id, {
          amount,
          payment_method: paymentMethod,
          reference_number: paymentRef || undefined,
        });
      }
      const fresh = await api.getBooking(booking.id);
      setCreated({
        id: booking.id,
        booking_number: booking.booking_number || fresh.booking_number,
        remaining: Number(fresh.remaining_balance ?? fresh.total_amount - fresh.paid_amount),
      });
      await persist({ ...draft, createdBookingId: booking.id, bookingNumber: booking.booking_number });
    } catch (e: any) {
      setError(e.message || t('error'));
    } finally {
      setBusy(false);
    }
  };

  const addPilgrim = () => {
    persist({
      ...draft,
      pilgrims: [...draft.pilgrims, { full_name: '', full_name_ar: '', gender: '', passport_number: '' }],
    });
  };

  const updatePilgrim = (i: number, patch: Partial<PilgrimDraft>) => {
    const pilgrims = draft.pilgrims.map((p, idx) => (idx === i ? { ...p, ...patch } : p));
    persist({ ...draft, pilgrims });
  };

  const relevantLocks = otherLocks.filter((l: any) => {
    if (l.flight_id && l.flight_id === draft.flightId) return true;
    if (l.accommodation_id && l.accommodation_id === draft.accommodationId) return true;
    return false;
  });

  if (created) {
    return (
      <Screen scroll>
        <View style={{ gap: space.md }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: colors.navy }}>{t('success_title')}</Text>
          <Card>
            <Text style={{ color: colors.gold, fontSize: 22, fontWeight: '700' }}>{created.booking_number}</Text>
            <Text style={{ color: colors.navy, marginTop: 8 }}>{t('remaining')}: {formatMad(created.remaining || 0)}</Text>
          </Card>
          <Button
            label={t('share_whatsapp')}
            onPress={() =>
              shareWhatsApp(`${created.booking_number} · ${formatMad(created.remaining || 0)}`)
            }
          />
          <Button label={t('assign_rooms_web')} variant="ghost" onPress={() => router.replace(`/bookings/${created.id}`)} />
          <Button label={t('home')} variant="ghost" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ gap: space.md, paddingBottom: 40 }}>
        <Text style={{ color: colors.textMuted }}>{t('step_of', { current: draft.step + 1, total: 7 })}</Text>

        {draft.step === 0 ? (
          <View style={{ gap: 10 }}>
            <TextField
              label={t('search_client')}
              value={clientQuery}
              onChangeText={(v) => {
                setClientQuery(v);
                if (v.length >= 2) api.getClients(v).then((d) => setClients(Array.isArray(d) ? d : [])).catch(() => {});
              }}
              placeholder={t('search_client')}
            />
            <Text style={{ fontWeight: '700', color: colors.tealDeep }}>{t('recent_clients')}</Text>
            {clients.map((c) => (
              <Pressable key={c.id} onPress={() => persist({ ...draft, clientId: c.id, newClient: undefined })}>
                <Card style={draft.clientId === c.id ? { borderColor: colors.gold, borderWidth: 2 } : undefined}>
                  <Text style={{ fontWeight: '700', color: colors.navy }}>{c.full_name_ar || c.full_name}</Text>
                  <Text style={{ color: colors.textMuted }}>{c.phone}</Text>
                </Card>
              </Pressable>
            ))}
            <Text style={{ fontWeight: '700', color: colors.tealDeep }}>{t('new_client')}</Text>
            <TextField
              label={t('full_name')}
              value={draft.newClient?.full_name || ''}
              onChangeText={(full_name) => persist({ ...draft, clientId: undefined, newClient: { full_name, full_name_ar: draft.newClient?.full_name_ar || '', phone: draft.newClient?.phone || '' } })}
              autoCapitalize="words"
            />
            <TextField
              label={t('full_name_ar')}
              value={draft.newClient?.full_name_ar || ''}
              onChangeText={(full_name_ar) => persist({ ...draft, clientId: undefined, newClient: { full_name: draft.newClient?.full_name || '', full_name_ar, phone: draft.newClient?.phone || '' } })}
              autoCapitalize="words"
            />
            <TextField
              label={t('phone')}
              value={draft.newClient?.phone || ''}
              onChangeText={(phone) => persist({ ...draft, clientId: undefined, newClient: { full_name: draft.newClient?.full_name || '', full_name_ar: draft.newClient?.full_name_ar || '', phone } })}
              keyboardType="phone-pad"
            />
          </View>
        ) : null}

        {draft.step === 1 ? (
          <View style={{ gap: 10 }}>
            {seasons.filter((s) => s.status === 'active' || !s.status || s.status === 'open').map((s) => (
              <Pressable key={s.id} onPress={() => persist({ ...draft, seasonId: s.id })}>
                <Card style={draft.seasonId === s.id ? { borderColor: colors.gold, borderWidth: 2 } : undefined}>
                  <Text style={{ fontWeight: '700', color: colors.navy }}>{s.name}</Text>
                  <Text style={{ color: colors.textMuted }}>{t(s.type || 'omra')} · {s.start_date} → {s.end_date}</Text>
                </Card>
              </Pressable>
            ))}
          </View>
        ) : null}

        {draft.step === 2 ? (
          <View style={{ gap: 10 }}>
            {draft.pilgrims.map((p, i) => (
              <Card key={i}>
                <TextField label={t('pilgrim_name_ar')} value={p.full_name_ar} onChangeText={(full_name_ar) => updatePilgrim(i, { full_name_ar, full_name: p.full_name || full_name_ar })} autoCapitalize="words" />
                <View style={{ height: 8 }} />
                <TextField label={t('full_name')} value={p.full_name} onChangeText={(full_name) => updatePilgrim(i, { full_name })} autoCapitalize="words" />
                <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
                  <Chip label={t('male')} active={p.gender === 'male'} onPress={() => updatePilgrim(i, { gender: 'male' })} />
                  <Chip label={t('female')} active={p.gender === 'female'} onPress={() => updatePilgrim(i, { gender: 'female' })} />
                </View>
                <TextField label={t('passport')} value={p.passport_number || ''} onChangeText={(passport_number) => updatePilgrim(i, { passport_number })} />
                <Text style={{ color: colors.textMuted, marginTop: 4 }}>{t('passport_optional')}</Text>
                {p.gender === 'male' ? (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: colors.navy, fontWeight: '600' }}>{t('mahram_for')}</Text>
                    {draft.pilgrims.map((o, j) =>
                      o.gender === 'female' ? (
                        <Chip
                          key={j}
                          label={o.full_name_ar || `${t('female')} ${j + 1}`}
                          active={p.mahram_for_index === j}
                          onPress={() => updatePilgrim(i, { is_mahram: true, mahram_for_index: j })}
                        />
                      ) : null,
                    )}
                  </View>
                ) : null}
              </Card>
            ))}
            <Button label={t('add_pilgrim')} variant="ghost" onPress={addPilgrim} />
          </View>
        ) : null}

        {draft.step === 3 ? (
          <View style={{ gap: 10 }}>
            {relevantLocks.length > 0 ? (
              <Card style={{ borderColor: colors.warning, borderWidth: 1 }}>
                <Text style={{ color: colors.warning, fontWeight: '700' }}>{t('lock_warning')}</Text>
                {relevantLocks.map((l: any) => (
                  <Text key={l.id} style={{ color: colors.navy, marginTop: 4 }}>
                    {t('lock_held_by', { name: l.user_name || l.user_email, qty: l.quantity, time: String(l.expires_at || '').slice(11, 16) })}
                  </Text>
                ))}
              </Card>
            ) : null}
            {flights.map((f) => {
              const inv = flightInv.find((i: any) => i.flight_id === f.id) || f;
              const seats = inv.seats_available ?? inv.available_seats ?? inv.remaining_seats;
              return (
                <Pressable
                  key={f.id}
                  onPress={async () => {
                    const next = { ...draft, flightId: f.id, flightInventoryId: inv.id };
                    await persist(next);
                    await lockResource('flight', next);
                  }}
                >
                  <Card style={draft.flightId === f.id ? { borderColor: colors.gold, borderWidth: 2 } : undefined}>
                    <Text style={{ fontWeight: '700', color: colors.navy }}>{f.code || f.carrier} · {f.departure_city} → {f.arrival_city}</Text>
                    <Text style={{ color: colors.textMuted }}>{f.departure_date} / {f.return_date}</Text>
                    <Text style={{ color: colors.gold, fontWeight: '700' }}>{t('remaining_seats')}: {seats ?? '—'}</Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {draft.step === 4 ? (
          <View style={{ gap: 10 }}>
            {hotels.map((h) => {
              const invs = hotelInv.filter((i: any) => (i.accommodation_id || i.accommodations?.id) === h.id);
              const beds = invs.reduce((s: number, i: any) => s + Number(i.beds_available || 0), 0);
              return (
                <Card key={h.id}>
                  <Pressable
                    onPress={() => persist({ ...draft, accommodationId: h.id })}
                  >
                    <Text style={{ fontWeight: '700', color: colors.navy }}>{h.name_ar || h.name}</Text>
                    <Text style={{ color: colors.textMuted }}>{h.city} · {t('remaining_beds')}: {beds}</Text>
                  </Pressable>
                  {draft.accommodationId === h.id
                    ? invs.map((i: any) => (
                      <Pressable
                        key={i.id}
                        onPress={async () => {
                          const next = {
                            ...draft,
                            accommodationId: h.id,
                            roomTypeId: i.room_type_id || i.room_types?.id,
                            hotelInventoryIds: [i.id],
                          };
                          await persist(next);
                          await lockResource('bed', next);
                        }}
                      >
                        <View style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                          <Text style={{ color: colors.navy }}>{i.room_types?.type || i.room_type || t('room_type')}</Text>
                          <Text style={{ color: colors.gold }}>{t('remaining_beds')}: {i.beds_available} · {formatMad(i.sell_price_per_bed)}</Text>
                        </View>
                      </Pressable>
                    ))
                    : null}
                </Card>
              );
            })}
          </View>
        ) : null}

        {draft.step === 5 ? (
          <View style={{ gap: 10 }}>
            {services.length === 0 ? <Text style={{ color: colors.textMuted }}>{t('no_extras')}</Text> : null}
            {services.map((s) => {
              const on = draft.extras.some((e) => e.service_id === s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    const extras = on
                      ? draft.extras.filter((e) => e.service_id !== s.id)
                      : [...draft.extras, { service_id: s.id, name: s.name_ar || s.name, price: Number(s.price || 0), quantity: 1 }];
                    persist({ ...draft, extras });
                  }}
                >
                  <Card style={on ? { borderColor: colors.gold, borderWidth: 2 } : undefined}>
                    <Text style={{ fontWeight: '700', color: colors.navy }}>{s.name_ar || s.name}</Text>
                    <Text style={{ color: colors.gold }}>{formatMad(s.price)}</Text>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {draft.step === 6 ? (
          <View style={{ gap: 10 }}>
            <Card>
              <Text style={{ fontWeight: '700', color: colors.tealDeep }}>{t('totals')}</Text>
              <Text style={{ color: colors.gold, fontSize: 28, fontWeight: '700' }}>{formatMad(total)}</Text>
              <Text style={{ color: colors.navy }}>{t('trip')} {formatMad(flightPrice)} · {t('stay')} {formatMad(roomPrice)}</Text>
            </Card>
            <TextField label={t('amount')} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(['cash', 'card', 'bank_transfer', 'check'] as const).map((m) => (
                <Chip key={m} label={t(m)} active={paymentMethod === m} onPress={() => setPaymentMethod(m)} />
              ))}
            </View>
            <TextField label={t('reference')} value={paymentRef} onChangeText={setPaymentRef} />
            <Button label={t('confirm_booking')} onPress={submitBooking} loading={busy} />
          </View>
        ) : null}

        {error ? <Text style={{ color: colors.danger, fontWeight: '600' }}>{error}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {draft.step > 0 ? (
            <View style={{ flex: 1 }}>
              <Button label={t('back')} variant="ghost" onPress={() => persist({ ...draft, step: draft.step - 1 })} />
            </View>
          ) : null}
          {draft.step < 6 ? (
            <View style={{ flex: 1 }}>
              <Button
                label={t('next')}
                disabled={!canNext}
                onPress={() => persist({ ...draft, step: draft.step + 1 })}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

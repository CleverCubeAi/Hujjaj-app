import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Stepper,
  Button,
  Group,
  TextInput,
  NumberInput,
  Select,
  Paper,
  Title,
  Stack,
  Text,
  Table,
  Badge,
  ActionIcon,
  Card,
  SimpleGrid,
  Divider,
  Box,
  Checkbox,
  Radio,
  Alert,
  LoadingOverlay,
  ThemeIcon,
  ScrollArea,
  Switch,
  Tooltip,
  Progress
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ImageUpload } from '../../components/common/ImageUpload';
import {
  User,
  Users,
  Plane,
  Building2,
  Plus,
  Trash2,
  CreditCard,
  BedDouble,
  CheckCircle,
  AlertCircle,
  Search,
  Clock,
  Lock
} from 'lucide-react';

// Booking lock interface
interface BookingLock {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  quantity: number;
  expires_at: string;
  created_at: string;
  session_id: string;
  resource_type: 'bed' | 'flight_seat';
}

interface Client {
  id: string;
  full_name: string;
  full_name_ar?: string;
  phone: string;
}

interface ExistingPilgrim {
  id: string;
  full_name: string;
  full_name_ar?: string;
  gender: 'male' | 'female';
  phone?: string;
  passport_number?: string;
  photo_url?: string | null;
  passport_scan_url?: string | null;
  bookings?: { id: string; booking_number: string } | null;
}

interface PilgrimForm {
  id?: string;
  full_name: string;
  full_name_ar: string;
  gender: 'male' | 'female' | '';
  date_of_birth?: Date | null;
  passport_number: string;
  phone: string;
  photo_url?: string | null;
  passport_scan_url?: string | null;
  email?: string;
  mahram_group_id?: string;
  spouse_index?: number;
  parent_index?: number;
  relationship_type?: 'family' | 'married' | 'friends';
  is_mahram?: boolean;
  mahram_with_index?: number; // Index of the pilgrim this person is mahram with
  // Client linking
  is_booking_client: boolean; // This pilgrim is the same as the booking client
  is_self_client: boolean; // Create this pilgrim as a new client too
  linked_client_id?: string; // Link to existing client
}

interface ServiceSelection {
  service_id: string;
  name: string;
  price: number;
  quantity: number;
  pilgrim_ids: string[];
}

export function BookingWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Client
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [newClient, setNewClient] = useState({
    full_name: '',
    full_name_ar: '',
    phone: '',
    email: ''
  });
  const [isNewClient, setIsNewClient] = useState(false);
  const [addNewClientAsPilgrim, setAddNewClientAsPilgrim] = useState(true); // Default to true - add client as pilgrim
  const [clientPilgrims, setClientPilgrims] = useState<ExistingPilgrim[]>([]);

  // Step 2: Pilgrims
  const [pilgrims, setPilgrims] = useState<PilgrimForm[]>([]);

  // Step 3-4: Package
  const [seasons, setSeasons] = useState<any[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [accommodations, setAccommodations] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [availableFlightInventory, setAvailableFlightInventory] = useState<any[]>([]);
  const [availableRoomInventory, setAvailableRoomInventory] = useState<any[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [selectedFlight, setSelectedFlight] = useState<string | null>(null);
  const [selectedAccommodationId, setSelectedAccommodationId] = useState<string | null>(null); // Hotel from selected combo (same-for-all or per-pilgrim)
  const [selectedRoomType, setSelectedRoomType] = useState<string | null>(null);
  const [selectedRoomInventory, setSelectedRoomInventory] = useState<string | null>(null); // legacy single - used when same for all with single batch
  const [selectedRoomInventories, setSelectedRoomInventories] = useState<any[]>([]); // multiple batches for same-for-all
  const [selectedFlightInventory, setSelectedFlightInventory] = useState<string | null>(null);
  const [accommodationInventory, setAccommodationInventory] = useState<any[]>([]); // Inventory for selected accommodation
  const [allSeasonInventory, setAllSeasonInventory] = useState<any[]>([]); // All inventory for season (multi-hotel)
  const [sameSelectionForAll, setSameSelectionForAll] = useState(true);
  const [pilgrimFlightSelections, setPilgrimFlightSelections] = useState<Record<number, string>>({});
  const [pilgrimRoomSelections, setPilgrimRoomSelections] = useState<Record<number, { accommodationId: string; roomTypeId: string; inventoryId: string; inventories: any[] }>>({}); // hotel→room→beds per pilgrim
  const [pilgrimCol1Hotel, setPilgrimCol1Hotel] = useState<Record<number, string | null>>({}); // which hotel is focused in col 1 (for cascade)
  const [pilgrimCol2Type, setPilgrimCol2Type] = useState<Record<number, string | null>>({}); // which type is focused in col 2

  // Step 5: Services
  const [availableServices, setAvailableServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceSelection[]>([]);

  // Step 6: Invoice
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string | null>(null);
  const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([]);

  // Step 7: Payment
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<string | null>('cash');

  // Created booking
  const [createdBooking, setCreatedBooking] = useState<any>(null);

  // Booking locks state
  const [sessionId] = useState(() => `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const [activeLocks, setActiveLocks] = useState<BookingLock[]>([]);
  const [otherAgentLocks, setOtherAgentLocks] = useState<BookingLock[]>([]);
  const [lockExpiresAt, setLockExpiresAt] = useState<Date | null>(null);
  const lockRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    loadSeasons();
    loadServices();
    loadAvailableDiscounts();
  }, []);

  useEffect(() => {
    if (clientSearch.length >= 2) {
      searchClients();
    }
  }, [clientSearch]);

  // Load pilgrims related to selected client
  useEffect(() => {
    if (selectedClient?.id) {
      loadClientPilgrims(selectedClient.id);
    } else {
      setClientPilgrims([]);
    }
  }, [selectedClient]);

  useEffect(() => {
    if (selectedSeason) {
      loadFlights(selectedSeason);
      loadAccommodations(selectedSeason);
      loadAvailableFlightInventory(selectedSeason);
    }
  }, [selectedSeason]);

  // Refetch flight inventory when navigating to Flight step - ensures fresh seat counts after bookings
  useEffect(() => {
    if (active === 2 && selectedSeason) {
      loadAvailableFlightInventory(selectedSeason);
    }
  }, [active, selectedSeason]);

  // Load all season inventory - this is the single source for hotel+room options (no top dropdown)
  useEffect(() => {
    if (active === 3 && selectedSeason) {
      api.getHotelInventory({ season_id: selectedSeason })
        .then((data: any) => setAllSeasonInventory(data || []))
        .catch(() => setAllSeasonInventory([]));
    }
  }, [active, selectedSeason]);

  // ============================================
  // Booking Locks Functions
  // ============================================
  
  // Create a bed lock when selecting room type
  const createBedLock = useCallback(async (accommodationId: string, roomTypeId: string, quantity: number) => {
    if (!selectedSeason) return;
    try {
      const result = await api.createBookingLock({
        resource_type: 'bed',
        accommodation_id: accommodationId,
        room_type_id: roomTypeId,
        season_id: selectedSeason,
        quantity,
        session_id: sessionId
      });
      setLockExpiresAt(new Date(result.expires_at));
      console.log('Bed lock created:', result);
    } catch (error: any) {
      console.error('Error creating bed lock:', error);
      // If lock fails due to availability, show error
      if (error.response?.status === 409) {
        // Handle conflict - not enough beds
      }
    }
  }, [selectedSeason, sessionId]);

  // Create a flight lock when selecting flight
  const createFlightLock = useCallback(async (flightId: string, quantity: number) => {
    if (!selectedSeason) return;
    try {
      const result = await api.createBookingLock({
        resource_type: 'flight_seat',
        flight_id: flightId,
        season_id: selectedSeason,
        quantity,
        session_id: sessionId
      });
      setLockExpiresAt(new Date(result.expires_at));
      console.log('Flight lock created:', result);
    } catch (error) {
      console.error('Error creating flight lock:', error);
    }
  }, [selectedSeason, sessionId]);

  // Release all locks for this session
  const releaseAllLocks = useCallback(async () => {
    try {
      await api.releaseAllBookingLocks(sessionId);
      setActiveLocks([]);
      setLockExpiresAt(null);
    } catch (error) {
      console.error('Error releasing locks:', error);
    }
  }, [sessionId]);

  // Extend locks periodically
  const extendLocks = useCallback(async () => {
    try {
      const result = await api.extendBookingLocks(sessionId);
      if (result.expires_at) {
        setLockExpiresAt(new Date(result.expires_at));
      }
    } catch (error) {
      console.error('Error extending locks:', error);
    }
  }, [sessionId]);

  // Check for other agents' locks on the same resources
  const checkOtherAgentLocks = useCallback(async () => {
    if (!selectedSeason) return;
    
    try {
      const params: any = {
        season_id: selectedSeason,
        exclude_session_id: sessionId
      };
      
      if (selectedAccommodationId && selectedRoomType) {
        params.resource_type = 'bed';
        params.accommodation_id = selectedAccommodationId;
        params.room_type_id = selectedRoomType;
      }
      
      const locks = await api.getActiveBookingLocks(params);
      setOtherAgentLocks(locks || []);
    } catch (error) {
      console.error('Error checking other agent locks:', error);
    }
  }, [selectedSeason, selectedAccommodationId, selectedRoomType, sessionId]);

  // Effect: Create locks when accommodation/room type is selected
  useEffect(() => {
    if (sameSelectionForAll && selectedAccommodationId && selectedRoomType && selectedSeason && pilgrims.length > 0) {
      createBedLock(selectedAccommodationId, selectedRoomType, pilgrims.length);
    }
  }, [sameSelectionForAll, selectedAccommodationId, selectedRoomType, selectedSeason, pilgrims.length, createBedLock]);

  // Effect: Create flight lock when flight is selected
  useEffect(() => {
    if (selectedFlight && selectedSeason && pilgrims.length > 0) {
      createFlightLock(selectedFlight, pilgrims.length);
    }
  }, [selectedFlight, selectedSeason, pilgrims.length, createFlightLock]);

  // Effect: Check for other agents' locks periodically
  useEffect(() => {
    if (selectedSeason && (selectedAccommodationId || selectedFlight)) {
      checkOtherAgentLocks();
      const interval = setInterval(checkOtherAgentLocks, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [selectedSeason, selectedAccommodationId, selectedRoomType, selectedFlight, checkOtherAgentLocks]);

  // Periodic refetch of inventory when on Flight or Accommodation steps - keeps seat/bed counts fresh after bookings
  useEffect(() => {
    if (active !== 2 && active !== 3) return;
    const refetch = () => {
      if (active === 2 && selectedSeason) loadAvailableFlightInventory(selectedSeason);
      if (active === 3 && selectedSeason) {
        api.getHotelInventory({ season_id: selectedSeason })
          .then((data: any) => setAllSeasonInventory(data || []))
          .catch(() => {});
      }
    };
    const interval = setInterval(refetch, 15000); // Refetch every 15 seconds
    return () => clearInterval(interval);
  }, [active, selectedSeason]);

  // Effect: Extend locks periodically (every 5 minutes)
  useEffect(() => {
    if (lockExpiresAt) {
      lockRefreshInterval.current = setInterval(extendLocks, 5 * 60 * 1000);
      return () => {
        if (lockRefreshInterval.current) {
          clearInterval(lockRefreshInterval.current);
        }
      };
    }
  }, [lockExpiresAt, extendLocks]);

  // Effect: Release locks when leaving the wizard
  useEffect(() => {
    return () => {
      // Release locks on unmount
      releaseAllLocks();
    };
  }, [releaseAllLocks]);

  const searchClients = async () => {
    try {
      const data = await api.getClients(clientSearch);
      setClients(data);
    } catch (error) {
      console.error('Error searching clients:', error);
    }
  };

  const loadClientPilgrims = async (clientId: string) => {
    try {
      const data = await api.getPilgrims({ clientId });
      // Deduplicate by passport number (same person = same passport)
      // Keep the most recent entry (first in list since ordered by created_at desc)
      const uniquePilgrims = (data || []).reduce((acc: ExistingPilgrim[], pilgrim: ExistingPilgrim) => {
        const passportKey = pilgrim.passport_number?.trim().toLowerCase();
        // If no passport number, use id as fallback key
        const key = passportKey || pilgrim.id;
        if (!acc.find(p => {
          const pKey = p.passport_number?.trim().toLowerCase() || p.id;
          return pKey === key;
        })) {
          acc.push(pilgrim);
        }
        return acc;
      }, []);
      setClientPilgrims(uniquePilgrims);
    } catch (error) {
      console.error('Error loading client pilgrims:', error);
      setClientPilgrims([]);
    }
  };

  const loadSeasons = async () => {
    try {
      const data = await api.getSeasons();
      setSeasons(data);
    } catch (error) {
      console.error('Error loading seasons:', error);
    }
  };

  const loadFlights = async (seasonId: string) => {
    try {
      const data = await api.getFlights(seasonId);
      setFlights(data);
    } catch (error) {
      console.error('Error loading flights:', error);
    }
  };

  const loadAccommodations = async (seasonId: string) => {
    try {
      const data = await api.getAccommodations(seasonId);
      setAccommodations(data);
    } catch (error) {
      console.error('Error loading accommodations:', error);
    }
  };

  const loadServices = async () => {
    try {
      const data = await api.getServices({ active_only: true });
      setAvailableServices(data);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadAvailableDiscounts = async () => {
    try {
      const data = await api.getAvailableDiscounts();
      setAvailableDiscounts(data);
    } catch (error) {
      console.error('Error loading discounts:', error);
    }
  };

  const handleDiscountSelect = async (discountId: string | null) => {
    setSelectedDiscountId(discountId);
    if (!discountId) {
      setDiscount(0);
      return;
    }
    
    try {
      const result = await api.calculateDiscount(discountId, calculateTotal());
      if (result.error) {
        notifications.show({
          title: t('error') || 'خطأ',
          message: result.error,
          color: 'orange'
        });
        setDiscount(0);
        setSelectedDiscountId(null);
      } else {
        setDiscount(result.discount_amount);
      }
    } catch (error: any) {
      console.error('Error calculating discount:', error);
      setDiscount(0);
    }
  };

  const loadAvailableFlightInventory = async (seasonId: string) => {
    try {
      const data = await api.getAvailableSeats({ season_id: seasonId });
      setAvailableFlightInventory(data || []);
    } catch (error) {
      console.error('Error loading flight inventory:', error);
      setAvailableFlightInventory([]);
    }
  };

  // Pilgrim management
  const addPilgrim = () => {
    setPilgrims([...pilgrims, {
      full_name: '',
      full_name_ar: '',
      gender: '',
      date_of_birth: null,
      passport_number: '',
      phone: '',
      photo_url: null,
      passport_scan_url: null,
      email: '',
      relationship_type: 'family',
      is_mahram: false,
      is_booking_client: false,
      is_self_client: false,
      linked_client_id: undefined
    }]);
  };
  
  // Add pilgrim from selected client (copy client info)
  const addClientAsPilgrim = () => {
    if (selectedClient) {
      setPilgrims([...pilgrims, {
        full_name: selectedClient.full_name || '',
        full_name_ar: selectedClient.full_name_ar || '',
        gender: '',
        date_of_birth: null,
        passport_number: '',
        phone: selectedClient.phone || '',
        photo_url: null,
        passport_scan_url: null,
        email: '',
        relationship_type: 'family',
        is_mahram: false,
        is_booking_client: true,
        is_self_client: false,
        linked_client_id: selectedClient.id
      }]);
    }
  };

  // Add an existing pilgrim from client's pilgrim list
  const addExistingPilgrim = (existingPilgrim: ExistingPilgrim) => {
    // Check if this pilgrim is already added
    if (pilgrims.some(p => p.id === existingPilgrim.id)) {
      return;
    }
    setPilgrims([...pilgrims, {
      id: existingPilgrim.id,
      full_name: existingPilgrim.full_name || '',
      full_name_ar: existingPilgrim.full_name_ar || '',
      gender: existingPilgrim.gender || '',
      date_of_birth: null,
      passport_number: existingPilgrim.passport_number || '',
      phone: existingPilgrim.phone || '',
      photo_url: existingPilgrim.photo_url || null,
      passport_scan_url: existingPilgrim.passport_scan_url || null,
      email: '',
      relationship_type: 'family',
      is_mahram: false,
      is_booking_client: false,
      is_self_client: false,
      linked_client_id: selectedClient?.id
    }]);
  };

  // Get step description based on current selections
  const getStepDescription = (step: number): string => {
    switch (step) {
      case 0:
        if (selectedClient) {
          return selectedClient.full_name_ar || selectedClient.full_name;
        } else if (isNewClient && newClient.full_name) {
          return `${newClient.full_name_ar || newClient.full_name} (جديد)`;
        }
        return '';
      case 1:
        return pilgrims.length > 0 ? `${pilgrims.length} معتمر` : '';
      case 2:
        if (selectedSeason && selectedFlight) {
          const season = seasons.find(s => s.id === selectedSeason);
          const flight = flights.find(f => f.id === selectedFlight);
          return season?.name || '';
        }
        return '';
      case 3:
        if (sameSelectionForAll && selectedAccommodationId && selectedRoomType) {
          const combo = hotelRoomCombos.find(c => c.accommodationId === selectedAccommodationId && c.roomTypeId === selectedRoomType);
          const acc = combo?.accommodation || accommodations.find(a => a.id === selectedAccommodationId);
          const rt = combo?.roomType || roomTypes.find(r => r.id === selectedRoomType);
          return `${acc?.name_ar || acc?.name || ''} - ${t(rt?.type) || rt?.type || ''}`;
        }
        if (!sameSelectionForAll && pilgrims.some((_, i) => pilgrimRoomSelections[i]?.roomTypeId)) {
          return `${pilgrims.filter((_, i) => pilgrimRoomSelections[i]?.roomTypeId).length} ${t('pilgrims') || 'معتمر'}`;
        }
        return '';
      case 4:
        return selectedServices.length > 0 ? `${selectedServices.length} خدمة` : '';
      case 5:
        return calculateTotal() > 0 ? `${calculateTotal().toLocaleString('en')} د.م` : '';
      default:
        return '';
    }
  };

  const removePilgrim = (index: number) => {
    setPilgrims(pilgrims.filter((_, i) => i !== index));
    const next: Record<number, string> = {};
    const nextRoom: Record<number, { accommodationId: string; roomTypeId: string; inventoryId: string; inventories: any[] }> = {};
    const nextCol1: Record<number, string | null> = {};
    const nextCol2: Record<number, string | null> = {};
    pilgrims.forEach((_, i) => {
      if (i < index) {
        if (pilgrimFlightSelections[i]) next[i] = pilgrimFlightSelections[i];
        if (pilgrimRoomSelections[i]) nextRoom[i] = pilgrimRoomSelections[i];
        if (pilgrimCol1Hotel[i] != null) nextCol1[i] = pilgrimCol1Hotel[i];
        if (pilgrimCol2Type[i] != null) nextCol2[i] = pilgrimCol2Type[i];
      } else if (i > index) {
        if (pilgrimFlightSelections[i]) next[i - 1] = pilgrimFlightSelections[i];
        if (pilgrimRoomSelections[i]) nextRoom[i - 1] = pilgrimRoomSelections[i];
        if (pilgrimCol1Hotel[i] != null) nextCol1[i - 1] = pilgrimCol1Hotel[i];
        if (pilgrimCol2Type[i] != null) nextCol2[i - 1] = pilgrimCol2Type[i];
      }
    });
    setPilgrimFlightSelections(next);
    setPilgrimRoomSelections(nextRoom);
    setPilgrimCol1Hotel(nextCol1);
    setPilgrimCol2Type(nextCol2);
  };

  const updatePilgrim = (index: number, field: keyof PilgrimForm, value: any) => {
    const updated = [...pilgrims];
    (updated[index] as any)[field] = value;
    setPilgrims(updated);
  };

  // Service management
  const toggleService = (service: any) => {
    const existing = selectedServices.find(s => s.service_id === service.id);
    if (existing) {
      setSelectedServices(selectedServices.filter(s => s.service_id !== service.id));
    } else {
      setSelectedServices([...selectedServices, {
        service_id: service.id,
        name: service.name_ar || service.name,
        price: service.price,
        quantity: 1,
        pilgrim_ids: [] // Apply to all pilgrims
      }]);
    }
  };

  // Calculate totals
  const getRoomPrice = () => {
    if (sameSelectionForAll) {
      const invs = getSameForAllInventories();
      if (invs.length > 0) {
        return pilgrims.length * invs.reduce((sum, inv) => sum + Number(inv?.sell_price_per_bed ?? inv?.sell_price ?? 0), 0);
      }
      const combo = hotelRoomCombos.find(c => c.roomTypeId === selectedRoomType);
      return pilgrims.length * (combo?.pricePerBed || 0);
    }
    let total = 0;
    pilgrims.forEach((_, i) => {
      const invs = getPilgrimInventories(i);
      invs.forEach((inv: any) => {
        const pricePerBed = inv?.sell_price_per_bed ?? inv?.sell_price;
        if (pricePerBed != null) total += Number(pricePerBed);
      });
    });
    return total;
  };

  const getFlightPrice = () => {
    if (sameSelectionForAll) {
      if (selectedFlightInventory) {
        const inventory = availableFlightInventory.find(inv => inv.id === selectedFlightInventory);
        if (inventory?.sell_price) return pilgrims.length * Number(inventory.sell_price);
      }
      return 0;
    }
    let total = 0;
    pilgrims.forEach((_, i) => {
      const invId = pilgrimFlightSelections[i];
      if (invId) {
        const inv = availableFlightInventory.find(a => a.id === invId);
        if (inv?.sell_price) total += Number(inv.sell_price);
      }
    });
    return total;
  };

  const calculatePackageTotal = () => {
    return getRoomPrice() + getFlightPrice();
  };

  const calculateServicesTotal = () => {
    return selectedServices.reduce((sum, s) => sum + (s.price * s.quantity * pilgrims.length), 0);
  };

  const calculateTotal = () => {
    return calculatePackageTotal() + calculateServicesTotal() - discount;
  };

  // Season period coverage for accommodation
  const selectedSeasonData = seasons.find(s => s.id === selectedSeason);
  const seasonStart = selectedSeasonData?.start_date ? new Date(selectedSeasonData.start_date) : null;
  const seasonEnd = selectedSeasonData?.end_date ? new Date(selectedSeasonData.end_date) : null;
  const seasonDays = seasonStart && seasonEnd ? Math.max(0, Math.ceil((seasonEnd.getTime() - seasonStart.getTime()) / (24 * 60 * 60 * 1000))) : 0;

  const inventoryCoversSeason = (inv: any) => {
    if (!seasonStart || !seasonEnd || !inv?.check_in_date || !inv?.check_out_date) return false;
    const ci = new Date(inv.check_in_date);
    const co = new Date(inv.check_out_date);
    return ci <= seasonStart && co >= seasonEnd;
  };

  // Merge date ranges and check if they cover the full season
  const inventoriesCoverSeason = (inventories: any[]): boolean => {
    if (!seasonStart || !seasonEnd || !inventories?.length) return false;
    const ranges = inventories
      .filter((inv: any) => inv?.check_in_date && inv?.check_out_date)
      .map((inv: any) => ({ start: new Date(inv.check_in_date).getTime(), end: new Date(inv.check_out_date).getTime() }))
      .sort((a: any, b: any) => a.start - b.start);
    if (ranges.length === 0) return false;
    const seasonStartMs = seasonStart.getTime();
    const seasonEndMs = seasonEnd.getTime();
    let coveredUntil = seasonStartMs;
    for (const r of ranges) {
      if (r.start > coveredUntil) return false; // gap
      coveredUntil = Math.max(coveredUntil, r.end);
      if (coveredUntil >= seasonEndMs) return true;
    }
    return coveredUntil >= seasonEndMs;
  };

  const getPilgrimInventories = (idx: number): any[] => {
    const s = pilgrimRoomSelections[idx];
    if (s?.inventories?.length) return s.inventories;
    if (s?.inventoryId) {
      const inv = accommodationInventory.find((a: any) => a.id === s.inventoryId) || allSeasonInventory.find((a: any) => a.id === s.inventoryId);
      return inv ? [inv] : [];
    }
    return [];
  };

  const getPilgrimCoverage = (idx: number): { covered: boolean; inventories: any[] } => {
    const invs = getPilgrimInventories(idx);
    return { covered: inventoriesCoverSeason(invs), inventories: invs };
  };

  const getSameForAllInventories = (): any[] => {
    if (selectedRoomInventories?.length) return selectedRoomInventories;
    if (selectedRoomInventory) {
      const inv = accommodationInventory.find((a: any) => a.id === selectedRoomInventory) || availableRoomInventory.find((a: any) => a.id === selectedRoomInventory) || allSeasonInventory.find((a: any) => a.id === selectedRoomInventory);
      return inv ? [inv] : [];
    }
    return [];
  };

  const getSameForAllCoverage = (): { covered: boolean; inventory: any; inventories: any[] } => {
    const invs = getSameForAllInventories();
    const cov = inventoriesCoverSeason(invs);
    return { covered: cov, inventory: invs[0] || null, inventories: invs };
  };

  const getNightsFromInventory = (inv: any): number => {
    if (!inv) return 0;
    if (inv.nights != null) return Number(inv.nights);
    if (!inv.check_in_date || !inv.check_out_date) return 0;
    return Math.max(0, Math.ceil((new Date(inv.check_out_date).getTime() - new Date(inv.check_in_date).getTime()) / (24 * 60 * 60 * 1000)));
  };

  const getTotalNightsForInventories = (invs: any[]): number =>
    invs.reduce((sum, inv) => sum + getNightsFromInventory(inv), 0);

  // Room type "type" for filtering batches across hotels (double, triple, etc.)
  const getBatchRoomTypeType = (): string | null => {
    const combo = hotelRoomCombos.find(c => c.roomTypeId === selectedRoomType);
    if (combo?.roomType?.type) return combo.roomType.type;
    const first = getSameForAllInventories()[0];
    return first?.room_types?.type || null;
  };

  // Unique hotel+room_type combos derived from all season inventory (no top dropdown)
  const getHotelRoomCombos = (): Array<{ accommodationId: string; accommodation: any; roomTypeId: string; roomType: any; bedsAvailable: number; pricePerBed: number }> => {
    const seen = new Set<string>();
    const result: Array<{ accommodationId: string; accommodation: any; roomTypeId: string; roomType: any; bedsAvailable: number; pricePerBed: number }> = [];
    for (const inv of allSeasonInventory) {
      const accId = inv.accommodation_id || inv.accommodations?.id;
      const rtId = inv.room_type_id || inv.room_types?.id;
      if (!accId || !rtId) continue;
      const key = `${accId}|${rtId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const invs = allSeasonInventory.filter((i: any) =>
        (i.accommodation_id || i.accommodations?.id) === accId &&
        (i.room_type_id || i.room_types?.id) === rtId
      );
      const bedsAvailable = invs.reduce((s: number, i: any) => s + (i.beds_available ?? i.available_beds ?? 0), 0);
      const firstWithPrice = invs.find((i: any) => (i.sell_price_per_bed ?? i.sell_price) != null);
      const pricePerBed = firstWithPrice ? Number(firstWithPrice.sell_price_per_bed ?? firstWithPrice.sell_price ?? 0) : 0;
      result.push({
        accommodationId: accId,
        accommodation: inv.accommodations,
        roomTypeId: rtId,
        roomType: inv.room_types,
        bedsAvailable,
        pricePerBed
      });
    }
    return result;
  };

  const hotelRoomCombos = getHotelRoomCombos();

  // Inventory batches for a room type (from allSeasonInventory - supports multi-hotel season coverage)
  const getMergedBatchesForRoomType = (roomTypeId: string | null, roomTypeType: string | null): any[] => {
    if (!roomTypeId && !roomTypeType) return [];
    const ids = new Set<string>();
    return allSeasonInventory.filter((inv: any) => {
      const match = inv.room_type_id === roomTypeId || inv.room_types?.type === roomTypeType;
      if (match && inv.id && !ids.has(inv.id)) { ids.add(inv.id); return true; }
      return false;
    });
  };

  // 3-column layout helpers: Hotel → Type → Inventory
  const getUniqueHotels = (): Array<{ id: string; name: string; name_ar?: string; city?: string }> => {
    const seen = new Set<string>();
    const result: Array<{ id: string; name: string; name_ar?: string; city?: string }> = [];
    for (const inv of allSeasonInventory) {
      const accId = inv.accommodation_id || inv.accommodations?.id;
      if (!accId || seen.has(accId)) continue;
      seen.add(accId);
      const acc = inv.accommodations || {};
      result.push({
        id: accId,
        name: acc.name || t('hotel') || 'Hotel',
        name_ar: acc.name_ar,
        city: acc.city
      });
    }
    return result;
  };

  const getTypesForHotel = (accommodationId: string | null): Array<{ id: string; type: string; bedsAvailable: number; pricePerBed: number }> => {
    if (!accommodationId) return [];
    return hotelRoomCombos
      .filter(c => c.accommodationId === accommodationId)
      .map(c => ({ id: c.roomTypeId, type: c.roomType?.type || '', bedsAvailable: c.bedsAvailable, pricePerBed: c.pricePerBed }));
  };

  const getInventoryForHotelAndType = (accommodationId: string | null, roomTypeId: string | null): any[] => {
    if (!accommodationId || !roomTypeId) return [];
    return allSeasonInventory.filter((inv: any) =>
      (inv.accommodation_id || inv.accommodations?.id) === accommodationId &&
      (inv.room_type_id || inv.room_types?.id) === roomTypeId
    );
  };

  // Create booking
  const handleCreateBooking = async () => {
    const missingPassport = pilgrims.find(p => !(p.passport_number || '').trim());
    if (missingPassport) {
      alert(t('passport_required_for_all_pilgrims') || 'رقم الجواز إلزامي لجميع المعتمرين. يرجى إدخال رقم الجواز لكل معتمر.');
      return;
    }
    setLoading(true);
    try {
      let clientId = selectedClient?.id;

      // Create client if new
      if (isNewClient && !selectedClient) {
        const client = await api.createClient(newClient);
        clientId = client.id;
      }

      if (!clientId) {
        alert(t('please_select_client') || 'يرجى اختيار أو إنشاء عميل');
        setLoading(false);
        return;
      }

      // Create clients for pilgrims marked as is_self_client
      const pilgrimsWithClientIds = await Promise.all(
        pilgrims.map(async (p) => {
          let pilgrimClientId = p.linked_client_id;
          
          if (p.is_self_client && !p.is_booking_client) {
            // Create new client for this pilgrim
            try {
              const newPilgrimClient = await api.createClient({
                full_name: p.full_name,
                full_name_ar: p.full_name_ar,
                phone: p.phone,
                email: p.email || undefined
              });
              pilgrimClientId = newPilgrimClient.id;
            } catch (err) {
              console.error('Failed to create client for pilgrim:', err);
            }
          }
          
          return {
            ...p,
            client_id: pilgrimClientId
          };
        })
      );

      const flightInvId = sameSelectionForAll ? selectedFlightInventory : pilgrimFlightSelections[0];
      const sameForAllInvs = getSameForAllInventories();
      const firstPilgrimInvs = getPilgrimInventories(0);
      const roomTypeId = sameSelectionForAll ? selectedRoomType : (firstPilgrimInvs[0]?.room_type_id || firstPilgrimInvs[0]?.room_types?.id || pilgrimRoomSelections[0]?.roomTypeId);
      const primaryAccommodation = sameForAllInvs[0]?.accommodation_id || sameForAllInvs[0]?.accommodations?.id || selectedAccommodationId || firstPilgrimInvs[0]?.accommodation_id || firstPilgrimInvs[0]?.accommodations?.id || pilgrimRoomSelections[0]?.accommodationId;

      const bookingData = {
        client_id: clientId,
        season_id: selectedSeason,
        flight_id: selectedFlight,
        flight_seat_inventory_id: flightInvId || undefined,
        accommodation_id: primaryAccommodation,
        room_type_id: roomTypeId || undefined,
        hotel_inventory_ids: sameSelectionForAll ? sameForAllInvs.map((i: any) => i.id) : undefined,
        same_selection_for_all: sameSelectionForAll,
        notes,
        pilgrims: pilgrimsWithClientIds.map((p, idx) => ({
          full_name: p.full_name,
          full_name_ar: p.full_name_ar,
          gender: p.gender,
          date_of_birth: p.date_of_birth,
          passport_number: p.passport_number,
          phone: p.phone,
          photo_url: p.photo_url || undefined,
          passport_scan_url: p.passport_scan_url || undefined,
          spouse_index: p.spouse_index,
          parent_index: p.parent_index,
          relationship_type: p.relationship_type || 'family',
          is_mahram: p.is_mahram || false,
          client_id: p.client_id,
          ...(!sameSelectionForAll && (() => {
            const invs = getPilgrimInventories(idx);
            const firstInv = invs[0];
            return {
              flight_seat_inventory_id: pilgrimFlightSelections[idx] || undefined,
              room_type_id: firstInv?.room_type_id || firstInv?.room_types?.id || pilgrimRoomSelections[idx]?.roomTypeId || undefined,
              hotel_inventory_ids: invs.map((i: any) => i.id)
            };
          })())
        })),
        extra_services: selectedServices.map(s => ({
          service_id: s.service_id,
          quantity: s.quantity,
          pilgrim_ids: s.pilgrim_ids
        }))
      };

      const booking = await api.createBooking(bookingData);
      setCreatedBooking(booking);

      // Add discount as invoice item if any
      if (discount > 0) {
        const selectedDiscount = availableDiscounts.find((d: any) => d.id === selectedDiscountId);
        await api.addInvoiceItem(booking.id, {
          item_type: 'discount',
          description: selectedDiscount?.name_ar || selectedDiscount?.name || 'خصم',
          quantity: 1,
          unit_price: -discount
        });

        // Log discount usage for tracking
        if (selectedDiscountId) {
          try {
            await api.logDiscountUsage({
              booking_id: booking.id,
              discount_setting_id: selectedDiscountId,
              discount_amount: discount,
              booking_total_before: calculateTotal()
            });
          } catch (e) {
            console.error('Failed to log discount usage:', e);
          }
        }
      }

      setActive(6); // Move to payment step
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Confirm and pay
  const handleConfirmAndPay = async () => {
    if (!createdBooking) return;
    setLoading(true);
    try {
      // Confirm booking
      await api.confirmBooking(createdBooking.id);

      // Add payment if amount > 0
      if (paymentAmount > 0) {
        await api.createBookingPayment(createdBooking.id, {
          amount: paymentAmount,
          payment_method: paymentMethod
        });
      }

      setActive(7); // Move to room allocation
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-allocate rooms
  const handleAllocateRooms = async () => {
    if (!createdBooking) return;
    setLoading(true);
    try {
      const result = await api.allocateRooms(createdBooking.id);
      if (result.warnings?.length > 0) {
        alert('تحذيرات: ' + result.warnings.join('\n'));
      }
      navigate(`/bookings/${createdBooking.id}`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    // When moving from Step 0 (Client) to Step 1 (Pilgrims)
    // Auto-add the new client as a pilgrim if the option is checked
    if (active === 0 && isNewClient && addNewClientAsPilgrim && newClient.full_name) {
      // Check if client is not already added as a pilgrim
      const alreadyAdded = pilgrims.some(p => 
        p.full_name === newClient.full_name && p.phone === newClient.phone
      );
      
      if (!alreadyAdded) {
        setPilgrims([{
          full_name: newClient.full_name,
          full_name_ar: newClient.full_name_ar || '',
          gender: '',
          date_of_birth: null,
          passport_number: '',
          phone: newClient.phone,
          photo_url: null,
          passport_scan_url: null,
          email: newClient.email || '',
          relationship_type: 'family',
          is_mahram: false,
          is_booking_client: true, // Mark as the booking client
          is_self_client: false,
          linked_client_id: undefined
        }, ...pilgrims]);
      }
    }
    
    setActive((current) => (current < 7 ? current + 1 : current));
  };
  const prevStep = () => setActive((current) => (current > 0 ? current - 1 : current));

  const canProceed = () => {
    switch (active) {
      case 0: return selectedClient || (isNewClient && newClient.full_name && newClient.phone);
      case 1: return pilgrims.length > 0 && pilgrims.every(p => p.full_name && p.gender && (p.passport_number || '').trim());
      case 2: {
        if (!selectedSeason || !selectedFlight) return false;
        const hasAvailableSeats = availableFlightInventory.some(
          inv => inv.flight_id === selectedFlight && inv.available_seats > 0
        );
        if (!hasAvailableSeats) return false;
        if (sameSelectionForAll) return !!selectedFlightInventory;
        return pilgrims.every((_, i) => !!pilgrimFlightSelections[i]);
      }
      case 3: {
        if (!seasonStart || !seasonEnd) return false;
        if (sameSelectionForAll) {
          if (!selectedAccommodationId || !selectedRoomType) return false;
          const invs = getSameForAllInventories();
          const cov = getSameForAllCoverage();
          return invs.length > 0 && cov.covered;
        }
        return pilgrims.every((_, i) => {
          const cov = getPilgrimCoverage(i);
          return cov.inventories.length > 0 && cov.covered;
        });
      }
      case 4: return true; // Services are optional
      case 5: return true; // Ready to create booking
      case 6: return true; // Ready to confirm
      default: return true;
    }
  };

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>{t('new_booking') || 'حجز جديد'}</Title>
        <Button variant="subtle" onClick={() => navigate('/bookings')}>
          {t('cancel')}
        </Button>
      </Group>

      <Paper p="xl" radius="lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFD0' }} pos="relative">
        <LoadingOverlay visible={loading} />
        
        <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false} size="sm" mb="xl">
          <Stepper.Step 
            label="العميل" 
            icon={<User size={18} />} 
            description={getStepDescription(0)}
          />
          <Stepper.Step 
            label="المعتمرين" 
            icon={<Users size={18} />} 
            description={getStepDescription(1)}
          />
          <Stepper.Step 
            label="الرحلة" 
            icon={<Plane size={18} />} 
            description={getStepDescription(2)}
          />
          <Stepper.Step 
            label="السكن" 
            icon={<Building2 size={18} />} 
            description={getStepDescription(3)}
          />
          <Stepper.Step 
            label="الخدمات" 
            icon={<Plus size={18} />} 
            description={getStepDescription(4)}
          />
          <Stepper.Step 
            label="الفاتورة" 
            icon={<CreditCard size={18} />} 
            description={getStepDescription(5)}
          />
          <Stepper.Step label="الدفع" icon={<CreditCard size={18} />} />
          <Stepper.Step label="الغرف" icon={<BedDouble size={18} />} />
        </Stepper>

        {/* Step 1: Client Selection */}
        {active === 0 && (
          <Stack>
            <Radio.Group
              value={isNewClient ? 'new' : 'existing'}
              onChange={(v) => {
                setIsNewClient(v === 'new');
                if (v === 'new') {
                  setSelectedClient(null);
                  setClientPilgrims([]);
                }
              }}
            >
              <Group>
                <Radio value="existing" label="عميل موجود" />
                <Radio value="new" label="عميل جديد" />
              </Group>
            </Radio.Group>

            {!isNewClient ? (
              <Stack>
                <TextInput
                  placeholder="ابحث بالاسم أو رقم الهاتف..."
                  leftSection={<Search size={18} />}
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.currentTarget.value)}
                />
                <ScrollArea h={200}>
                  <Stack gap="xs">
                    {clients.map((client) => (
                      <Card
                        key={client.id}
                        p="sm"
                        radius="md"
                        withBorder
                        style={{
                          cursor: 'pointer',
                          borderColor: selectedClient?.id === client.id ? '#8B7355' : undefined,
                          backgroundColor: selectedClient?.id === client.id ? '#F5EFE6' : undefined
                        }}
                        onClick={() => setSelectedClient(client)}
                      >
                        <Group justify="space-between">
                          <div>
                            <Text fw={500}>{client.full_name_ar || client.full_name}</Text>
                            <Text size="sm" c="dimmed">{client.phone}</Text>
                          </div>
                          {selectedClient?.id === client.id && (
                            <ThemeIcon color="green" variant="light">
                              <CheckCircle size={16} />
                            </ThemeIcon>
                          )}
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                </ScrollArea>

                {/* Show selected client info and their pilgrims */}
                {selectedClient && (
                  <Card withBorder p="md" mt="md" style={{ backgroundColor: '#F5EFE6' }}>
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" c="dimmed">{t('selected_client') || 'العميل المختار'}</Text>
                          <Text fw={600} size="lg">{selectedClient.full_name_ar || selectedClient.full_name}</Text>
                          <Text size="sm" c="dimmed">{selectedClient.phone}</Text>
                        </div>
                        <ThemeIcon color="green" size="lg" radius="xl">
                          <CheckCircle size={20} />
                        </ThemeIcon>
                      </Group>

                      {/* Client's existing pilgrims */}
                      {clientPilgrims.length > 0 && (
                        <>
                          <Divider label={t('client_pilgrims') || 'المعتمرين المرتبطين بهذا العميل'} labelPosition="center" />
                          <SimpleGrid cols={2}>
                            {clientPilgrims.map((p) => (
                              <Card key={p.id} p="xs" withBorder radius="sm" style={{ backgroundColor: '#fff' }}>
                                <Group justify="space-between">
                                  <div>
                                    <Text size="sm" fw={500}>{p.full_name_ar || p.full_name}</Text>
                                    <Group gap="xs">
                                      <Badge size="xs" color={p.gender === 'male' ? 'blue' : 'pink'}>
                                        {p.gender === 'male' ? 'ذكر' : 'أنثى'}
                                      </Badge>
                                      {p.bookings && (
                                        <Badge size="xs" color="gray" variant="light">
                                          {p.bookings.booking_number}
                                        </Badge>
                                      )}
                                    </Group>
                                  </div>
                                </Group>
                              </Card>
                            ))}
                          </SimpleGrid>
                          <Text size="xs" c="dimmed" ta="center">
                            {t('pilgrims_can_be_added_in_next_step') || 'يمكنك إضافة هؤلاء المعتمرين في الخطوة التالية'}
                          </Text>
                        </>
                      )}
                    </Stack>
                  </Card>
                )}
              </Stack>
            ) : (
              <Stack gap="md">
                <SimpleGrid cols={2}>
                  <TextInput
                    label="الاسم الكامل (الاسم واللقب)"
                    placeholder="مثال: Ahmed Ben Ali"
                    description="أدخل الاسم الأول واللقب معاً"
                    value={newClient.full_name}
                    onChange={(e) => setNewClient({ ...newClient, full_name: e.currentTarget.value })}
                    required
                  />
                  <TextInput
                    label="الاسم الكامل بالعربية"
                    placeholder="مثال: أحمد بن علي"
                    description="أدخل الاسم الأول واللقب بالعربية"
                    value={newClient.full_name_ar}
                    onChange={(e) => setNewClient({ ...newClient, full_name_ar: e.currentTarget.value })}
                    dir="rtl"
                  />
                  <TextInput
                    label="الهاتف"
                    placeholder="+212 6XX XXX XXX"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.currentTarget.value })}
                    required
                  />
                  <TextInput
                    label="البريد الإلكتروني"
                    placeholder="email@example.com"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.currentTarget.value })}
                  />
                </SimpleGrid>
                
                {/* Option to add the client as a pilgrim too */}
                <Card withBorder p="md" style={{ backgroundColor: '#f0fdf4', borderColor: '#86efac' }}>
                  <Switch
                    label={t('add_client_as_pilgrim_too') || 'إضافة العميل كمعتمر أيضاً'}
                    description={t('add_client_as_pilgrim_desc') || 'سيتم إضافة هذا العميل تلقائياً كأول معتمر في الحجز'}
                    checked={addNewClientAsPilgrim}
                    onChange={(e) => setAddNewClientAsPilgrim(e.currentTarget.checked)}
                    color="green"
                    size="md"
                  />
                </Card>
              </Stack>
            )}
          </Stack>
        )}

        {/* Step 2: Pilgrims */}
        {active === 1 && (
          <Stack>
            <Group justify="space-between">
              <Text fw={500}>{t('pilgrims') || 'المعتمرين'} ({pilgrims.length})</Text>
              <Group>
                {selectedClient && !pilgrims.some(p => p.is_booking_client) && (
                  <Button 
                    leftSection={<User size={16} />} 
                    size="sm" 
                    variant="light"
                    color="green"
                    onClick={addClientAsPilgrim}
                  >
                    {t('add_client_as_pilgrim') || 'إضافة العميل كمعتمر'}
                  </Button>
                )}
                <Button leftSection={<Plus size={16} />} size="sm" onClick={addPilgrim}>
                  {t('add_pilgrim') || 'إضافة معتمر'}
                </Button>
              </Group>
            </Group>

            {/* Existing pilgrims from client */}
            {clientPilgrims.length > 0 && (
              <Card withBorder p="md" style={{ backgroundColor: '#f9f9f9' }}>
                <Text fw={500} mb="sm">{t('existing_client_pilgrims') || 'المعتمرين المسجلين لهذا العميل'}</Text>
                <SimpleGrid cols={3}>
                  {clientPilgrims.map((p) => {
                    const isAdded = pilgrims.some(pilgrim => pilgrim.id === p.id);
                    return (
                      <Card 
                        key={p.id} 
                        p="sm" 
                        withBorder 
                        radius="sm"
                        style={{ 
                          cursor: isAdded ? 'default' : 'pointer',
                          opacity: isAdded ? 0.6 : 1,
                          backgroundColor: isAdded ? '#e8f5e9' : '#fff'
                        }}
                        onClick={() => !isAdded && addExistingPilgrim(p)}
                      >
                        <Group justify="space-between">
                          <div>
                            <Text size="sm" fw={500}>{p.full_name_ar || p.full_name}</Text>
                            <Group gap="xs">
                              <Badge size="xs" color={p.gender === 'male' ? 'blue' : 'pink'}>
                                {p.gender === 'male' ? 'ذكر' : 'أنثى'}
                              </Badge>
                            </Group>
                          </div>
                          {isAdded ? (
                            <ThemeIcon color="green" size="sm" radius="xl">
                              <CheckCircle size={14} />
                            </ThemeIcon>
                          ) : (
                            <ActionIcon variant="light" color="blue" size="sm">
                              <Plus size={14} />
                            </ActionIcon>
                          )}
                        </Group>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </Card>
            )}

            {pilgrims.length === 0 && (
              <Alert color="yellow" icon={<AlertCircle size={18} />}>
                {t('add_at_least_one_pilgrim') || 'يرجى إضافة معتمر واحد على الأقل'}
              </Alert>
            )}

            <Stack gap="md">
              {pilgrims.map((pilgrim, index) => (
                <Card key={index} withBorder p="md" radius="md" style={{
                  borderColor: pilgrim.is_booking_client ? '#4caf50' : pilgrim.is_self_client ? '#2196f3' : undefined,
                  borderWidth: pilgrim.is_booking_client || pilgrim.is_self_client ? 2 : 1
                }}>
                  <Group justify="space-between" mb="sm">
                    <Group>
                      <Badge>{t('pilgrim') || 'معتمر'} {index + 1}</Badge>
                      {pilgrim.is_booking_client && (
                        <Badge color="green" variant="light">{t('is_booking_client') || 'العميل الحاجز'}</Badge>
                      )}
                      {pilgrim.is_self_client && (
                        <Badge color="blue" variant="light">{t('will_create_client') || 'سيتم إنشاء كعميل'}</Badge>
                      )}
                    </Group>
                    <ActionIcon color="red" variant="subtle" onClick={() => removePilgrim(index)}>
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>
                  
                  {/* Client linking options */}
                  {!pilgrim.is_booking_client && (
                    <Group mb="md">
                      <Checkbox
                        label={t('create_as_client') || 'إنشاء هذا المعتمر كعميل جديد'}
                        checked={pilgrim.is_self_client}
                        onChange={(e) => updatePilgrim(index, 'is_self_client', e.currentTarget.checked)}
                        description={t('create_as_client_desc') || 'سيتم إضافة هذا المعتمر إلى قائمة العملاء'}
                      />
                    </Group>
                  )}
                  
                  <SimpleGrid cols={3}>
                    <TextInput
                      label={t('full_name') || 'الاسم الكامل (الاسم واللقب)'}
                      placeholder="مثال: Ahmed Ben Ali"
                      description="الاسم الأول + اللقب"
                      value={pilgrim.full_name}
                      onChange={(e) => updatePilgrim(index, 'full_name', e.currentTarget.value)}
                      required
                    />
                    <TextInput
                      label={t('full_name_ar') || 'الاسم الكامل بالعربية'}
                      placeholder="مثال: أحمد بن علي"
                      description="الاسم الأول + اللقب بالعربية"
                      value={pilgrim.full_name_ar}
                      onChange={(e) => updatePilgrim(index, 'full_name_ar', e.currentTarget.value)}
                      dir="rtl"
                    />
                    <Select
                      label={t('gender') || 'الجنس'}
                      data={[
                        { value: 'male', label: t('male') || 'ذكر' },
                        { value: 'female', label: t('female') || 'أنثى' }
                      ]}
                      value={pilgrim.gender}
                      onChange={(v) => updatePilgrim(index, 'gender', v)}
                      required
                    />
                    <TextInput
                      label={t('passport_number') || 'رقم الجواز'}
                      placeholder="Passport Number"
                      value={pilgrim.passport_number}
                      onChange={(e) => updatePilgrim(index, 'passport_number', e.currentTarget.value)}
                      required
                    />
                    <TextInput
                      label={t('phone') || 'الهاتف'}
                      placeholder="Phone"
                      value={pilgrim.phone}
                      onChange={(e) => updatePilgrim(index, 'phone', e.currentTarget.value)}
                    />
                    <div>
                      <Text size="sm" fw={500} mb={4}>{t('pilgrim_photo') || 'صورة المعتمر'}</Text>
                      <Text size="xs" c="dimmed" mb={4}>{t('optional') || 'اختياري'}</Text>
                      <ImageUpload
                        folder="pilgrims"
                        value={pilgrim.photo_url}
                        onChange={(url) => updatePilgrim(index, 'photo_url', url)}
                        variant="avatar"
                        size={56}
                        placeholder={pilgrim.full_name_ar || pilgrim.full_name}
                      />
                    </div>
                    <div>
                      <Text size="sm" fw={500} mb={4}>{t('passport_scan') || 'نسخة جواز السفر'}</Text>
                      <Text size="xs" c="dimmed" mb={4}>{t('optional') || 'اختياري'}</Text>
                      <ImageUpload
                        folder="pilgrims"
                        value={pilgrim.passport_scan_url}
                        onChange={(url) => updatePilgrim(index, 'passport_scan_url', url)}
                        variant="default"
                        size={80}
                        placeholder={t('passport_scan_upload') || 'رفع صورة الجواز'}
                      />
                    </div>
                    {pilgrim.is_self_client && (
                      <TextInput
                        label={t('email') || 'البريد الإلكتروني'}
                        placeholder="email@example.com"
                        value={pilgrim.email || ''}
                        onChange={(e) => updatePilgrim(index, 'email', e.currentTarget.value)}
                      />
                    )}
                    {/* Relationship type - only show when more than 1 pilgrim */}
                    {pilgrims.length > 1 && (
                      <Select
                        label={t('relationship_type') || 'نوع العلاقة'}
                        data={[
                          { value: 'family', label: t('family') || 'عائلة' },
                          { value: 'married', label: t('married') || 'متزوجين' },
                          { value: 'friends', label: t('friends') || 'أصدقاء' }
                        ]}
                        value={pilgrim.relationship_type || 'family'}
                        onChange={(v) => updatePilgrim(index, 'relationship_type', v as 'family' | 'married' | 'friends')}
                        required
                      />
                    )}
                    {/* Mahram toggle and selection - only show when more than 1 pilgrim */}
                    {pilgrims.length > 1 && (
                      <Switch
                        label={t('is_mahram') || 'محرم'}
                        description={t('is_mahram_desc') || 'يمكن لهذا المعتمر مشاركة الغرفة مع الجنس الآخر (مثل الزوج/الزوجة، الأب/الأم)'}
                        checked={pilgrim.is_mahram || false}
                        onChange={(e) => {
                          updatePilgrim(index, 'is_mahram', e.currentTarget.checked);
                          // Clear mahram_with_index if unchecked
                          if (!e.currentTarget.checked) {
                            updatePilgrim(index, 'mahram_with_index', undefined);
                          }
                        }}
                      />
                    )}
                    {/* Mahram partner selection - only show when is_mahram is checked */}
                    {pilgrims.length > 1 && pilgrim.is_mahram && (
                      <Select
                        label={t('mahram_with') || 'محرم مع من؟'}
                        description={t('select_mahram_partner') || 'اختر المعتمر الذي يعتبر محرماً له'}
                        placeholder={t('select_pilgrim') || 'اختر المعتمر'}
                        data={pilgrims
                          .map((p, i) => ({ 
                            value: String(i), 
                            label: p.full_name_ar || p.full_name || `${t('pilgrim') || 'معتمر'} ${i + 1}`,
                            disabled: i === index // Can't select self
                          }))
                          .filter((_, i) => i !== index) // Remove self from list
                        }
                        value={pilgrim.mahram_with_index !== undefined ? String(pilgrim.mahram_with_index) : ''}
                        onChange={(v) => {
                          const selectedIndex = v ? parseInt(v) : undefined;
                          updatePilgrim(index, 'mahram_with_index', selectedIndex);
                          // Also update spouse_index for backward compatibility
                          updatePilgrim(index, 'spouse_index', selectedIndex);
                          // Auto-set the other pilgrim as mahram too (bidirectional)
                          if (selectedIndex !== undefined && !pilgrims[selectedIndex].is_mahram) {
                            updatePilgrim(selectedIndex, 'is_mahram', true);
                            updatePilgrim(selectedIndex, 'mahram_with_index', index);
                            updatePilgrim(selectedIndex, 'spouse_index', index);
                          }
                        }}
                        required
                        error={pilgrim.is_mahram && pilgrim.mahram_with_index === undefined ? t('select_mahram_required') || 'يجب اختيار المحرم' : undefined}
                      />
                    )}
                  </SimpleGrid>
                </Card>
              ))}
            </Stack>
          </Stack>
        )}

        {/* Step 3: Flight Selection */}
        {active === 2 && (
          <Stack>
            <Select
              label="الموسم"
              placeholder="اختر الموسم"
              data={seasons.map(s => ({ value: String(s.id || ''), label: `${s.name || ''} (${s.type || ''})` }))}
              value={selectedSeason || ''}
              onChange={(value) => setSelectedSeason(value || null)}
              required
            />

            {selectedSeason && (
              <>
                <Select
                  label="الرحلة"
                  placeholder="اختر الرحلة"
                  data={flights.map(f => ({ 
                    value: f.id, 
                    label: `${f.code} - ${f.departure_city} → ${f.arrival_city} (${new Date(f.departure_date).toLocaleDateString('en')})` 
                  }))}
                  value={selectedFlight || ''}
                  onChange={(v) => {
                    setSelectedFlight(v || null);
                    setSelectedFlightInventory(null);
                  }}
                  required
                />
                
                {selectedFlight && availableFlightInventory.length > 0 && (
                  <Stack gap="sm" mt="md">
                    <Group justify="space-between">
                      <Text fw={500} size="sm">{t('available_seats') || 'المقاعد المتاحة'}</Text>
                      <Switch
                        label={sameSelectionForAll ? (t('same_for_all_pilgrims') || 'نفس الخيار لجميع المعتمرين') : (t('different_per_pilgrim') || 'اختيار مختلف لكل معتمر')}
                        checked={sameSelectionForAll}
                        onChange={(e) => {
                          setSameSelectionForAll(e.currentTarget.checked);
                          if (e.currentTarget.checked) {
                            setPilgrimFlightSelections({});
                          } else if (selectedFlightInventory) {
                            const next: Record<number, string> = {};
                            pilgrims.forEach((_, i) => { next[i] = selectedFlightInventory; });
                            setPilgrimFlightSelections(next);
                          }
                        }}
                      />
                    </Group>
                    {sameSelectionForAll ? (
                    <>
                    <SimpleGrid cols={2}>
                      {availableFlightInventory
                        .filter(inv => inv.flight_id === selectedFlight && inv.available_seats > 0)
                        .map((inv) => {
                          const seatClass = inv.seat_class || 'economy';
                          const seatClassLabel = t(seatClass) || (seatClass === 'first_class' ? 'First Class' : seatClass === 'business' ? 'Business' : 'Economy');
                          return (
                          <Card
                            key={inv.id}
                            p="md"
                            radius="md"
                            withBorder
                            style={{
                              cursor: 'pointer',
                              borderColor: selectedFlightInventory === inv.id ? '#8B7355' : undefined,
                              backgroundColor: selectedFlightInventory === inv.id ? '#F5EFE6' : undefined
                            }}
                            onClick={() => setSelectedFlightInventory(inv.id)}
                          >
                            <Stack gap="xs">
                              <Group justify="space-between">
                                <Badge size="lg" variant="light" color="gray">{seatClassLabel}</Badge>
                                {selectedFlightInventory === inv.id && (
                                  <ThemeIcon color="green" variant="light" size="sm">
                                    <CheckCircle size={14} />
                                  </ThemeIcon>
                                )}
                              </Group>
                              <Text size="sm">{inv.available_seats} {t('seats') || 'مقعد'}</Text>
                              <Divider />
                              <Group justify="space-between">
                                <Text size="xs" c="dimmed">{t('sell_price') || 'سعر البيع'}</Text>
                                <Text fw={600} c="brown">{Number(inv.sell_price || 0).toLocaleString('en')} د.م</Text>
                              </Group>
                            </Stack>
                          </Card>
                          );
                        })}
                    </SimpleGrid>
                    {availableFlightInventory.filter(inv => inv.flight_id === selectedFlight && inv.available_seats > 0).length === 0 && (
                      <Alert color="yellow" mt="sm">
                        {t('no_seats_available') || 'لا توجد مقاعد متاحة في المخزون'}
                      </Alert>
                    )}
                    </>
                    ) : (
                    <Stack gap="md">
                      {pilgrims.map((p, idx) => {
                        const selectedInvId = pilgrimFlightSelections[idx];
                        return (
                          <Card key={idx} withBorder p="md" radius="md">
                            <Text size="sm" fw={500} mb="xs">{p.full_name_ar || p.full_name}</Text>
                            <SimpleGrid cols={2}>
                              {availableFlightInventory
                                .filter((inv: any) => inv.flight_id === selectedFlight && inv.available_seats > 0)
                                .map((inv: any) => {
                                  const seatClass = inv.seat_class || 'economy';
                                  const seatClassLabel = t(seatClass) || (seatClass === 'first_class' ? 'First Class' : seatClass === 'business' ? 'Business' : 'Economy');
                                  const isSelected = selectedInvId === inv.id;
                                  return (
                                    <Card
                                      key={inv.id}
                                      p="sm"
                                      radius="md"
                                      withBorder
                                      style={{
                                        cursor: 'pointer',
                                        borderColor: isSelected ? '#8B7355' : undefined,
                                        backgroundColor: isSelected ? '#F5EFE6' : undefined
                                      }}
                                      onClick={() => setPilgrimFlightSelections(prev => ({ ...prev, [idx]: inv.id }))}
                                    >
                                      <Group justify="space-between">
                                        <Badge size="sm" variant="light">{seatClassLabel}</Badge>
                                        {isSelected && <ThemeIcon color="green" size="xs"><CheckCircle size={12} /></ThemeIcon>}
                                      </Group>
                                      <Text size="xs">{inv.available_seats} {t('seats_available') || 'مقاعد متاحة'}</Text>
                                      <Text size="xs" fw={500} c="brown">{Number(inv.sell_price || 0).toLocaleString('en')} د.م {t('sell_price') || 'سعر البيع'}</Text>
                                    </Card>
                                  );
                                })}
                            </SimpleGrid>
                          </Card>
                        );
                      })}
                    </Stack>
                    )}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        )}

        {/* Step 4: Accommodation Selection - Hotel → Room Type → Beds per pilgrim (no top dropdown) */}
        {active === 3 && (
          <Stack>
            {hotelRoomCombos.length > 0 && (
              <Stack>
                <Group justify="space-between" wrap="wrap">
                  <Text fw={500}>{t('room_type') || 'نوع الغرفة'}</Text>
                  <Group gap="sm">
                    {lockExpiresAt && (
                      <Tooltip label={t('lock_expires_at') || `الحجز مؤقت حتى ${lockExpiresAt.toLocaleTimeString()}`}>
                        <Badge color="green" variant="light" leftSection={<Lock size={12} />}>
                          {t('reserved') || 'محجوز مؤقتاً'}
                        </Badge>
                      </Tooltip>
                    )}
                    <Badge color="blue">{pilgrims.length} {t('pilgrims') || 'معتمر'}</Badge>
                    <Switch
                      label={sameSelectionForAll ? (t('same_for_all_pilgrims') || 'نفس الخيار لجميع المعتمرين') : (t('different_per_pilgrim') || 'اختيار مختلف لكل معتمر')}
                      checked={sameSelectionForAll}
                      onChange={(e) => {
                        setSameSelectionForAll(e.currentTarget.checked);
                        if (e.currentTarget.checked) {
                          setPilgrimRoomSelections({});
                        } else if (selectedAccommodationId && selectedRoomType && getSameForAllInventories().length > 0) {
                          const invs = getSameForAllInventories();
                          const next: Record<number, { accommodationId: string; roomTypeId: string; inventoryId: string; inventories: any[] }> = {};
                          pilgrims.forEach((_, i) => { next[i] = { accommodationId: selectedAccommodationId, roomTypeId: selectedRoomType, inventoryId: '', inventories: [...invs] }; });
                          setPilgrimRoomSelections(next);
                          const col1: Record<number, string | null> = {};
                          const col2: Record<number, string | null> = {};
                          pilgrims.forEach((_, i) => { col1[i] = selectedAccommodationId; col2[i] = selectedRoomType; });
                          setPilgrimCol1Hotel(col1);
                          setPilgrimCol2Type(col2);
                        }
                      }}
                    />
                  </Group>
                </Group>
                
                {/* Warning about other agents' pending bookings */}
                {seasonStart && seasonEnd && (
                  <Paper withBorder p="md" radius="md" style={{ backgroundColor: '#faf9f7' }}>
                    <Text size="sm" fw={600} mb="xs">{t('season_period') || 'فترة الموسم'} — {t('full_coverage_required') || 'يجب تغطية الفترة كاملة'}</Text>
                    <Box mb="xs">
                      <Text size="xs" c="dimmed" mb={4}>
                        {seasonStart.toLocaleDateString()} — {seasonEnd.toLocaleDateString()} ({seasonDays} {t('days') || 'يوم'})
                      </Text>
                      {sameSelectionForAll ? (
                        <Box style={{ height: 28, borderRadius: 4, overflow: 'hidden', backgroundColor: 'var(--mantine-color-gray-2)', position: 'relative' }}>
                          {getSameForAllCoverage().inventories?.map((inv: any, i: number) => {
                            const ci = new Date(inv.check_in_date);
                            const co = new Date(inv.check_out_date);
                            const total = seasonEnd.getTime() - seasonStart.getTime();
                            const leftPct = Math.max(0, (ci.getTime() - seasonStart.getTime()) / total * 100);
                            const rightPct = Math.max(0, (seasonEnd.getTime() - co.getTime()) / total * 100);
                            const cov = getSameForAllCoverage().covered;
                            return (
                              <Box key={inv.id || i} style={{ position: 'absolute', left: `${leftPct}%`, right: `${rightPct}%`, top: 0, bottom: 0, backgroundColor: cov ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-orange-5)', borderRadius: 4, opacity: 0.9 }} />
                            );
                          })}
                        </Box>
                      ) : (
                        <Stack gap={8}>
                            {pilgrims.map((p, idx) => {
                              const cov = getPilgrimCoverage(idx);
                              return (
                                <Box key={idx}>
                                  <Text size="xs" c="dimmed" mb={2}>{p.full_name_ar || p.full_name}</Text>
                                  <Box style={{ height: 16, borderRadius: 4, overflow: 'hidden', backgroundColor: 'var(--mantine-color-gray-2)', position: 'relative' }}>
                                    {cov.inventories.length > 0 ? cov.inventories.map((inv: any, i: number) => {
                                      const ci = new Date(inv.check_in_date);
                                      const co = new Date(inv.check_out_date);
                                      const total = seasonEnd.getTime() - seasonStart.getTime();
                                      const leftPct = Math.max(0, (ci.getTime() - seasonStart.getTime()) / total * 100);
                                      const rightPct = Math.max(0, (seasonEnd.getTime() - co.getTime()) / total * 100);
                                      return <Box key={inv.id || i} style={{ position: 'absolute', left: `${leftPct}%`, right: `${rightPct}%`, top: 0, bottom: 0, backgroundColor: cov.covered ? 'var(--mantine-color-green-5)' : 'var(--mantine-color-orange-5)', borderRadius: 4, opacity: 0.9 }} />;
                                    }) : <Box style={{ width: '100%', height: '100%', backgroundColor: 'var(--mantine-color-gray-3)' }} />}
                                  </Box>
                                  {cov.inventories.length > 0 && !cov.covered && (
                                    <Text size="xs" c="orange" mt={2}>{t('selection_must_cover_full_season') || 'يجب اختيار دفعة تغطي فترة الموسم كاملة'}</Text>
                                  )}
                                </Box>
                              );
                            })}
                        </Stack>
                      )}
                      {sameSelectionForAll && getSameForAllInventories().length > 0 && !getSameForAllCoverage().covered && (
                        <Alert color="orange" variant="light" p="xs" mt="xs">
                          <Text size="xs">{t('selection_must_cover_full_season') || 'الدفعة المختارة لا تغطي فترة الموسم كاملة. اختر دفعة تغطي من'} {seasonStart.toLocaleDateString()} {t('to') || 'إلى'} {seasonEnd.toLocaleDateString()}</Text>
                        </Alert>
                      )}
                    </Box>
                  </Paper>
                )}

                {otherAgentLocks.length > 0 && (
                  <Alert 
                    color="orange" 
                    variant="light" 
                    icon={<Clock size={18} />}
                    title={t('other_agents_booking') || 'وكلاء آخرون يحجزون حالياً'}
                  >
                    <Stack gap="xs">
                      {otherAgentLocks.map((lock) => (
                        <Group key={lock.id} gap="sm">
                          <Badge color="orange" variant="filled" size="sm">
                            <Group gap={4}>
                              <User size={12} />
                              {lock.user_name || lock.user_email}
                            </Group>
                          </Badge>
                          <Text size="sm">
                            {t('booking_beds') || 'يحجز'} <strong>{lock.quantity}</strong> {t('beds') || 'أسرة'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            ({t('expires') || 'ينتهي'}: {new Date(lock.expires_at).toLocaleTimeString()})
                          </Text>
                        </Group>
                      ))}
                      <Text size="xs" c="dimmed" mt="xs">
                        {t('first_come_first_served') || 'الأسبقية لمن يكمل الحجز أولاً. قد لا تتوفر الأسرة المعروضة إذا أكمل وكيل آخر حجزه قبلك.'}
                      </Text>
                    </Stack>
                  </Alert>
                )}
                
                {sameSelectionForAll ? (
                <>
                {/* 3-column layout: Hotel → Type → Inventory */}
                <Text size="xs" c="dimmed" mb="xs">{t('add_batches_in_order') || 'اختر فندقًا ثم نوع الغرفة ثم أضف دفعة. يمكنك اختيار فندق آخر لإضافة دفعات إضافية لتغطية الموسم.'}</Text>
                {getSameForAllInventories().length > 0 && (
                  <Paper withBorder p="sm" radius="md" mb="md">
                    <Text size="xs" fw={600} mb="xs">{t('selected_batches') || 'الدفعات المختارة'}:</Text>
                    <Stack gap={4}>
                      {[...getSameForAllInventories()].sort((a: any, b: any) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime()).map((inv: any, pos: number) => (
                        <Group key={inv.id} justify="space-between" style={{ backgroundColor: 'var(--mantine-color-gray-0)', padding: '6px 10px', borderRadius: 4 }}>
                          <Group gap="sm">
                            <Badge size="xs" variant="outline">{t('batch')} {pos + 1}</Badge>
                            <Text size="xs">{inv.accommodations?.name_ar || inv.accommodations?.name || '-'}</Text>
                            <Badge size="xs" variant="light">{new Date(inv.check_in_date).toLocaleDateString()} — {new Date(inv.check_out_date).toLocaleDateString()}</Badge>
                            <Text size="xs" c="brown">{Number(inv.sell_price_per_bed ?? inv.sell_price ?? 0).toLocaleString('en')} د.م/{t('bed') || 'سرير'}</Text>
                          </Group>
                          <ActionIcon size="sm" color="red" variant="subtle" onClick={() => setSelectedRoomInventories(prev => prev.filter(x => x.id !== inv.id))}>
                            <Trash2 size={14} />
                          </ActionIcon>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                )}
                <SimpleGrid cols={3} style={{ alignItems: 'stretch' }}>
                  {/* Col 1: Hotels */}
                  <Paper withBorder p="md" radius="md" style={{ minHeight: 280 }}>
                    <Text fw={600} size="sm" mb="sm">{t('hotel') || 'الفندق'}</Text>
                    <ScrollArea h={220}>
                      <Stack gap={4}>
                        {getUniqueHotels().map((h) => {
                          const isSelected = selectedAccommodationId === h.id;
                          return (
                            <Card key={h.id} p="xs" radius="sm" withBorder style={{ cursor: 'pointer', borderColor: isSelected ? '#8B7355' : undefined, backgroundColor: isSelected ? '#F5EFE6' : undefined }}
                              onClick={() => { setSelectedAccommodationId(h.id); setSelectedRoomType(null); }}>
                              <Text size="sm" fw={isSelected ? 600 : 500}>{h.name_ar || h.name}</Text>
                              {h.city && <Text size="xs" c="dimmed">{h.city}</Text>}
                            </Card>
                          );
                        })}
                      </Stack>
                    </ScrollArea>
                  </Paper>
                  {/* Col 2: Room types for selected hotel */}
                  <Paper withBorder p="md" radius="md" style={{ minHeight: 280 }}>
                    <Text fw={600} size="sm" mb="sm">{t('room_type') || 'نوع الغرفة'}</Text>
                    <ScrollArea h={220}>
                      <Stack gap={4}>
                        {getTypesForHotel(selectedAccommodationId).map((rt) => {
                          const isSelected = selectedRoomType === rt.id;
                          const canSelect = rt.bedsAvailable >= pilgrims.length;
                          return (
                            <Card key={rt.id} p="xs" radius="sm" withBorder style={{ cursor: canSelect ? 'pointer' : 'not-allowed', borderColor: isSelected ? '#8B7355' : undefined, backgroundColor: isSelected ? '#F5EFE6' : undefined, opacity: canSelect ? 1 : 0.6 }}
                              onClick={() => canSelect && setSelectedRoomType(rt.id)}>
                              <Text size="sm" fw={isSelected ? 600 : 500}>{t(rt.type) || rt.type}</Text>
                              <Text size="xs" c="dimmed">{rt.bedsAvailable} {t('beds_available') || 'أسرة'}</Text>
                              <Text size="xs" fw={500} c="brown">{Number(rt.pricePerBed).toLocaleString('en')} د.م/{t('bed') || 'سرير'}</Text>
                            </Card>
                          );
                        })}
                        {selectedAccommodationId && getTypesForHotel(selectedAccommodationId).length === 0 && (
                          <Text size="xs" c="dimmed">{t('no_room_types') || 'لا أنواع غرف'}</Text>
                        )}
                        {!selectedAccommodationId && <Text size="xs" c="dimmed">{t('select_hotel_first') || 'اختر فندقًا أولاً'}</Text>}
                      </Stack>
                    </ScrollArea>
                  </Paper>
                  {/* Col 3: Inventory for selected hotel+type */}
                  <Paper withBorder p="md" radius="md" style={{ minHeight: 280 }}>
                    <Text fw={600} size="sm" mb="sm">{t('inventory') || 'المخزون'}</Text>
                    <ScrollArea h={220}>
                      <Stack gap={4}>
                        {getInventoryForHotelAndType(selectedAccommodationId, selectedRoomType).map((inv: any) => {
                          const bedsNeeded = pilgrims.length;
                          const avail = inv.beds_available || inv.available_beds || 0;
                          const canUse = avail >= bedsNeeded;
                          const alreadyAdded = getSameForAllInventories().some((x: any) => x.id === inv.id);
                          return (
                            <Card key={inv.id} p="xs" radius="sm" withBorder style={{ cursor: canUse && !alreadyAdded ? 'pointer' : 'default', borderColor: alreadyAdded ? 'var(--mantine-color-green-6)' : undefined, backgroundColor: alreadyAdded ? '#e8f5e9' : undefined, opacity: canUse || alreadyAdded ? 1 : 0.6 }}
                              onClick={() => canUse && !alreadyAdded && setSelectedRoomInventories(prev => [...prev, inv])}>
                              <Group justify="space-between">
                                <Text size="xs" fw={500}>{avail} {t('beds') || 'أسرة'}</Text>
                                {alreadyAdded && <ThemeIcon color="green" size="xs"><CheckCircle size={12} /></ThemeIcon>}
                              </Group>
                              <Text size="xs" c="dimmed">{new Date(inv.check_in_date).toLocaleDateString()} — {new Date(inv.check_out_date).toLocaleDateString()}</Text>
                              <Text size="xs" fw={500} c="brown">{Number(inv.sell_price_per_bed || inv.sell_price || 0).toLocaleString('en')} د.م/{t('bed') || 'سرير'}</Text>
                            </Card>
                          );
                        })}
                        {selectedAccommodationId && selectedRoomType && getInventoryForHotelAndType(selectedAccommodationId, selectedRoomType).length === 0 && (
                          <Text size="xs" c="dimmed">{t('no_inventory') || 'لا مخزون'}</Text>
                        )}
                        {(!selectedAccommodationId || !selectedRoomType) && <Text size="xs" c="dimmed">{t('select_hotel_and_type') || 'اختر فندق ونوع غرفة'}</Text>}
                      </Stack>
                    </ScrollArea>
                  </Paper>
                </SimpleGrid>
                </>
                ) : (
                <Stack gap="md" mt="md">
                  {pilgrims.map((p, idx) => {
                    const sel = pilgrimRoomSelections[idx];
                    const col1Hotel = pilgrimCol1Hotel[idx] ?? null;
                    const col2Type = pilgrimCol2Type[idx] ?? null;
                    const col1HotelSet = (hId: string | null) => setPilgrimCol1Hotel(prev => ({ ...prev, [idx]: hId }));
                    const col2TypeSet = (tId: string | null) => setPilgrimCol2Type(prev => ({ ...prev, [idx]: tId }));
                    const invs = getPilgrimInventories(idx);
                    const firstInv = invs[0];
                    const accIdForBackend = firstInv?.accommodation_id || firstInv?.accommodations?.id || col1Hotel || sel?.accommodationId;
                    const rtIdForBackend = firstInv?.room_type_id || firstInv?.room_types?.id || col2Type || sel?.roomTypeId;
                    return (
                      <Card key={idx} withBorder p="md" radius="md">
                        <Text size="sm" fw={500} mb="sm">{p.full_name_ar || p.full_name}</Text>
                        <Text size="xs" c="dimmed" mb="xs">{t('hotel') || 'الفندق'} → {t('room_type') || 'نوع الغرفة'} → {t('inventory') || 'المخزون'}</Text>
                        {invs.length > 0 && (
                          <Paper withBorder p="xs" radius="md" mb="md">
                            <Stack gap={4}>
                              {[...invs].sort((a: any, b: any) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime()).map((inv: any, pos: number) => (
                                <Group key={inv.id} justify="space-between" style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: 'var(--mantine-color-gray-0)' }}>
                                  <Group gap="xs">
                                    <Badge size="xs" variant="outline">{t('batch')} {pos + 1}</Badge>
                                    <Text size="xs">{inv.accommodations?.name_ar || inv.accommodations?.name || '-'} • {new Date(inv.check_in_date).toLocaleDateString()} — {new Date(inv.check_out_date).toLocaleDateString()}</Text>
                                  </Group>
                                  <ActionIcon size="xs" color="red" variant="subtle" onClick={() => setPilgrimRoomSelections(prev => ({ ...prev, [idx]: { accommodationId: accIdForBackend || '', roomTypeId: rtIdForBackend || '', inventoryId: '', inventories: (prev[idx]?.inventories || []).filter((x: any) => x.id !== inv.id) } }))}>
                                    <Trash2 size={12} />
                                  </ActionIcon>
                                </Group>
                              ))}
                            </Stack>
                          </Paper>
                        )}
                        <SimpleGrid cols={3} style={{ alignItems: 'stretch' }}>
                          {/* Col 1: Hotels */}
                          <Paper withBorder p="sm" radius="md" style={{ minHeight: 200 }}>
                            <Text fw={600} size="xs" mb="xs">{t('hotel') || 'الفندق'}</Text>
                            <ScrollArea h={160}>
                              <Stack gap={4}>
                                {getUniqueHotels().map((h) => {
                                  const isSelected = col1Hotel === h.id;
                                  return (
                                    <Card key={h.id} p="xs" radius="sm" withBorder style={{ cursor: 'pointer', borderColor: isSelected ? '#8B7355' : undefined, backgroundColor: isSelected ? '#F5EFE6' : undefined }}
                                      onClick={() => { col1HotelSet(h.id); col2TypeSet(null); }}>
                                      <Text size="xs" fw={isSelected ? 600 : 500}>{h.name_ar || h.name}</Text>
                                    </Card>
                                  );
                                })}
                              </Stack>
                            </ScrollArea>
                          </Paper>
                          {/* Col 2: Types for selected hotel */}
                          <Paper withBorder p="sm" radius="md" style={{ minHeight: 200 }}>
                            <Text fw={600} size="xs" mb="xs">{t('room_type') || 'نوع الغرفة'}</Text>
                            <ScrollArea h={160}>
                              <Stack gap={4}>
                                {getTypesForHotel(col1Hotel).map((rt) => {
                                  const isSelected = col2Type === rt.id;
                                  const canSelect = rt.bedsAvailable >= 1;
                                  return (
                                    <Card key={rt.id} p="xs" radius="sm" withBorder style={{ cursor: canSelect ? 'pointer' : 'not-allowed', borderColor: isSelected ? '#8B7355' : undefined, backgroundColor: isSelected ? '#F5EFE6' : undefined, opacity: canSelect ? 1 : 0.6 }}
                                      onClick={() => canSelect && col2TypeSet(rt.id)}>
                                      <Text size="xs" fw={isSelected ? 600 : 500}>{t(rt.type) || rt.type}</Text>
                                      <Text size="xs" c="dimmed">{rt.bedsAvailable} {t('beds') || 'أسرة'}</Text>
                                      <Text size="xs" fw={500} c="brown">{Number(rt.pricePerBed).toLocaleString('en')} د.م/{t('bed') || 'سرير'}</Text>
                                    </Card>
                                  );
                                })}
                                {col1Hotel && getTypesForHotel(col1Hotel).length === 0 && <Text size="xs" c="dimmed">{t('no_room_types') || 'لا أنواع'}</Text>}
                                {!col1Hotel && <Text size="xs" c="dimmed">{t('select_hotel_first') || 'اختر فندقًا'}</Text>}
                              </Stack>
                            </ScrollArea>
                          </Paper>
                          {/* Col 3: Inventory for selected hotel+type */}
                          <Paper withBorder p="sm" radius="md" style={{ minHeight: 200 }}>
                            <Text fw={600} size="xs" mb="xs">{t('inventory') || 'المخزون'}</Text>
                            <ScrollArea h={160}>
                              <Stack gap={4}>
                                {getInventoryForHotelAndType(col1Hotel, col2Type).map((inv: any) => {
                                  const avail = inv.beds_available || inv.available_beds || 0;
                                  const canUse = avail >= 1;
                                  const alreadyAdded = invs.some((x: any) => x.id === inv.id);
                                  return (
                                    <Card
                                      key={inv.id}
                                      p="xs"
                                      radius="sm"
                                      withBorder
                                      style={{ cursor: canUse && !alreadyAdded ? 'pointer' : 'default', borderColor: alreadyAdded ? 'var(--mantine-color-green-6)' : undefined, backgroundColor: alreadyAdded ? '#e8f5e9' : undefined, opacity: canUse || alreadyAdded ? 1 : 0.6 }}
                                      onClick={() => {
                                        if (canUse && !alreadyAdded && col1Hotel && col2Type) {
                                          setPilgrimRoomSelections(prev => ({ ...prev, [idx]: { accommodationId: col1Hotel, roomTypeId: col2Type, inventoryId: '', inventories: [...(prev[idx]?.inventories || []), inv] } }));
                                        }
                                      }}
                                    >
                                      <Group justify="space-between">
                                        <Text size="xs">{avail} {t('beds') || 'أسرة'}</Text>
                                        {alreadyAdded && <ThemeIcon color="green" size="xs"><CheckCircle size={10} /></ThemeIcon>}
                                      </Group>
                                      <Text size="xs" c="dimmed">{new Date(inv.check_in_date).toLocaleDateString()} — {new Date(inv.check_out_date).toLocaleDateString()}</Text>
                                      <Text size="xs" fw={500} c="brown">{Number(inv.sell_price_per_bed || inv.sell_price || 0).toLocaleString('en')} د.م/{t('bed') || 'سرير'}</Text>
                                    </Card>
                                  );
                                })}
                                {col1Hotel && col2Type && getInventoryForHotelAndType(col1Hotel, col2Type).length === 0 && <Text size="xs" c="dimmed">{t('no_inventory') || 'لا مخزون'}</Text>}
                                {(!col1Hotel || !col2Type) && <Text size="xs" c="dimmed">{t('select_hotel_and_type') || 'اختر فندق ونوع'}</Text>}
                              </Stack>
                            </ScrollArea>
                          </Paper>
                        </SimpleGrid>
                      </Card>
                    );
                  })}
                </Stack>
                )}
              </Stack>
            )}
            
            {hotelRoomCombos.length === 0 && allSeasonInventory.length === 0 && selectedSeason && (
              <Alert color="orange" icon={<AlertCircle size={18} />}>
                {t('no_inventory_for_season') || 'لا يوجد مخزون لفنادق هذا الموسم. يرجى شراء مخزون من صفحة المخزون أولاً قبل الحجز.'}
              </Alert>
            )}
          </Stack>
        )}

        {/* Step 5: Extra Services */}
        {active === 4 && (
          <Stack>
            <Text fw={500}>الخدمات الإضافية (اختياري)</Text>
            <SimpleGrid cols={2}>
              {availableServices.map((service) => {
                const isSelected = selectedServices.some(s => s.service_id === service.id);
                return (
                  <Card
                    key={service.id}
                    p="md"
                    radius="md"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      borderColor: isSelected ? '#8B7355' : undefined,
                      backgroundColor: isSelected ? '#F5EFE6' : undefined
                    }}
                    onClick={() => toggleService(service)}
                  >
                    <Group justify="space-between">
                      <div>
                        <Text fw={500}>{service.name_ar || service.name}</Text>
                        <Badge size="sm" variant="light">{service.category}</Badge>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <Text fw={600} c="brown">{service.price?.toLocaleString('en')} د.م</Text>
                        <Checkbox checked={isSelected} readOnly />
                      </div>
                    </Group>
                  </Card>
                );
              })}
            </SimpleGrid>
          </Stack>
        )}

        {/* Step 6: Invoice Review */}
        {active === 5 && (
          <Stack>
            <Title order={4}>ملخص الفاتورة</Title>
            
            <Card withBorder p="md">
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>الوصف</Table.Th>
                    <Table.Th>الكمية</Table.Th>
                    <Table.Th>السعر</Table.Th>
                    <Table.Th>المجموع</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pilgrims.map((p, idx) => {
                    const flightInvId = sameSelectionForAll ? selectedFlightInventory : pilgrimFlightSelections[idx];
                    const flightInv = flightInvId ? availableFlightInventory.find((i: any) => i.id === flightInvId) : null;
                    const flightPrice = (flightInv?.sell_price ?? flightInv?.sell_price_per_seat) != null
                      ? Number(flightInv.sell_price ?? flightInv.sell_price_per_seat) : 0;

                    const roomInvs = sameSelectionForAll ? getSameForAllInventories() : getPilgrimInventories(idx);
                    const pilgrimRoomTotal = roomInvs.reduce((sum, inv: any) => sum + Number(inv?.sell_price_per_bed ?? inv?.sell_price ?? 0), 0);

                    const pilgrimSubtotal = flightPrice + pilgrimRoomTotal;
                    if (pilgrimSubtotal <= 0) return null;

                    return (
                      <React.Fragment key={`pilgrim-group-${idx}`}>
                        <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                          <Table.Td colSpan={4} py="sm">
                            <Text fw={600}>{p.full_name_ar || p.full_name}</Text>
                          </Table.Td>
                        </Table.Tr>
                        {flightPrice > 0 && (
                          <Table.Tr>
                            <Table.Td pl="xl">
                              <Text size="sm">{t('flight') || 'الرحلة'}</Text>
                              <Text size="xs" c="dimmed">{t('seat') || 'مقعد'}</Text>
                            </Table.Td>
                            <Table.Td>1</Table.Td>
                            <Table.Td>{flightPrice.toLocaleString('en')} د.م / {t('seat') || 'مقعد'}</Table.Td>
                            <Table.Td>{flightPrice.toLocaleString('en')} د.م</Table.Td>
                          </Table.Tr>
                        )}
                        {roomInvs.map((inv: any, invIdx: number) => {
                          const pricePerBedTotal = Number(inv?.sell_price_per_bed ?? inv?.sell_price ?? 0);
                          if (pricePerBedTotal <= 0) return null;
                          const nights = getNightsFromInventory(inv);
                          const pricePerNight = nights > 0 ? pricePerBedTotal / nights : 0;
                          const hotelName = inv.accommodations?.name_ar || inv.accommodations?.name || (t('hotel') || 'فندق');
                          const roomTypeLabel = inv.room_types?.type || '';
                          return (
                            <Table.Tr key={`pilgrim-${idx}-bed-${invIdx}`}>
                              <Table.Td pl="xl">
                                <Text size="sm">{t('accommodation') || 'السكن'}</Text>
                                <Text size="xs" c="dimmed">{hotelName}{roomTypeLabel ? ` – ${roomTypeLabel}` : ''}</Text>
                              </Table.Td>
                              <Table.Td>{nights}</Table.Td>
                              <Table.Td>{pricePerNight.toLocaleString('en')} د.م / {t('price_per_night') || 'ليلة'}</Table.Td>
                              <Table.Td>{(pricePerNight * nights).toLocaleString('en')} د.م</Table.Td>
                            </Table.Tr>
                          );
                        })}
                        <Table.Tr style={{ borderBottomWidth: 2 }}>
                          <Table.Td pl="xl" colSpan={3}>
                            <Text size="sm" fw={500} c="dimmed">{t('subtotal') || 'المجموع الفرعي'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={600}>{pilgrimSubtotal.toLocaleString('en')} د.م</Text>
                          </Table.Td>
                        </Table.Tr>
                      </React.Fragment>
                    );
                  })}
                  <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                    <Table.Td colSpan={4} py="sm">
                      <Text fw={600}>{t('extra_services') || 'الخدمات الإضافية'}</Text>
                    </Table.Td>
                  </Table.Tr>
                  {selectedServices.length > 0 ? (
                    selectedServices.map((service) => (
                      <Table.Tr key={service.service_id}>
                        <Table.Td pl="xl">{service.name}</Table.Td>
                        <Table.Td>{service.quantity * pilgrims.length}</Table.Td>
                        <Table.Td>{service.price.toLocaleString('en')} د.م</Table.Td>
                        <Table.Td>{(service.price * service.quantity * pilgrims.length).toLocaleString('en')} د.م</Table.Td>
                      </Table.Tr>
                    ))
                  ) : (
                    <Table.Tr>
                      <Table.Td pl="xl" colSpan={4}>
                        <Text size="sm" c="dimmed">{t('no_services_selected') || 'لا خدمات محددة'}</Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Card>

            <Group>
              {availableDiscounts.length > 0 ? (
                <Select
                  label={t('discount') || 'الخصم'}
                  placeholder={t('select_discount') || 'اختر الخصم'}
                  data={availableDiscounts.map((d: any) => ({
                    value: d.id,
                    label: `${d.name_ar || d.name} ${d.discount_type === 'percent' ? `(${d.discount_value}%)` : `(${d.discount_value} MAD)`}${d.remaining !== null ? ` - ${t('remaining') || 'متبقي'}: ${d.remaining}` : ''}`,
                    disabled: d.remaining === 0 || !d.can_use
                  }))}
                  value={selectedDiscountId}
                  onChange={handleDiscountSelect}
                  clearable
                  w={350}
                />
              ) : (
                <NumberInput
                  label={t('discount') || 'خصم'}
                  value={discount}
                  onChange={(v) => setDiscount(Number(v) || 0)}
                  min={0}
                  max={calculatePackageTotal() + calculateServicesTotal()}
                  w={200}
                />
              )}
              {discount > 0 && (
                <Badge color="green" size="lg">
                  -{discount} {t('mad') || 'د.م'}
                </Badge>
              )}
            </Group>

            <Divider />

            <Group justify="space-between">
              <Text size="xl" fw={700}>المجموع الكلي:</Text>
              <Text size="xl" fw={700} c="brown">{calculateTotal().toLocaleString('en')} د.م</Text>
            </Group>

            <TextInput
              label="ملاحظات"
              placeholder="ملاحظات إضافية..."
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
            />
          </Stack>
        )}

        {/* Step 7: Payment */}
        {active === 6 && (
          <Stack>
            {createdBooking ? (
              <>
                <Alert color="green" icon={<CheckCircle size={18} />}>
                  تم إنشاء الحجز بنجاح! رقم الحجز: {createdBooking.booking_number}
                </Alert>

                <Card withBorder p="lg">
                  <Stack>
                    <Group justify="space-between">
                      <Text>المبلغ الإجمالي:</Text>
                      <Text fw={600}>{calculateTotal().toLocaleString('en')} د.م</Text>
                    </Group>
                    
                    <NumberInput
                      label="مبلغ الدفعة"
                      placeholder="أدخل المبلغ"
                      value={paymentAmount}
                      onChange={(v) => setPaymentAmount(Number(v) || 0)}
                      min={0}
                      max={calculateTotal()}
                    />

                    <Select
                      label="طريقة الدفع"
                      data={[
                        { value: 'cash', label: 'نقداً' },
                        { value: 'card', label: 'بطاقة' },
                        { value: 'bank_transfer', label: 'تحويل بنكي' },
                        { value: 'check', label: 'شيك' }
                      ]}
                      value={paymentMethod || ''}
                      onChange={(value) => setPaymentMethod(value || null)}
                    />

                    <Group>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setPaymentAmount(calculateTotal());
                        }}
                      >
                        دفع كامل
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setPaymentAmount(Math.round(calculateTotal() / 2));
                        }}
                      >
                        دفع نصف المبلغ
                      </Button>
                    </Group>
                  </Stack>
                </Card>
              </>
            ) : (
              <Alert color="yellow">
                يرجى إنشاء الحجز أولاً
              </Alert>
            )}
          </Stack>
        )}

        {/* Step 8: Room Allocation */}
        {active === 7 && (
          <Stack>
            <Alert color="blue" icon={<BedDouble size={18} />} mb="md">
              <Text fw={500} mb="xs">{t('room_allocation_rules') || 'قواعد توزيع الغرف:'}</Text>
              <ul style={{ margin: 0, paddingRight: '20px' }}>
                <li>{t('gender_separation') || 'الفصل بين الجنسين (الرجال مع الرجال، النساء مع النساء)'}</li>
                <li>{t('mahram_sharing') || 'المحارم (الأزواج، الأم/الابن) يمكنهم المشاركة في نفس الغرفة'}</li>
              </ul>
            </Alert>

            {/* Pilgrims Summary */}
            <Card withBorder p="md">
              <Text fw={500} mb="sm">{t('pilgrims_to_allocate') || 'المعتمرين للتوزيع'} ({pilgrims.length})</Text>
              <SimpleGrid cols={2}>
                {pilgrims.map((p, idx) => (
                  <Card key={idx} p="xs" withBorder radius="sm" style={{ backgroundColor: '#f9f9f9' }}>
                    <Group justify="space-between">
                      <div>
                        <Text size="sm" fw={500}>{p.full_name_ar || p.full_name}</Text>
                        <Badge 
                          size="xs" 
                          color={p.gender === 'male' ? 'blue' : 'pink'}
                          variant="light"
                        >
                          {p.gender === 'male' ? t('male') || 'ذكر' : t('female') || 'أنثى'}
                        </Badge>
                        {p.spouse_index !== undefined && (
                          <Badge size="xs" color="green" variant="light" ml={4}>
                            {t('mahram') || 'محرم'}
                          </Badge>
                        )}
                      </div>
                    </Group>
                  </Card>
                ))}
              </SimpleGrid>
            </Card>

            {/* Room Type Info */}
            {selectedRoomType && (
              <Card withBorder p="md">
                <Text fw={500} mb="sm">{t('selected_room_type') || 'نوع الغرفة المختار'}</Text>
                {(() => {
                  const combo = hotelRoomCombos.find(c => c.roomTypeId === selectedRoomType);
                  const rt = combo?.roomType || roomTypes.find((r: any) => r.id === selectedRoomType);
                  const capacity = rt?.type === 'double' ? 2 : rt?.type === 'triple' ? 3 : rt?.type === 'quad' ? 4 : 5;
                  const roomsNeeded = Math.ceil(pilgrims.length / capacity);
                  const males = pilgrims.filter(p => p.gender === 'male').length;
                  const females = pilgrims.filter(p => p.gender === 'female').length;
                  const maleRooms = Math.ceil(males / capacity);
                  const femaleRooms = Math.ceil(females / capacity);
                  
                  return (
                    <Stack gap="xs">
                      <Group>
                        <Badge size="lg" color="brown">{t(rt?.type) || rt?.type}</Badge>
                        <Text>{capacity} {t('beds_per_room') || 'أسرة/غرفة'}</Text>
                      </Group>
                      
                      <Divider label={t('suggested_allocation') || 'التوزيع المقترح'} />
                      
                      <SimpleGrid cols={2}>
                        <Card p="sm" withBorder style={{ backgroundColor: '#e8f4fc' }}>
                          <Text size="sm" c="dimmed">{t('male_rooms') || 'غرف الرجال'}</Text>
                          <Group>
                            <Text size="xl" fw={700} c="blue">{maleRooms}</Text>
                            <Text size="sm" c="dimmed">({males} {t('pilgrims') || 'معتمر'})</Text>
                          </Group>
                        </Card>
                        <Card p="sm" withBorder style={{ backgroundColor: '#fce8f0' }}>
                          <Text size="sm" c="dimmed">{t('female_rooms') || 'غرف النساء'}</Text>
                          <Group>
                            <Text size="xl" fw={700} c="pink">{femaleRooms}</Text>
                            <Text size="sm" c="dimmed">({females} {t('pilgrims') || 'معتمر'})</Text>
                          </Group>
                        </Card>
                      </SimpleGrid>
                      
                      <Alert color="green" variant="light">
                        <Text size="sm">
                          {t('total_rooms_needed') || 'إجمالي الغرف المطلوبة'}: <strong>{roomsNeeded}</strong>
                        </Text>
                      </Alert>
                    </Stack>
                  );
                })()}
              </Card>
            )}

            {/* Action Buttons */}
            <Group justify="center" mt="xl" gap="lg">
              <Button 
                size="lg" 
                onClick={handleAllocateRooms}
                leftSection={<BedDouble size={20} />}
              >
                {t('auto_allocate') || 'توزيع تلقائي'}
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate(`/bookings/${createdBooking?.id}/rooms`)}
                leftSection={<Users size={20} />}
              >
                {t('manual_allocate') || 'توزيع يدوي'}
              </Button>
              <Button 
                size="lg" 
                variant="subtle"
                onClick={() => navigate(`/bookings/${createdBooking?.id}`)}
              >
                {t('skip_and_finish') || 'تخطي والانتهاء'}
              </Button>
            </Group>
          </Stack>
        )}

        {/* Navigation */}
        <Group justify="space-between" mt="xl">
          <Button variant="default" onClick={prevStep} disabled={active === 0}>
            السابق
          </Button>
          
          {active < 5 && (
            <Button onClick={nextStep} disabled={!canProceed()}>
              التالي
            </Button>
          )}
          
          {active === 5 && (
            <Button onClick={handleCreateBooking} disabled={!canProceed()}>
              إنشاء الحجز
            </Button>
          )}
          
          {active === 6 && createdBooking && (
            <Button onClick={handleConfirmAndPay}>
              تأكيد وحفظ الدفعة
            </Button>
          )}
        </Group>
      </Paper>
    </Stack>
  );
}

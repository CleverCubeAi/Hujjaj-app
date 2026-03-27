import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { 
  Title, Paper, Table, Badge, Text, Loader, Center, Button, Group, 
  Modal, TextInput, Select, Stack, ActionIcon,
  Accordion, Card, Tooltip, Box
} from '@mantine/core';
import { Plus, Edit, Trash2, Building, BedDouble, Package, AlertCircle } from 'lucide-react';
import { countries, getCitiesByCountry, getLocalizedLabel } from '../../data/locations';
import { ImageUpload } from '../../components/common/ImageUpload';
import { HotelInventoryForm } from '../inventory/HotelInventoryForm';

interface RoomType {
  id: string;
  type: string;
  total_rooms: number;
  total_beds: number;
  price_per_bed?: number;
  photo_url?: string;
  inventory?: {
    beds_purchased: number;
    beds_sold: number;
    beds_available: number;
  };
}

interface Accommodation {
  id: string;
  name: string;
  name_ar?: string;
  country?: string;
  city: string;
  season_id: string;
  photo_url?: string;
  room_types: RoomType[];
  seasons?: { name: string };
}

interface Season {
  id: string;
  name: string;
}

interface AccommodationForm {
  name: string;
  name_ar: string;
  country: string;
  city: string;
  season_id: string;
  photo_url: string | null;
}

interface RoomTypeForm {
  accommodation_id: string;
  type: string;
  total_rooms: number;
  total_beds: number;
  photo_url: string | null;
}

const emptyAccForm: AccommodationForm = { name: '', name_ar: '', country: 'SA', city: '', season_id: '', photo_url: null };
const emptyRoomForm: RoomTypeForm = { accommodation_id: '', type: 'double', total_rooms: 0, total_beds: 0, photo_url: null };

export function AccommodationGrid() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  
  // Accommodation modal
  const [accModalOpen, setAccModalOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Accommodation | null>(null);
  const [accForm, setAccForm] = useState<AccommodationForm>(emptyAccForm);
  
  // Room type modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomType | null>(null);
  const [roomForm, setRoomForm] = useState<RoomTypeForm>(emptyRoomForm);
  
  // Delete confirmation
  const [deleteAccConfirm, setDeleteAccConfirm] = useState<Accommodation | null>(null);
  const [deleteRoomConfirm, setDeleteRoomConfirm] = useState<{ room: RoomType; accId: string } | null>(null);

  // Add inventory modal (pre-filled for a specific room type)
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryPrefill, setInventoryPrefill] = useState<{ season_id: string; accommodation_id: string; room_type_id: string } | null>(null);

  const fetchData = async () => {
    try {
      const [accs, seasonsList, inventory] = await Promise.all([
        api.getAccommodations(),
        api.getSeasons(),
        api.getHotelInventory().catch(() => [])
      ]);
      setAccommodations(accs);
      setSeasons(seasonsList);
      setInventoryData(inventory || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoomTypeInventory = (accommodationId: string, roomTypeId: string) => {
    const inv = inventoryData.filter((inv: any) => 
      inv.accommodation_id === accommodationId && inv.room_type_id === roomTypeId
    );
    // Use beds_purchased/beds_sold/beds_available for bed-based inventory
    const totalPurchased = inv.reduce((sum: number, i: any) => sum + (i.beds_purchased || i.rooms_purchased || 0), 0);
    const totalSold = inv.reduce((sum: number, i: any) => sum + (i.beds_sold || i.rooms_sold || 0), 0);
    const totalAvailable = inv.reduce((sum: number, i: any) => sum + (i.beds_available || i.rooms_available || 0), 0);
    return { beds_purchased: totalPurchased, beds_sold: totalSold, beds_available: totalAvailable };
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Accommodation CRUD
  const openCreateAccModal = () => {
    setEditingAcc(null);
    setAccForm(emptyAccForm);
    setAccModalOpen(true);
  };

  const openEditAccModal = (acc: Accommodation) => {
    setEditingAcc(acc);
    setAccForm({
      name: acc.name,
      name_ar: acc.name_ar || '',
      country: acc.country || 'SA',
      city: acc.city || '',
      season_id: acc.season_id,
      photo_url: acc.photo_url || null,
    });
    setAccModalOpen(true);
  };

  const handleAccSubmit = async () => {
    if (!accForm.name || !accForm.season_id) return;
    
    try {
      if (editingAcc) {
        await api.updateAccommodation(editingAcc.id, accForm);
      } else {
        await api.createAccommodation(accForm);
      }
      setAccModalOpen(false);
      setAccForm(emptyAccForm);
      setEditingAcc(null);
      fetchData();
    } catch (error) {
      console.error('Error saving accommodation:', error);
    }
  };

  const handleDeleteAcc = async () => {
    if (!deleteAccConfirm) return;
    try {
      await api.deleteAccommodation(deleteAccConfirm.id);
      setDeleteAccConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting accommodation:', error);
    }
  };

  // Room Type CRUD
  const openCreateRoomModal = (accId: string) => {
    setEditingRoom(null);
    setRoomForm({ ...emptyRoomForm, accommodation_id: accId });
    setRoomModalOpen(true);
  };

  const openEditRoomModal = (room: RoomType, accId: string) => {
    setEditingRoom(room);
    setRoomForm({
      accommodation_id: accId,
      type: room.type,
      total_rooms: room.total_rooms,
      total_beds: room.total_beds,
      photo_url: room.photo_url || null,
    });
    setRoomModalOpen(true);
  };

  const handleRoomSubmit = async () => {
    if (!roomForm.type) return;
    
    try {
      if (editingRoom) {
        await api.updateRoomType(editingRoom.id, {
          type: roomForm.type,
          total_rooms: roomForm.total_rooms,
          total_beds: roomForm.total_beds,
          photo_url: roomForm.photo_url,
        });
      } else {
        await api.createRoomType(roomForm);
      }
      setRoomModalOpen(false);
      setRoomForm(emptyRoomForm);
      setEditingRoom(null);
      fetchData();
    } catch (error) {
      console.error('Error saving room type:', error);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deleteRoomConfirm) return;
    try {
      await api.deleteRoomType(deleteRoomConfirm.room.id);
      setDeleteRoomConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting room type:', error);
    }
  };

  const openAddInventoryModal = (acc: Accommodation, roomType: RoomType) => {
    setInventoryPrefill({
      season_id: acc.season_id,
      accommodation_id: acc.id,
      room_type_id: roomType.id,
    });
    setInventoryModalOpen(true);
  };

  const handleInventorySave = () => {
    setInventoryModalOpen(false);
    setInventoryPrefill(null);
    fetchData();
  };

  const getRoomTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'double': return 'blue';
      case 'triple': return 'green';
      case 'quad': return 'orange';
      case 'quint': return 'purple';
      default: return 'gray';
    }
  };

  const getDisplayName = (acc: Accommodation) => {
    return i18n.language === 'ar' && acc.name_ar ? acc.name_ar : acc.name;
  };

  if (loading) {
    return (
      <Center h={300}>
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Title order={2}>{t('accommodations')}</Title>
        <Button leftSection={<Plus size={16} />} onClick={openCreateAccModal}>
          {t('add_accommodation') || 'Add Accommodation'}
        </Button>
      </Group>

      {accommodations.length === 0 ? (
        <Paper shadow="sm" p="xl">
          <Text ta="center" c="dimmed">
            {t('no_data') || 'No accommodations found. Create one to get started.'}
          </Text>
        </Paper>
      ) : (
        <Accordion variant="separated">
          {accommodations.map((acc) => (
            <Accordion.Item key={acc.id} value={acc.id}>
              <Accordion.Control icon={<Building size={20} />}>
                <Group justify="space-between" style={{ flex: 1 }} pr="md">
                  <div>
                    <Text fw={500}>{getDisplayName(acc)}</Text>
                    <Text size="sm" c="dimmed">
                      {acc.country && countries.find(c => c.value === acc.country) 
                        ? getLocalizedLabel(countries.find(c => c.value === acc.country)!, i18n.language) + ' - ' 
                        : ''
                      }
                      {acc.city && acc.country 
                        ? (getCitiesByCountry(acc.country).find(c => c.value === acc.city)
                            ? getLocalizedLabel(getCitiesByCountry(acc.country).find(c => c.value === acc.city)!, i18n.language)
                            : acc.city)
                        : acc.city
                      } • {acc.seasons?.name || t('no_season') || 'No season'}
                    </Text>
                  </div>
                  <Badge>{acc.room_types?.length || 0} {t('room_types') || 'room types'}</Badge>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Group justify="space-between" mb="md">
                  <Text size="sm" c="dimmed">
                    {acc.name_ar && i18n.language !== 'ar' ? `Arabic: ${acc.name_ar}` : ''}
                  </Text>
                  <Group gap="xs">
                    <Button 
                      size="xs" 
                      variant="light" 
                      color="blue"
                      leftSection={<Package size={14} />} 
                      onClick={() => navigate('/inventory/hotel-rooms', { state: { accommodation_id: acc.id } })}
                    >
                      {t('view_inventory') || 'View Inventory'}
                    </Button>
                    <Button size="xs" variant="light" leftSection={<BedDouble size={14} />} onClick={() => openCreateRoomModal(acc.id)}>
                      {t('add_room_type') || 'Add Room Type'}
                    </Button>
                    <ActionIcon variant="subtle" onClick={() => openEditAccModal(acc)}>
                      <Edit size={16} />
                    </ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => setDeleteAccConfirm(acc)}>
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Group>
                </Group>

                {acc.room_types && acc.room_types.length > 0 ? (
                  <>
                    {/* Warning if any room types have no inventory */}
                    {acc.room_types.some((rt: RoomType) => {
                      const inventory = getRoomTypeInventory(acc.id, rt.id);
                      return inventory.beds_purchased === 0;
                    }) && (
                      <Card mb="md" p="sm" withBorder style={{ backgroundColor: '#fff8e1', borderColor: '#ff9800' }}>
                        <Group gap="sm">
                          <AlertCircle size={20} color="#ff9800" />
                          <div>
                            <Text size="sm" fw={500} c="orange">
                              {t('some_room_types_no_inventory') || 'بعض أنواع الغرف ليس لها مخزون'}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {t('add_inventory_to_book') || 'أنواع الغرف بدون مخزون لن تظهر في الحجوزات. أضف مخزون من صفحة المخزون.'}
                            </Text>
                          </div>
                        </Group>
                      </Card>
                    )}
                    <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('room_type') || 'Type'}</Table.Th>
                        <Table.Th>{t('capacity_per_room') || 'السعة/غرفة'}</Table.Th>
                        <Table.Th>{t('inventory_purchased') || 'المخزون المشترى'}</Table.Th>
                        <Table.Th>{t('inventory_available') || 'المتاح للحجز'}</Table.Th>
                        <Table.Th>{t('actions') || 'Actions'}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {acc.room_types.map((rt) => {
                        const inventory = getRoomTypeInventory(acc.id, rt.id);
                        // Get capacity based on room type
                        const capacityPerRoom = rt.type === 'double' ? 2 : rt.type === 'triple' ? 3 : rt.type === 'quad' ? 4 : rt.type === 'quint' ? 5 : 4;
                        // Check if inventory exists
                        const hasInventory = inventory.beds_purchased > 0;
                        
                        return (
                          <Table.Tr key={rt.id} style={{ backgroundColor: !hasInventory ? '#fff8e1' : undefined }}>
                            <Table.Td>
                              <Group gap="xs">
                                <Badge color={getRoomTypeBadgeColor(rt.type)} variant="light">
                                  {t(rt.type) || rt.type}
                                </Badge>
                                {!hasInventory && (
                                  <Tooltip label={t('no_inventory_warning') || 'لا يوجد مخزون - لن يظهر هذا النوع في الحجوزات'}>
                                    <AlertCircle size={16} color="#ff9800" />
                                  </Tooltip>
                                )}
                              </Group>
                            </Table.Td>
                            <Table.Td>
                              <Text fw={500}>{capacityPerRoom} {t('beds') || 'أسرة'}</Text>
                            </Table.Td>
                            <Table.Td>
                              {hasInventory ? (
                                <Badge size="lg" color="blue" variant="light">
                                  {inventory.beds_purchased} {t('beds') || 'سرير'}
                                </Badge>
                              ) : (
                                <Group gap={4}>
                                  <Badge size="sm" color="orange" variant="light">
                                    {t('no_inventory') || 'لا يوجد مخزون'}
                                  </Badge>
                                </Group>
                              )}
                            </Table.Td>
                            <Table.Td>
                              {hasInventory ? (
                                <Tooltip label={`${t('sold') || 'مباع'}: ${inventory.beds_sold} | ${t('available') || 'متاح'}: ${inventory.beds_available}`}>
                                  <Badge size="lg" color={inventory.beds_available > 0 ? 'green' : 'red'} variant="filled">
                                    {inventory.beds_available} {t('beds_available') || 'متاح'}
                                  </Badge>
                                </Tooltip>
                              ) : (
                                <Button 
                                  size="xs" 
                                  variant="light" 
                                  color="orange"
                                  leftSection={<Package size={12} />}
                                  onClick={() => openAddInventoryModal(acc, rt)}
                                >
                                  {t('add_inventory') || 'إضافة مخزون'}
                                </Button>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Group gap="xs">
                                <Tooltip label={t('manage_inventory') || 'إدارة المخزون'}>
                                  <ActionIcon 
                                    size="sm" 
                                    variant="subtle" 
                                    color="blue"
                                    onClick={() => navigate('/inventory/hotel-rooms', { state: { accommodation_id: acc.id, room_type_id: rt.id } })}
                                  >
                                    <Package size={14} />
                                  </ActionIcon>
                                </Tooltip>
                                <ActionIcon size="sm" variant="subtle" onClick={() => openEditRoomModal(rt, acc.id)}>
                                  <Edit size={14} />
                                </ActionIcon>
                                <ActionIcon size="sm" variant="subtle" color="red" onClick={() => setDeleteRoomConfirm({ room: rt, accId: acc.id })}>
                                  <Trash2 size={14} />
                                </ActionIcon>
                              </Group>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                    </Table>
                  </>
                ) : (
                  <Text c="dimmed" ta="center" py="md">
                    {t('no_room_types') || 'No room types. Add one to define capacity.'}
                  </Text>
                )}
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion>
      )}

      {/* Accommodation Modal */}
      <Modal
        opened={accModalOpen}
        onClose={() => { setAccModalOpen(false); setEditingAcc(null); }}
        title={editingAcc ? (t('edit_accommodation') || 'Edit Accommodation') : (t('add_accommodation') || 'Add Accommodation')}
      >
        <Stack>
          <Box>
            <Text size="sm" fw={500} mb="xs">{t('hotel_photo') || 'Hotel Photo'}</Text>
            <Group justify="center">
              <ImageUpload
                value={accForm.photo_url}
                onChange={(url) => setAccForm({ ...accForm, photo_url: url })}
                folder="hotels"
                variant="card"
                size={200}
                placeholder={t('click_to_upload') || 'Click to upload'}
              />
            </Group>
          </Box>
          <TextInput
            label={t('hotel_name') || 'Hotel Name'}
            value={accForm.name}
            onChange={(e) => setAccForm({ ...accForm, name: e.target.value })}
            required
          />
          <TextInput
            label={t('name_ar') || 'Arabic Name'}
            value={accForm.name_ar}
            onChange={(e) => setAccForm({ ...accForm, name_ar: e.target.value })}
            dir="rtl"
          />
          <Select
            label={t('country') || 'Country'}
            value={accForm.country}
            onChange={(value) => setAccForm({ ...accForm, country: value || 'SA', city: '' })}
            data={countries.map(c => ({ 
              value: c.value, 
              label: getLocalizedLabel(c, i18n.language) 
            }))}
            searchable
            required
          />
          <Select
            label={t('city') || 'City'}
            value={accForm.city}
            onChange={(value) => setAccForm({ ...accForm, city: value || '' })}
            data={getCitiesByCountry(accForm.country).map(c => ({ 
              value: c.value, 
              label: getLocalizedLabel(c, i18n.language) 
            }))}
            searchable
            disabled={!accForm.country}
            placeholder={t('select_city') || 'Select city'}
          />
          <Select
            label={t('season') || 'Season'}
            value={accForm.season_id}
            onChange={(value) => setAccForm({ ...accForm, season_id: value || '' })}
            data={seasons.map(s => ({ value: s.id, label: s.name }))}
            required
          />
          <Button onClick={handleAccSubmit} disabled={!accForm.name || !accForm.season_id}>
            {editingAcc ? (t('update') || 'Update') : (t('create') || 'Create')}
          </Button>
        </Stack>
      </Modal>

      {/* Room Type Modal */}
      <Modal
        opened={roomModalOpen}
        onClose={() => { setRoomModalOpen(false); setEditingRoom(null); }}
        title={editingRoom ? (t('edit_room_type') || 'Edit Room Type') : (t('add_room_type') || 'Add Room Type')}
      >
        <Stack>
          <Box>
            <Text size="sm" fw={500} mb="xs">{t('room_photo') || 'Room Photo'}</Text>
            <Group justify="center">
              <ImageUpload
                value={roomForm.photo_url}
                onChange={(url) => setRoomForm({ ...roomForm, photo_url: url })}
                folder="rooms"
                variant="card"
                size={180}
                placeholder={t('click_to_upload') || 'Click to upload'}
              />
            </Group>
          </Box>
          <Select
            label={t('room_type') || 'Room Type'}
            value={roomForm.type}
            onChange={(value) => setRoomForm({ ...roomForm, type: value || 'double' })}
            data={[
              { value: 'double', label: t('double') || 'Double (2)' },
              { value: 'triple', label: t('triple') || 'Triple (3)' },
              { value: 'quad', label: t('quad') || 'Quad (4)' },
              { value: 'quint', label: t('quint') || 'Quint (5)' },
            ]}
            required
          />
          <Text size="xs" c="dimmed">
            {t('rooms_beds_auto_calculated') || 'Rooms and beds are automatically calculated when you purchase inventory.'}
          </Text>
          <Button onClick={handleRoomSubmit} disabled={!roomForm.type}>
            {editingRoom ? (t('update') || 'Update') : (t('create') || 'Create')}
          </Button>
        </Stack>
      </Modal>

      {/* Delete Accommodation Confirmation */}
      <Modal
        opened={!!deleteAccConfirm}
        onClose={() => setDeleteAccConfirm(null)}
        title={t('confirm_delete') || 'Confirm Delete'}
        size="sm"
      >
        <Stack>
          <Text>
            {t('delete_accommodation_confirm') || `Are you sure you want to delete "${deleteAccConfirm?.name}"? This will also delete all room types.`}
          </Text>
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setDeleteAccConfirm(null)}>{t('cancel') || 'Cancel'}</Button>
            <Button color="red" onClick={handleDeleteAcc}>{t('delete') || 'Delete'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Delete Room Type Confirmation */}
      <Modal
        opened={!!deleteRoomConfirm}
        onClose={() => setDeleteRoomConfirm(null)}
        title={t('confirm_delete') || 'Confirm Delete'}
        size="sm"
      >
        <Stack>
          <Text>
            {t('delete_room_type_confirm') || `Are you sure you want to delete this room type?`}
          </Text>
          <Group justify="flex-end">
            <Button variant="outline" onClick={() => setDeleteRoomConfirm(null)}>{t('cancel') || 'Cancel'}</Button>
            <Button color="red" onClick={handleDeleteRoom}>{t('delete') || 'Delete'}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add Inventory Modal (pre-filled with accommodation and room type) */}
      <Modal
        opened={inventoryModalOpen}
        onClose={() => { setInventoryModalOpen(false); setInventoryPrefill(null); }}
        title={t('add_inventory') || 'إضافة مخزون'}
        size="lg"
      >
        <HotelInventoryForm
          prefill={inventoryPrefill || undefined}
          onSave={handleInventorySave}
          onCancel={() => { setInventoryModalOpen(false); setInventoryPrefill(null); }}
        />
      </Modal>
    </div>
  );
}

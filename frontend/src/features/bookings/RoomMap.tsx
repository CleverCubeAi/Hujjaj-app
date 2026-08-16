import React, { useState } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Card,
  SimpleGrid,
  ActionIcon,
  Tooltip,
  Box,
  Menu,
  Progress,
  ThemeIcon
} from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { 
  BedDouble, 
  User, 
  UserPlus, 
  X, 
  Users,
  CheckCircle,
  AlertCircle,
  Home
} from 'lucide-react';

interface Pilgrim {
  id: string;
  full_name: string;
  full_name_ar?: string;
  gender: 'male' | 'female';
  mahram_group_id?: string;
  spouse_id?: string;
  is_mahram?: boolean;
}

interface RoomAssignment {
  id: string;
  room_number: string;
  pilgrim_id: string;
  pilgrims?: Pilgrim;
}

interface RoomType {
  id: string;
  type: string;
  total_rooms: number;
  total_beds: number;
}

interface RoomMapProps {
  roomType: RoomType | null;
  assignments: RoomAssignment[];
  pilgrims: Pilgrim[];
  onAssignPilgrim: (pilgrimId: string, roomNumber: string) => void;
  onRemoveAssignment: (assignmentId: string) => void;
}

// Get capacity based on room type
function getRoomCapacity(type: string): number {
  const capacities: Record<string, number> = {
    double: 2,
    triple: 3,
    quad: 4,
    quint: 5
  };
  return capacities[type] || 4;
}

// Generate room numbers based on how many rooms are needed for pilgrims
function generateRoomNumbers(roomType: RoomType, pilgrimsCount: number, capacity: number): string[] {
  const prefix = roomType.type.charAt(0).toUpperCase();
  const rooms: string[] = [];
  // Calculate rooms needed based on pilgrims, not roomType.total_rooms
  const roomsNeeded = Math.ceil(pilgrimsCount / capacity);
  for (let i = 1; i <= roomsNeeded; i++) {
    rooms.push(`${prefix}${i.toString().padStart(3, '0')}`);
  }
  return rooms;
}

const DRAG_TYPE = 'application/x-pilgrim-assign';

export function RoomMap({ 
  roomType, 
  assignments, 
  pilgrims, 
  onAssignPilgrim, 
  onRemoveAssignment 
}: RoomMapProps) {
  const { t } = useTranslation();
  const [dragOverBed, setDragOverBed] = useState<string | null>(null);

  if (!roomType) {
    return (
      <Paper p="xl" ta="center" style={{ backgroundColor: '#f9f9f9' }}>
        <BedDouble size={48} color="#ccc" />
        <Text c="dimmed" mt="md">{t('no_room_type_selected') || 'لم يتم تحديد نوع غرفة'}</Text>
      </Paper>
    );
  }

  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safePilgrims = Array.isArray(pilgrims) ? pilgrims : [];
  
  const capacity = getRoomCapacity(roomType.type);
  const pilgrimsCount = safePilgrims.length;
  
  // If no pilgrims, show appropriate message
  if (pilgrimsCount === 0) {
    return (
      <Paper p="xl" ta="center" style={{ backgroundColor: '#f9f9f9' }}>
        <Users size={48} color="#ccc" />
        <Text c="dimmed" mt="md">{t('no_pilgrims_to_assign') || 'لا يوجد معتمرين لتوزيعهم'}</Text>
      </Paper>
    );
  }
  
  // Generate room numbers based on PILGRIMS COUNT (how many rooms are needed)
  const roomNumbers = generateRoomNumbers(roomType, pilgrimsCount, capacity);
  
  // Get unique room numbers from assignments (might have extra rooms if manually created)
  const usedRoomNumbers = new Set(safeAssignments.map(a => a.room_number));
  const allRoomNumbers = [...new Set([...roomNumbers, ...usedRoomNumbers])].sort();

  // Group assignments by room
  const roomOccupancy = safeAssignments.reduce((acc, assignment) => {
    if (!acc[assignment.room_number]) {
      acc[assignment.room_number] = [];
    }
    acc[assignment.room_number].push(assignment);
    return acc;
  }, {} as Record<string, RoomAssignment[]>);

  // Get unassigned pilgrims
  const assignedPilgrimIds = new Set(safeAssignments.map(a => a.pilgrim_id));
  const unassignedPilgrims = safePilgrims.filter(p => !assignedPilgrimIds.has(p.id));

  // Calculate stats based on PILGRIMS (source of truth), not roomType.total_rooms
  const roomsNeeded = Math.ceil(pilgrimsCount / capacity);
  const occupiedBeds = safeAssignments.length;
  const occupancyPercent = pilgrimsCount > 0 ? Math.round((occupiedBeds / pilgrimsCount) * 100) : 0;

  const handleDragStart = (e: React.DragEvent, pilgrimId: string) => {
    e.dataTransfer.setData(DRAG_TYPE, pilgrimId);
    e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, bedKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverBed(bedKey);
  };

  const handleDragLeave = () => {
    setDragOverBed(null);
  };

  const handleDrop = (e: React.DragEvent, roomNumber: string) => {
    e.preventDefault();
    setDragOverBed(null);
    const pilgrimId = e.dataTransfer.getData(DRAG_TYPE);
    if (pilgrimId) onAssignPilgrim(pilgrimId, roomNumber);
  };

  const getRoomStatus = (roomNumber: string) => {
    const occupants = roomOccupancy[roomNumber] || [];
    if (occupants.length === 0) return 'empty';
    if (occupants.length >= capacity) return 'full';
    return 'partial';
  };

  const areMahrams = (a: Pilgrim | undefined, b: Pilgrim | undefined): boolean => {
    if (!a || !b) return false;
    if (a.spouse_id === b.id || b.spouse_id === a.id) return true;
    if (a.mahram_group_id && a.mahram_group_id === b.mahram_group_id) return true;
    if (a.is_mahram && b.is_mahram) return true;
    return false;
  };

  const getRoomGender = (roomNumber: string): 'male' | 'female' | 'mixed' | 'mixed_mahram' | null => {
    const occupants = roomOccupancy[roomNumber] || [];
    if (occupants.length === 0) return null;
    const pilgrims = occupants.map(o => o.pilgrims).filter(Boolean) as Pilgrim[];
    const genders = pilgrims.map(p => p.gender);
    const hasMale = genders.includes('male');
    const hasFemale = genders.includes('female');
    if (hasMale && hasFemale) {
      const allMahrams = pilgrims.length === 2
        ? areMahrams(pilgrims[0], pilgrims[1])
        : pilgrims.every((p, i) => pilgrims.every((q, j) => i >= j || p.gender === q.gender || areMahrams(p, q)));
      return allMahrams ? 'mixed_mahram' : 'mixed';
    }
    if (hasMale) return 'male';
    if (hasFemale) return 'female';
    return null;
  };

  const statusColors = {
    empty: '#e8f5e9',
    partial: '#fff8e1',
    full: '#ffebee'
  };

  const statusBorderColors = {
    empty: '#4caf50',
    partial: '#ff9800',
    full: '#f44336'
  };

  return (
    <Stack gap="lg">
      {/* Stats Header */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Group>
            <ThemeIcon size="lg" color="teal" variant="light">
              <Home size={20} />
            </ThemeIcon>
            <div>
              <Text fw={600}>{t(roomType.type) || roomType.type}</Text>
              <Text size="xs" c="dimmed">{capacity} {t('beds_per_room') || 'أسرة/غرفة'}</Text>
            </div>
          </Group>
          <Group>
            <Badge size="lg" color="blue">{roomsNeeded} {t('rooms_needed') || 'غرف مطلوبة'}</Badge>
            <Badge size="lg" color="green">{pilgrimsCount} {t('pilgrims') || 'معتمر'}</Badge>
          </Group>
        </Group>
        
        <Progress.Root size="xl">
          <Tooltip label={`${occupiedBeds} / ${pilgrimsCount} ${t('pilgrims_assigned') || 'معتمر تم توزيعهم'}`}>
            <Progress.Section value={occupancyPercent} color={occupancyPercent === 100 ? 'green' : occupancyPercent > 50 ? 'yellow' : 'blue'}>
              <Progress.Label>{occupancyPercent}%</Progress.Label>
            </Progress.Section>
          </Tooltip>
        </Progress.Root>
        
        <Group mt="sm" gap="lg">
          <Group gap="xs">
            <Box w={16} h={16} style={{ backgroundColor: statusColors.empty, border: `2px solid ${statusBorderColors.empty}`, borderRadius: 4 }} />
            <Text size="xs">{t('available') || 'متاح'}</Text>
          </Group>
          <Group gap="xs">
            <Box w={16} h={16} style={{ backgroundColor: statusColors.partial, border: `2px solid ${statusBorderColors.partial}`, borderRadius: 4 }} />
            <Text size="xs">{t('partial') || 'جزئي'}</Text>
          </Group>
          <Group gap="xs">
            <Box w={16} h={16} style={{ backgroundColor: statusColors.full, border: `2px solid ${statusBorderColors.full}`, borderRadius: 4 }} />
            <Text size="xs">{t('full') || 'ممتلئ'}</Text>
          </Group>
        </Group>
      </Paper>

      {/* Room Grid */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
        {allRoomNumbers.map((roomNumber) => {
          const status = getRoomStatus(roomNumber);
          const occupants = roomOccupancy[roomNumber] || [];
          const gender = getRoomGender(roomNumber);
          const canAddMore = occupants.length < capacity && unassignedPilgrims.length > 0;

          return (
            <Card
              key={roomNumber}
              p="sm"
              radius="md"
              withBorder
              style={{
                backgroundColor: statusColors[status],
                borderColor: statusBorderColors[status],
                borderWidth: 2,
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                if (canAddMore) {
                  e.currentTarget.style.cursor = 'default';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Room Header */}
              <Group justify="space-between" mb="xs">
                <Badge 
                  size="sm" 
                  color={status === 'empty' ? 'green' : status === 'partial' ? 'yellow' : 'red'}
                  variant="filled"
                >
                  {roomNumber}
                </Badge>
                <Text size="xs" c="dimmed">
                  {occupants.length}/{capacity}
                </Text>
              </Group>

              {/* Gender indicator */}
              {gender && (
                <Badge 
                  size="xs" 
                  color={gender === 'male' ? 'blue' : gender === 'female' ? 'pink' : gender === 'mixed_mahram' ? 'green' : 'orange'}
                  variant="light"
                  mb="xs"
                >
                  {gender === 'male' ? '♂ ' + (t('male_room') || 'رجال') : 
                   gender === 'female' ? '♀ ' + (t('female_room') || 'نساء') : 
                   gender === 'mixed_mahram' ? '⚤ ' + (t('mixed_room') || 'غرفة مختلطة (محارم)') :
                   '⚤ ' + (t('mixed') || 'مختلط')}
                </Badge>
              )}

              {/* Beds - empty beds: Menu (click) + drop target (drag) */}
              <Group gap={4} wrap="wrap" mb="xs">
                {Array.from({ length: capacity }).map((_, idx) => {
                  const occupant = occupants[idx];
                  const bedKey = `${roomNumber}-${idx}`;
                  const isEmpty = !occupant;
                  const isDropTarget = isEmpty && unassignedPilgrims.length > 0;
                  const isDragOver = dragOverBed === bedKey;
                  const bedBox = (
                    <Box
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: occupant
                          ? (occupant.pilgrims?.gender === 'male' ? '#bbdefb' : '#f8bbd9')
                          : isDragOver ? '#c8e6c9' : '#e0e0e0',
                        border: occupant ? '2px solid ' + (occupant.pilgrims?.gender === 'male' ? '#1976d2' : '#c2185b') : isDragOver ? '2px solid #4caf50' : '2px dashed #999',
                        cursor: isDropTarget ? 'pointer' : undefined,
                        transition: 'all 0.15s ease'
                      }}
                      onDragOver={isDropTarget ? (e) => handleDragOver(e, bedKey) : undefined}
                      onDragLeave={isDropTarget ? handleDragLeave : undefined}
                      onDrop={isDropTarget ? (e) => handleDrop(e, roomNumber) : undefined}
                    >
                      {occupant ? (
                        <User size={14} color={occupant.pilgrims?.gender === 'male' ? '#1976d2' : '#c2185b'} />
                      ) : (
                        <BedDouble size={12} color={isDragOver ? '#4caf50' : '#999'} />
                      )}
                    </Box>
                  );
                  return (
                    <Tooltip
                      key={idx}
                      label={occupant ? (occupant.pilgrims?.full_name_ar || occupant.pilgrims?.full_name || t('occupied')) : (t('click_or_drag_to_add') || 'انقر أو اسحب المعتمر')}
                      withArrow
                    >
                      {isEmpty && isDropTarget ? (
                        <Menu position="bottom-start" shadow="md" width={220} closeOnClickOutside closeOnItemClick>
                          <Menu.Target>{bedBox}</Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Label>{t('assign_pilgrim') || 'اختر المعتمر'}</Menu.Label>
                            {unassignedPilgrims.map((p) => (
                              <Menu.Item
                                key={p.id}
                                leftSection={<User size={14} color={p.gender === 'male' ? '#1976d2' : '#c2185b'} />}
                                onClick={() => onAssignPilgrim(p.id, roomNumber)}
                              >
                                {p.full_name_ar || p.full_name}
                              </Menu.Item>
                            ))}
                          </Menu.Dropdown>
                        </Menu>
                      ) : (
                        bedBox
                      )}
                    </Tooltip>
                  );
                })}
              </Group>

              {/* Occupant names */}
              {occupants.length > 0 && (
                <Stack gap={2}>
                  {occupants.map((occupant) => (
                    <Group key={occupant.id} justify="space-between" gap={4}>
                      <Text size="xs" truncate style={{ flex: 1 }}>
                        {occupant.pilgrims?.full_name_ar || occupant.pilgrims?.full_name || '-'}
                      </Text>
                      <ActionIcon 
                        size="xs" 
                        color="red" 
                        variant="subtle"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAssignment(occupant.id);
                        }}
                      >
                        <X size={12} />
                      </ActionIcon>
                    </Group>
                  ))}
                </Stack>
              )}

              {canAddMore && (
                <Group justify="center" mt="xs" gap={4}>
                  <ThemeIcon size="sm" color="green" variant="light" radius="xl">
                    <UserPlus size={12} />
                  </ThemeIcon>
                  <Text size="xs" c="dimmed">{t('click_or_drag') || 'انقر السرير أو اسحب المعتمر'}</Text>
                </Group>
              )}
            </Card>
          );
        })}
      </SimpleGrid>

      {/* Unassigned Pilgrims - draggable to beds */}
      {unassignedPilgrims.length > 0 && (
        <Paper p="md" withBorder style={{ backgroundColor: '#fff8e1', borderColor: '#ff9800' }}>
          <Group mb="sm" wrap="wrap" gap="xs">
            <AlertCircle size={20} color="#ff9800" />
            <Text fw={600} c="orange">
              {t('unassigned_pilgrims') || 'معتمرين بدون غرف'} ({unassignedPilgrims.length})
            </Text>
            <Text size="xs" c="dimmed">
              {t('drag_to_assign_hint') || 'اسحب وأفلت على سرير لتعيين'}
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
            {unassignedPilgrims.map((pilgrim) => (
              <Card
                key={pilgrim.id}
                p="xs"
                withBorder
                radius="sm"
                draggable
                onDragStart={(e) => handleDragStart(e, pilgrim.id)}
                onDragEnd={handleDragEnd}
                style={{
                  cursor: 'grab',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => e.currentTarget.style.cursor = 'grabbing'}
                onMouseUp={(e) => e.currentTarget.style.cursor = 'grab'}
                onMouseLeave={(e) => e.currentTarget.style.cursor = 'grab'}
              >
                <Group gap="xs">
                  <ThemeIcon 
                    size="sm" 
                    color={pilgrim.gender === 'male' ? 'blue' : 'pink'} 
                    variant="light"
                  >
                    <User size={12} />
                  </ThemeIcon>
                  <Text size="xs" truncate style={{ flex: 1 }}>
                    {pilgrim.full_name_ar || pilgrim.full_name}
                  </Text>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        </Paper>
      )}

      {/* All assigned */}
      {unassignedPilgrims.length === 0 && safePilgrims.length > 0 && (
        <Paper p="md" withBorder style={{ backgroundColor: '#e8f5e9', borderColor: '#4caf50' }}>
          <Group>
            <CheckCircle size={20} color="#4caf50" />
            <Text fw={600} c="green">
              {t('all_pilgrims_assigned') || 'تم توزيع جميع المعتمرين'}
            </Text>
          </Group>
        </Paper>
      )}

    </Stack>
  );
}

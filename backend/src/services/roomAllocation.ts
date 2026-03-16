import { supabaseAdmin as supabase } from './supabase';

interface Pilgrim {
  id: string;
  full_name: string;
  full_name_ar?: string;
  gender: 'male' | 'female';
  mahram_group_id?: string;
  spouse_id?: string;
  parent_id?: string;
  relationship_type?: 'family' | 'married' | 'friends';
  is_mahram?: boolean;
  room_type_id?: string;
  accommodation_id?: string;
  hotel_inventory_ids?: string[] | null;
}

interface RoomType {
  id: string;
  type: string;
  total_beds: number;
  total_rooms: number;
}

interface AllocationResult {
  success: boolean;
  assignments: {
    pilgrim_id: string;
    pilgrim_name: string;
    room_number: string;
    room_type: string;
    group_type: 'mahram' | 'male' | 'female';
  }[];
  warnings: string[];
  unassigned: Pilgrim[];
}

interface AllocationRules {
  separateGenders: boolean;
  allowMahram: boolean;
  preferFamilyGroups: boolean;
}

/**
 * Get room capacity based on room type
 */
function getRoomCapacity(type: string): number {
  const capacities: Record<string, number> = {
    double: 2,
    triple: 3,
    quad: 4,
    quint: 5
  };
  return capacities[type] || 4;
}

/**
 * Group pilgrims by relationships (mahram, family, married, friends)
 */
function groupByMahram(pilgrims: Pilgrim[]): Map<string, Pilgrim[]> {
  const groups = new Map<string, Pilgrim[]>();
  const assigned = new Set<string>();

  // Priority 1: Group by mahram_group_id (explicit mahram groups)
  for (const pilgrim of pilgrims) {
    if (pilgrim.mahram_group_id && !assigned.has(pilgrim.id)) {
      if (!groups.has(pilgrim.mahram_group_id)) {
        groups.set(pilgrim.mahram_group_id, []);
      }
      groups.get(pilgrim.mahram_group_id)!.push(pilgrim);
      assigned.add(pilgrim.id);
    }
  }

  // Priority 2: Group married couples (relationship_type = 'married' or spouse_id)
  for (const pilgrim of pilgrims) {
    if (!assigned.has(pilgrim.id)) {
      // Check if married and has spouse
      if (pilgrim.relationship_type === 'married' && pilgrim.spouse_id) {
        const spouse = pilgrims.find(p => p.id === pilgrim.spouse_id);
        if (spouse && !assigned.has(spouse.id) && (spouse.is_mahram || pilgrim.is_mahram)) {
          const groupId = `married_${pilgrim.id}`;
          groups.set(groupId, [pilgrim, spouse]);
          assigned.add(pilgrim.id);
          assigned.add(spouse.id);
        }
      } else if (pilgrim.spouse_id && !assigned.has(pilgrim.id)) {
        // Legacy spouse_id support
        const spouse = pilgrims.find(p => p.id === pilgrim.spouse_id);
        if (spouse && !assigned.has(spouse.id) && (spouse.is_mahram || pilgrim.is_mahram)) {
          const groupId = `couple_${pilgrim.id}`;
          groups.set(groupId, [pilgrim, spouse]);
          assigned.add(pilgrim.id);
          assigned.add(spouse.id);
        }
      }
    }
  }

  // Priority 3: Group family members (relationship_type = 'family' or parent_id)
  for (const pilgrim of pilgrims) {
    if (!assigned.has(pilgrim.id) && (pilgrim.relationship_type === 'family' || pilgrim.parent_id)) {
      if (pilgrim.parent_id) {
        const parent = pilgrims.find(p => p.id === pilgrim.parent_id);
        if (parent && !assigned.has(parent.id)) {
          const groupId = `family_${parent.id}`;
          if (!groups.has(groupId)) {
            groups.set(groupId, [parent]);
            assigned.add(parent.id);
          }
          groups.get(groupId)!.push(pilgrim);
          assigned.add(pilgrim.id);
        } else if (parent && assigned.has(parent.id)) {
          // Find the group the parent is in and add this pilgrim
          for (const [gid, members] of groups.entries()) {
            if (members.some(m => m.id === parent.id)) {
              members.push(pilgrim);
              assigned.add(pilgrim.id);
              break;
            }
          }
        }
      } else if (pilgrim.relationship_type === 'family') {
        // Group unassigned family members together (siblings, etc.)
        const familyGroup = pilgrims.filter(p => 
          !assigned.has(p.id) && 
          p.relationship_type === 'family' &&
          p.gender === pilgrim.gender // Same gender for non-mahram family
        );
        if (familyGroup.length > 1) {
          const groupId = `family_group_${pilgrim.id}`;
          groups.set(groupId, familyGroup);
          familyGroup.forEach(p => assigned.add(p.id));
        }
      }
    }
  }

  // Priority 4: Group friends (relationship_type = 'friends')
  for (const pilgrim of pilgrims) {
    if (!assigned.has(pilgrim.id) && pilgrim.relationship_type === 'friends') {
      const friendsGroup = pilgrims.filter(p => 
        !assigned.has(p.id) && 
        p.relationship_type === 'friends' &&
        p.gender === pilgrim.gender // Same gender for friends
      );
      if (friendsGroup.length > 1) {
        const groupId = `friends_${pilgrim.id}`;
        groups.set(groupId, friendsGroup);
        friendsGroup.forEach(p => assigned.add(p.id));
      }
    }
  }

  // Priority 5: Group by is_mahram flag (can share room with opposite gender)
  // Note: roomCapacity will be applied when allocating rooms, not here
  for (const pilgrim of pilgrims) {
    if (!assigned.has(pilgrim.id) && pilgrim.is_mahram) {
      // Find opposite gender pilgrims who are also mahram
      const mahramGroup = pilgrims.filter(p => 
        !assigned.has(p.id) && 
        p.gender !== pilgrim.gender &&
        (p.is_mahram || p.relationship_type === 'married')
      );
      if (mahramGroup.length > 0) {
        const groupId = `mahram_${pilgrim.id}`;
        // Limit to reasonable group size (will be further limited by room capacity during allocation)
        groups.set(groupId, [pilgrim, ...mahramGroup.slice(0, 3)]);
        [pilgrim, ...mahramGroup.slice(0, 3)].forEach(p => assigned.add(p.id));
      }
    }
  }

  return groups;
}

/**
 * Build (accommodation_id, room_type_id, pilgrims[]) groups from booking/pilgrim inventory
 */
async function buildHotelPilgrimGroups(
  booking: any,
  pilgrims: Pilgrim[]
): Promise<Array<{ accommodationId: string; roomTypeId: string; roomType: RoomType; pilgrims: Pilgrim[] }>> {
  const sameForAll = (booking as any).same_selection_for_all !== false;
  const bookingHotelIds = (booking as any).hotel_inventory_ids as string[] | null | undefined;

  const groups: Array<{ accommodationId: string; roomTypeId: string; roomType: RoomType; pilgrims: Pilgrim[] }> = [];
  const seen = new Set<string>();

  if (sameForAll && bookingHotelIds && Array.isArray(bookingHotelIds) && bookingHotelIds.length > 0) {
    // Same for all: all pilgrims stay in all selected inventories (multi-hotel)
    for (const invId of bookingHotelIds) {
      if (!invId) continue;
      const { data: inv } = await supabase
        .from('hotel_bed_inventory')
        .select('id, accommodation_id, room_type_id, accommodations (id), room_types (id, type, total_beds, total_rooms)')
        .eq('id', invId)
        .single();
      if (!inv?.accommodation_id || !inv?.room_type_id) continue;
      const accId = inv.accommodation_id;
      const rtId = inv.room_type_id;
      const key = `${accId}|${rtId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const rtData = Array.isArray(inv.room_types) ? inv.room_types[0] : inv.room_types;
      if (!rtData) continue;
      groups.push({
        accommodationId: accId,
        roomTypeId: rtId,
        roomType: rtData as RoomType,
        pilgrims: pilgrims.filter(p => p.gender)
      });
    }
  }

  if (groups.length === 0 && sameForAll && (booking.accommodation_id || pilgrims.some(p => p.accommodation_id))) {
    // Fallback: single accommodation (legacy same-for-all, no hotel_inventory_ids)
    const accId = booking.accommodation_id || pilgrims[0]?.accommodation_id;
    const rtId = booking.room_type_id || pilgrims[0]?.room_type_id;
    if (!accId || !rtId) return groups;

    const { data: rt } = await supabase
      .from('room_types')
      .select('id, type, total_beds, total_rooms')
      .eq('id', rtId)
      .single();
    if (!rt) return groups;

    groups.push({
      accommodationId: accId,
      roomTypeId: rtId,
      roomType: rt as RoomType,
      pilgrims: pilgrims.filter(p => p.gender)
    });
  }

  if (groups.length === 0 && !sameForAll) {
    // Per pilgrim: each pilgrim may have different hotel_inventory_ids
    for (const pilgrim of pilgrims) {
      if (!pilgrim.gender) continue;
      const invIds = pilgrim.hotel_inventory_ids;
      if (!invIds || !Array.isArray(invIds)) {
        const accId = pilgrim.accommodation_id || booking.accommodation_id;
        const rtId = pilgrim.room_type_id || booking.room_type_id;
        if (accId && rtId) {
          const key = `${accId}|${rtId}|${pilgrim.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            const { data: rt } = await supabase.from('room_types').select('id, type, total_beds, total_rooms').eq('id', rtId).single();
            if (rt) {
              const existing = groups.find(g => g.accommodationId === accId && g.roomTypeId === rtId);
              if (existing) existing.pilgrims.push(pilgrim);
              else groups.push({ accommodationId: accId, roomTypeId: rtId, roomType: rt as RoomType, pilgrims: [pilgrim] });
            }
          }
        }
        continue;
      }
      for (const invId of invIds) {
        if (!invId) continue;
        const { data: inv } = await supabase
          .from('hotel_bed_inventory')
          .select('accommodation_id, room_type_id, room_types (id, type, total_beds, total_rooms)')
          .eq('id', invId)
          .single();
        if (!inv?.accommodation_id || !inv?.room_type_id) continue;
        const accId = inv.accommodation_id;
        const rtId = inv.room_type_id;
        const rtData = Array.isArray(inv.room_types) ? inv.room_types[0] : inv.room_types;
        if (!rtData) continue;
        const key = `${accId}|${rtId}`;
        const existing = groups.find(g => g.accommodationId === accId && g.roomTypeId === rtId);
        if (existing) {
          if (!existing.pilgrims.some(p => p.id === pilgrim.id)) existing.pilgrims.push(pilgrim);
        } else {
          groups.push({ accommodationId: accId, roomTypeId: rtId, roomType: rtData as RoomType, pilgrims: [pilgrim] });
        }
      }
    }
  }

  return groups;
}

/**
 * Allocate rooms for one hotel group (single accommodation + room type)
 */
function allocateForGroup(
  pilgrims: Pilgrim[],
  roomType: RoomType,
  accommodationId: string,
  roomTypeId: string,
  bookingId: string,
  rules: AllocationRules,
  roomCounterRef: { value: number },
  prefix: string
): { assignments: any[]; warnings: string[] } {
  const roomCapacity = getRoomCapacity(roomType.type);
  const assignmentsToInsert: any[] = [];
  const warnings: string[] = [];
  let pilgrimsWithGender = [...pilgrims];

  // Step 1: Mahram groups
  if (rules.allowMahram) {
    const mahramGroups = groupByMahram(pilgrimsWithGender);
    for (const [groupId, members] of mahramGroups.entries()) {
      if (members.length <= roomCapacity) {
        const roomNumber = `${prefix}${roomType.type.charAt(0).toUpperCase()}${roomCounterRef.value.toString().padStart(3, '0')}`;
        for (const pilgrim of members) {
          assignmentsToInsert.push({ booking_id: bookingId, accommodation_id: accommodationId, room_type_id: roomTypeId, room_number: roomNumber, pilgrim_id: pilgrim.id });
        }
        roomCounterRef.value++;
        pilgrimsWithGender = pilgrimsWithGender.filter(p => !members.some(m => m.id === p.id));
      }
    }
  }

  const remaining = pilgrimsWithGender.filter(p => !assignmentsToInsert.some(a => a.pilgrim_id === p.id));
  const males = remaining.filter(p => p.gender === 'male');
  const females = remaining.filter(p => p.gender === 'female');

  for (let i = 0; i < males.length; i += roomCapacity) {
    const roomPilgrims = males.slice(i, i + roomCapacity);
    const roomNumber = `${prefix}M${roomCounterRef.value.toString().padStart(3, '0')}`;
    for (const pilgrim of roomPilgrims) {
      assignmentsToInsert.push({ booking_id: bookingId, accommodation_id: accommodationId, room_type_id: roomTypeId, room_number: roomNumber, pilgrim_id: pilgrim.id });
    }
    roomCounterRef.value++;
  }
  for (let i = 0; i < females.length; i += roomCapacity) {
    const roomPilgrims = females.slice(i, i + roomCapacity);
    const roomNumber = `${prefix}F${roomCounterRef.value.toString().padStart(3, '0')}`;
    for (const pilgrim of roomPilgrims) {
      assignmentsToInsert.push({ booking_id: bookingId, accommodation_id: accommodationId, room_type_id: roomTypeId, room_number: roomNumber, pilgrim_id: pilgrim.id });
    }
    roomCounterRef.value++;
  }

  return { assignments: assignmentsToInsert, warnings };
}

/**
 * Auto-allocate rooms for a booking (supports multi-hotel and per-pilgrim)
 */
export async function autoAllocateRooms(
  bookingId: string,
  rules: AllocationRules = { separateGenders: true, allowMahram: true, preferFamilyGroups: true }
): Promise<AllocationResult> {
  const result: AllocationResult = {
    success: false,
    assignments: [],
    warnings: [],
    unassigned: []
  };

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        accommodation_id,
        room_type_id,
        same_selection_for_all,
        hotel_inventory_ids,
        room_types (id, type, total_beds, total_rooms),
        pilgrims (id, full_name, full_name_ar, gender, mahram_group_id, spouse_id, parent_id, relationship_type, is_mahram, room_type_id, accommodation_id, hotel_inventory_ids)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      result.warnings.push('Booking not found');
      return result;
    }

    const pilgrims = (booking.pilgrims || []) as Pilgrim[];
    if (pilgrims.length === 0) {
      result.warnings.push('No pilgrims in booking');
      return result;
    }

    const pilgrimsWithoutGender = pilgrims.filter(p => !p.gender);
    if (pilgrimsWithoutGender.length > 0) {
      result.warnings.push(`${pilgrimsWithoutGender.length} pilgrim(s) without gender`);
      result.unassigned.push(...pilgrimsWithoutGender);
    }

    const groups = await buildHotelPilgrimGroups(booking, pilgrims);
    if (groups.length === 0) {
      result.warnings.push('No accommodation/room type or hotel inventory found. Ensure booking has accommodation and room type, or hotel_inventory_ids (multi-hotel).');
      return result;
    }

    await supabase.from('room_assignments').delete().eq('booking_id', bookingId);

    const allAssignments: any[] = [];
    const roomCounterRef = { value: 1 };

    for (let gIdx = 0; gIdx < groups.length; gIdx++) {
      const g = groups[gIdx];
      const prefix = groups.length > 1 ? `${String.fromCharCode(65 + gIdx)}-` : '';
      const { assignments } = allocateForGroup(
        g.pilgrims,
        g.roomType,
        g.accommodationId,
        g.roomTypeId,
        bookingId,
        rules,
        roomCounterRef,
        prefix
      );
      allAssignments.push(...assignments);
    }

    for (const a of allAssignments) {
      result.assignments.push({
        pilgrim_id: a.pilgrim_id,
        pilgrim_name: pilgrims.find(p => p.id === a.pilgrim_id)?.full_name_ar || pilgrims.find(p => p.id === a.pilgrim_id)?.full_name || '',
        room_number: a.room_number,
        room_type: groups[0]?.roomType?.type || '',
        group_type: 'male' as const
      });
    }

    if (allAssignments.length > 0) {
      const { error: insertError } = await supabase.from('room_assignments').insert(allAssignments);
      if (insertError) {
        result.warnings.push(`Error saving: ${insertError.message}`);
        return result;
      }
    }

    result.success = result.unassigned.length === 0;
    if (result.assignments.length > 0) result.success = true;
    return result;
  } catch (error: any) {
    result.warnings.push(`Allocation error: ${error.message}`);
    return result;
  }
}

/**
 * Validate room assignment against gender rules
 */
export function validateRoomAssignment(
  pilgrims: Pilgrim[],
  rules: AllocationRules
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rules.separateGenders) {
    return { valid: true, errors: [] };
  }

  // Check if mixed genders without mahram relationship
  const males = pilgrims.filter(p => p.gender === 'male');
  const females = pilgrims.filter(p => p.gender === 'female');

  if (males.length > 0 && females.length > 0) {
    // Check if they have mahram relationships
    const allMahram = pilgrims.every(p => {
      // Check if this pilgrim has a mahram relationship with others in the room
      return pilgrims.some(other => 
        other.id !== p.id && (
          p.spouse_id === other.id ||
          p.parent_id === other.id ||
          other.spouse_id === p.id ||
          other.parent_id === p.id ||
          (p.mahram_group_id && p.mahram_group_id === other.mahram_group_id)
        )
      );
    });

    if (!allMahram && !rules.allowMahram) {
      errors.push('Mixed genders in room without mahram relationship');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

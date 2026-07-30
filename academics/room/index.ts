export type {
    Room,
    RoomArtifactRef,
    RoomBooking,
    RoomDateEntry,
    RoomDateFloorEntry,
    RoomFloor,
    RoomFloorOccupancy,
    RoomOccupancy,
} from './occupancy/model';
export {
    assertRoomOccupancyIdentity,
    parseRoomFloorOccupancy,
    parseRoomOccupancy,
    RoomOccupancyContractError,
} from './occupancy/decode';
export type {
    RoomBookingGroup,
    RoomFilters,
    RoomIntent,
    RoomSearchTarget,
} from './query';
export {
    canonicalRoomLabel,
    findAdjacentRoomDate,
    findFloor,
    findFloorDateArtifact,
    findNearestRoomDate,
    findRoomByTarget,
    groupRoomBookings,
    isRoomSearchInput,
    overlapsWindow,
    parseRoomIntent,
    parseRoomQuery,
    pickDefaultDate,
    resolveRoomTarget,
    roomsForFloor,
    sortRoomDates,
    uniqueValues,
} from './query';

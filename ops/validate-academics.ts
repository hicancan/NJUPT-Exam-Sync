import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
    assertClassIndexMatchesManifest,
    assertExamSnapshotIdentity,
    parseExamClassChunk,
    parseExamClassIndex,
    parseExamData,
    parseExamSnapshotManifest,
    selectClassFromChunk,
} from '../academics/exam/snapshot/index.ts';
import {
    assertRoomOccupancyIdentity,
    parseRoomFloorOccupancy,
    parseRoomOccupancy,
} from '../academics/room/index.ts';
import { generateICSContent } from '../academics/exam/calendar.ts';
import {
    assertExamHistoryClassChunkIdentity,
    assertExamHistoryIdentity,
    assertExamHistoryMatchesSnapshot,
    assertExamHistoryPayloads,
    parseExamHistoryClassChunk,
    parseExamHistoryClassIndex,
    parseExamHistoryEvents,
    parseExamHistoryManifest,
    selectExamClassHistory,
} from '../academics/exam/history/index.ts';
import {
    assertTeachingManifestIdentity,
    assertTeachingOccupancyIdentity,
    parseTeachingClassChunk,
    parseTeachingClassIndex,
    parseTeachingManifest,
    parseTeachingMeetingChunk,
    parseTeachingOccupancyManifest,
    parseTeachingPeriods,
    parseTeachingRoomDay,
    parseTeachingTerm,
} from '../academics/timetable/index.ts';
import {
    assertSpaceManifestIdentity,
    parseAliases,
    parseBuildings,
    parseCampuses,
    parseFloors,
    parseSpaceFamilies,
    parseSpaceGeometry,
    parseSpaceManifest,
    parseSpaceUnits,
} from '../academics/space/index.ts';

function argument(name: string): string {
    const index = process.argv.indexOf(name);
    const value = index >= 0 ? process.argv[index + 1] : undefined;
    if (!value) throw new Error(`missing ${name}`);
    return path.resolve(value);
}

interface ArtifactReference {
    path: string;
    bytes: number;
    sha256: string;
}

function json(root: string, relativePath: string): unknown {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as unknown;
}

function artifactJson(root: string, artifact: ArtifactReference): unknown {
    const bytes = artifactBytes(root, artifact);
    return JSON.parse(bytes.toString('utf8')) as unknown;
}

function artifactBytes(root: string, artifact: ArtifactReference): Buffer {
    const resolvedRoot = path.resolve(root);
    const resolved = path.resolve(root, artifact.path);
    if (!resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
        throw new Error(`Artifact path escapes its root: ${artifact.path}`);
    }
    const bytes = readFileSync(resolved);
    if (
        bytes.byteLength !== artifact.bytes
        || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256
    ) {
        throw new Error(`Artifact identity mismatch: ${artifact.path}`);
    }
    return bytes;
}

function filesUnder(root: string, relative = ''): string[] {
    return readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
        const child = relative ? `${relative}/${entry.name}` : entry.name;
        return entry.isDirectory() ? filesUnder(root, child) : [child];
    });
}

function assertExactFiles(root: string, expected: Iterable<string>): void {
    const expectedPaths = [...new Set(['manifest.json', ...expected])].sort();
    const actualPaths = filesUnder(root).sort();
    if (expectedPaths.length !== actualPaths.length || expectedPaths.some((value, index) => value !== actualPaths[index])) {
        throw new Error(`Artifact file set mismatch in ${root}`);
    }
}

const examRoot = argument('--exam');
const historyRoot = argument('--history');
const roomRoot = argument('--room');
const timetableRoot = argument('--timetable');
const classroomsRoot = argument('--classrooms');
const spaceRoot = argument('--space');
const spaceManifest = parseSpaceManifest(json(spaceRoot, 'manifest.json'));
await assertSpaceManifestIdentity(spaceManifest);
const campuses = parseCampuses(artifactJson(spaceRoot, spaceManifest.artifacts.campuses), spaceManifest.artifacts.campuses.path);
const buildings = parseBuildings(artifactJson(spaceRoot, spaceManifest.artifacts.buildings), spaceManifest.artifacts.buildings.path);
const floors = parseFloors(artifactJson(spaceRoot, spaceManifest.artifacts.floors), spaceManifest.artifacts.floors.path);
const spaceFamilies = parseSpaceFamilies(artifactJson(spaceRoot, spaceManifest.artifacts.space_families), spaceManifest.artifacts.space_families.path);
const aliases = parseAliases(artifactJson(spaceRoot, spaceManifest.artifacts.aliases), spaceManifest.artifacts.aliases.path);
const spaceUnits = spaceManifest.artifacts.space_units.flatMap(artifact => parseSpaceUnits(artifactJson(spaceRoot, artifact), artifact.path));
const geometry = spaceManifest.artifacts.geometry.map(artifact => ({
    artifact,
    document: parseSpaceGeometry(artifactJson(spaceRoot, artifact), artifact.path),
}));
const floorById = new Map(floors.map(floor => [floor.floor_id, floor]));
const geometryPaths = new Set<string>();
const planPaths = new Set<string>();
let geometryUnitCount = 0;
for (const { artifact, document: item } of geometry) {
    const floor = floorById.get(item.floor_id);
    if (!floor || floor.geometry_path !== artifact.path || item.source_id !== spaceManifest.source_id) {
        throw new Error(`Space geometry identity mismatch: ${item.floor_id}`);
    }
    if (geometryPaths.has(artifact.path) || planPaths.has(item.plan.path)) {
        throw new Error(`Duplicate Space geometry or plan path: ${item.floor_id}`);
    }
    geometryPaths.add(artifact.path);
    planPaths.add(item.plan.path);
    geometryUnitCount += item.space_units.filter(unit => unit.polygon !== null).length;
    artifactBytes(spaceRoot, item.plan);
}
for (const floor of floors) {
    if (floor.geometry_path !== null && !geometryPaths.has(floor.geometry_path)) {
        throw new Error(`Space floor references missing geometry: ${floor.floor_id}`);
    }
}
assertExactFiles(spaceRoot, [
    spaceManifest.artifacts.campuses.path,
    spaceManifest.artifacts.buildings.path,
    spaceManifest.artifacts.floors.path,
    spaceManifest.artifacts.space_families.path,
    ...spaceManifest.artifacts.space_units.map(artifact => artifact.path),
    spaceManifest.artifacts.aliases.path,
    spaceManifest.artifacts.connectors.path,
    ...spaceManifest.artifacts.geometry.map(artifact => artifact.path),
    ...geometry.map(item => item.document.plan.path),
    spaceManifest.artifacts.audit.path,
]);
if (campuses.length !== spaceManifest.campus_count || buildings.length !== spaceManifest.building_count || floors.length !== spaceManifest.floor_count || spaceFamilies.length !== spaceManifest.space_family_count || spaceUnits.length !== spaceManifest.space_unit_count || geometryUnitCount !== spaceManifest.geometry_unit_count) {
    throw new Error('SpaceSnapshot counts do not match its manifest');
}
const manifest = parseExamSnapshotManifest(json(examRoot, 'manifest.json'));
await assertExamSnapshotIdentity(manifest);
const exams = parseExamData(artifactJson(examRoot, manifest.records), manifest.records.path);
if (exams.length !== manifest.total_records) {
    throw new Error('ExamSnapshot record count mismatch');
}
const classIndex = parseExamClassIndex(
    artifactJson(examRoot, manifest.class_index),
    manifest.class_index.path
);
assertClassIndexMatchesManifest(manifest, classIndex);
const chunks = new Map(
    manifest.class_chunks.map(artifact => [
        artifact.path,
        parseExamClassChunk(artifactJson(examRoot, artifact), artifact.path)
    ])
);
let indexedRecords = 0;
for (const entry of classIndex.classes) {
    const chunk = chunks.get(entry.chunk_path);
    if (!chunk) throw new Error(`Missing class chunk: ${entry.chunk_path}`);
    indexedRecords += selectClassFromChunk(manifest, entry, chunk).length;
}
if (indexedRecords !== exams.length) throw new Error('ExamSnapshot class index is incomplete');

const historyManifest = parseExamHistoryManifest(json(historyRoot, 'manifest.json'));
await assertExamHistoryIdentity(historyManifest);
assertExamHistoryMatchesSnapshot(historyManifest, manifest);
const historyEvents = parseExamHistoryEvents(
    artifactJson(historyRoot, historyManifest.events),
    historyManifest.events.path,
);
const historyIndex = parseExamHistoryClassIndex(
    artifactJson(historyRoot, historyManifest.class_index),
    historyManifest.class_index.path,
);
assertExamHistoryPayloads(historyManifest, historyEvents, historyIndex);
const historyChunks = new Map();
for (const artifact of historyManifest.class_chunks) {
    const chunk = parseExamHistoryClassChunk(
        artifactJson(historyRoot, artifact),
        artifact.path,
    );
    await assertExamHistoryClassChunkIdentity(chunk);
    historyChunks.set(artifact.path, chunk);
}
for (const entry of historyIndex.classes) {
    const chunk = historyChunks.get(entry.chunk_path);
    if (!chunk) throw new Error(`Missing ExamHistory class chunk: ${entry.chunk_path}`);
    selectExamClassHistory(historyManifest, entry, chunk);
}

const calendarClass = classIndex.classes[0];
if (!calendarClass) throw new Error('ExamSnapshot has no class for ICS validation');
const calendarChunk = chunks.get(calendarClass.chunk_path);
if (!calendarChunk) throw new Error(`Missing class chunk: ${calendarClass.chunk_path}`);
const calendarExams = selectClassFromChunk(manifest, calendarClass, calendarChunk);
const calendar = generateICSContent(
    calendarExams,
    calendarClass.class_name,
    [30],
    { appName: 'njupt-search-validation', domain: 'local.njupt-search' }
);
if (calendar.split('BEGIN:VEVENT').length - 1 !== calendarExams.length) {
    throw new Error('ICS event count mismatch');
}

const roomManifest = parseRoomOccupancy(json(roomRoot, 'manifest.json'));
await assertRoomOccupancyIdentity(roomManifest);
if (
    roomManifest.exam_snapshot_id !== manifest.snapshot_id
    || roomManifest.exam_period_id !== manifest.exam_period.id
    || roomManifest.space_snapshot_id !== spaceManifest.snapshot_id
) {
    throw new Error('RoomOccupancy does not identify its ExamSnapshot');
}
let roomSlices = 0;
for (const date of roomManifest.dates) {
    for (const floor of date.floors) {
        const slice = parseRoomFloorOccupancy(
            artifactJson(roomRoot, floor.artifact),
            floor.artifact.path
        );
        if (
            slice.exam_snapshot_id !== roomManifest.exam_snapshot_id
            || slice.space_snapshot_id !== roomManifest.space_snapshot_id
            || slice.date !== date.date
            || slice.floor_id !== floor.floor_id
        ) {
            throw new Error(`RoomOccupancy floor identity mismatch: ${floor.artifact.path}`);
        }
        roomSlices += 1;
    }
}

const teachingManifest = parseTeachingManifest(json(timetableRoot, 'manifest.json'));
await assertTeachingManifestIdentity(teachingManifest);
const teachingTerm = parseTeachingTerm(artifactJson(timetableRoot, teachingManifest.term), teachingManifest.term.path);
const teachingPeriods = parseTeachingPeriods(artifactJson(timetableRoot, teachingManifest.periods), teachingManifest.periods.path);
const teachingIndex = parseTeachingClassIndex(artifactJson(timetableRoot, teachingManifest.class_index), teachingManifest.class_index.path);
if (teachingManifest.space_snapshot_id !== spaceManifest.snapshot_id) {
    throw new Error('TeachingSchedule and SpaceSnapshot identity mismatch');
}
if (teachingTerm.source_id !== teachingManifest.source_id || teachingPeriods.source_id !== teachingManifest.source_id || teachingIndex.source_id !== teachingManifest.source_id) {
    throw new Error('TeachingSchedule component source identity mismatch');
}
const teachingClasses = new Map();
for (const artifact of teachingManifest.class_chunks) {
    const classes = parseTeachingClassChunk(artifactJson(timetableRoot, artifact), artifact.path);
    for (const [classId, value] of Object.entries(classes)) teachingClasses.set(classId, value);
}
const teachingMeetings = new Map();
for (const artifact of teachingManifest.meeting_chunks) {
    const meetings = parseTeachingMeetingChunk(artifactJson(timetableRoot, artifact), artifact.path);
    for (const [meetingId, value] of Object.entries(meetings)) teachingMeetings.set(meetingId, value);
}
if (teachingClasses.size !== teachingManifest.class_count || teachingMeetings.size !== teachingManifest.meeting_count) {
    throw new Error('TeachingSchedule counts do not match its chunks');
}
for (const entry of teachingIndex.classes) {
    const teachingClass = teachingClasses.get(entry.class_id);
    if (!teachingClass || teachingClass.meeting_ids.some((meetingId: string) => !teachingMeetings.has(meetingId))) {
        throw new Error(`TeachingSchedule class index is incomplete: ${entry.class_id}`);
    }
}

const teachingOccupancy = parseTeachingOccupancyManifest(json(classroomsRoot, 'manifest.json'));
await assertTeachingOccupancyIdentity(teachingOccupancy);
if (teachingOccupancy.teaching_snapshot_id !== teachingManifest.snapshot_id || teachingOccupancy.exam_snapshot_id !== manifest.snapshot_id || teachingOccupancy.space_snapshot_id !== spaceManifest.snapshot_id) {
    throw new Error('TeachingRoomOccupancy component identity mismatch');
}
let teachingDays = 0;
for (const entry of teachingOccupancy.days) {
    const day = parseTeachingRoomDay(artifactJson(classroomsRoot, entry.artifact), entry.artifact.path);
    if (day.teaching_snapshot_id !== teachingManifest.snapshot_id || day.week !== entry.week || day.weekday !== entry.weekday) {
        throw new Error(`TeachingRoomOccupancy day identity mismatch: ${entry.artifact.path}`);
    }
    teachingDays += 1;
}

process.stdout.write(`${JSON.stringify({
    exam_snapshot_id: manifest.snapshot_id,
    exams: exams.length,
    classes: classIndex.classes.length,
    class_chunks: manifest.class_chunks.length,
    exam_history_id: historyManifest.history_id,
    observed_exam_snapshots: historyManifest.observed_snapshot_count,
    history_classes: historyIndex.classes.length,
    ics_class: calendarClass.class_name,
    ics_events: calendarExams.length,
    room_occupancy_id: roomManifest.occupancy_id,
    unresolved_exam_locations: roomManifest.unresolved_locations.length,
    room_slices: roomSlices,
    teaching_snapshot_id: teachingManifest.snapshot_id,
    teaching_classes: teachingClasses.size,
    teaching_meetings: teachingMeetings.size,
    teaching_room_occupancy_id: teachingOccupancy.occupancy_id,
    unresolved_teaching_locations: teachingOccupancy.unresolved_locations.length,
    teaching_days: teachingDays,
    space_snapshot_id: spaceManifest.snapshot_id,
    campuses: campuses.length,
    buildings: buildings.length,
    floors: floors.length,
    space_families: spaceFamilies.length,
    space_units: spaceUnits.length,
    aliases: aliases.length,
}, null, 2)}\n`);

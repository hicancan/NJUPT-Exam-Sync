import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
    const bytes = readFileSync(path.join(root, artifact.path));
    if (
        bytes.byteLength !== artifact.bytes
        || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256
    ) {
        throw new Error(`Artifact identity mismatch: ${artifact.path}`);
    }
    return JSON.parse(bytes.toString('utf8')) as unknown;
}

const examRoot = argument('--exam');
const historyRoot = argument('--history');
const roomRoot = argument('--room');
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
            || slice.room_catalog_id !== roomManifest.room_catalog_id
            || slice.date !== date.date
            || slice.floor_key !== floor.floor_key
        ) {
            throw new Error(`RoomOccupancy floor identity mismatch: ${floor.artifact.path}`);
        }
        roomSlices += 1;
    }
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
    rooms: roomManifest.rooms.length,
    room_slices: roomSlices,
}, null, 2)}\n`);

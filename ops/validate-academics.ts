import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
    assertClassDataMatchesIndex,
    assertClassIndexMatchesManifest,
    assertExamSnapshotIdentity,
    assertManifestMatchesExams,
    parseExamClassData,
    parseExamClassIndex,
    parseExamData,
    parseManifest,
} from '../academics/exam/snapshot/index.ts';
import {
    parseExamClassHistory,
    parseExamHistoryManifest,
} from '../academics/exam/history/index.ts';
import {
    assertRoomOccupancyIdentity,
    parseRoomFloorOccupancy,
    parseRoomOccupancy,
} from '../academics/room/index.ts';
import { generateICSContent } from '../academics/calendar/ics.ts';

function argument(name: string): string {
    const index = process.argv.indexOf(name);
    const value = index >= 0 ? process.argv[index + 1] : undefined;
    if (!value) throw new Error(`missing ${name}`);
    return path.resolve(value);
}

function json(root: string, relativePath: string): unknown {
    return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8')) as unknown;
}

interface ArtifactReference {
    path: string;
    bytes: number;
    sha256: string;
}

function artifactJson(root: string, artifact: ArtifactReference): unknown {
    const bytes = readFileSync(path.join(root, artifact.path));
    if (bytes.byteLength !== artifact.bytes) {
        throw new Error(`Artifact size mismatch: ${artifact.path}`);
    }
    if (createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) {
        throw new Error(`Artifact hash mismatch: ${artifact.path}`);
    }
    return JSON.parse(bytes.toString('utf8')) as unknown;
}

const examRoot = argument('--exam');
const roomRoot = argument('--room');
const manifest = parseManifest(json(examRoot, 'manifest.json'), 'ExamSnapshot/manifest.json');
await assertExamSnapshotIdentity(manifest);
const exams = parseExamData(
    artifactJson(examRoot, manifest.artifacts.records),
    manifest.artifacts.records.path,
);
const classIndex = parseExamClassIndex(
    artifactJson(examRoot, manifest.artifacts.class_index),
    manifest.artifacts.class_index.path,
);
const historyManifest = parseExamHistoryManifest(
    artifactJson(examRoot, manifest.artifacts.history_manifest),
    manifest.artifacts.history_manifest.path,
);
assertManifestMatchesExams(manifest, exams);
assertClassIndexMatchesManifest(manifest, classIndex);
const historyByClass = new Map(
    historyManifest.classes.map(entry => [entry.class_key, entry]),
);

for (const entry of classIndex.classes) {
    const classData = parseExamClassData(
        artifactJson(examRoot, entry.data),
        entry.data.path,
    );
    assertClassDataMatchesIndex(entry, classData, manifest.data_version);
    const history = parseExamClassHistory(
        artifactJson(examRoot, entry.history),
        entry.history.path,
    );
    if (
        history.class_key !== entry.class_key
        || history.class_name !== entry.class_name
        || history.exam_period_id !== manifest.exam_period_id
        || history.latest_data_version !== manifest.data_version
    ) {
        throw new Error(`ExamSnapshot history identity mismatch: ${entry.class_name}`);
    }
    const manifestHistory = historyByClass.get(entry.class_key);
    if (
        !manifestHistory
        || JSON.stringify(manifestHistory.artifact) !== JSON.stringify(entry.history)
    ) {
        throw new Error(`ExamSnapshot history reference mismatch: ${entry.class_name}`);
    }
}
if (
    historyManifest.latest_data_version !== manifest.data_version
    || historyManifest.exam_period_id !== manifest.exam_period_id
    || historyManifest.classes.length !== classIndex.classes.length
) {
    throw new Error('ExamSnapshot history manifest identity mismatch');
}

const calendarClass = classIndex.classes[0];
if (!calendarClass) throw new Error('ExamSnapshot has no class for calendar validation');
const calendarExams = exams.filter(exam => exam.class_name === calendarClass.class_name);
const calendar = generateICSContent(
    calendarExams,
    calendarClass.class_name,
    [30],
    { appName: 'njupt-search-validation', domain: 'local.njupt-search' },
);
const calendarEvents = calendar.split('BEGIN:VEVENT').length - 1;
if (
    !calendar.startsWith('BEGIN:VCALENDAR\r\n')
    || !calendar.endsWith('END:VCALENDAR')
    || calendarEvents !== calendarExams.length
) {
    throw new Error(`ExamSchedule/ICS validation failed: ${calendarClass.class_name}`);
}

const roomManifest = parseRoomOccupancy(json(roomRoot, 'manifest.json'));
await assertRoomOccupancyIdentity(roomManifest);
if (
    roomManifest.data_version !== manifest.data_version
    || roomManifest.exam_period_id !== manifest.exam_period_id
) {
    throw new Error('RoomOccupancy does not identify its input ExamSnapshot');
}
let roomSlices = 0;
for (const date of roomManifest.dates) {
    for (const floor of date.floors) {
        const slice = parseRoomFloorOccupancy(
            artifactJson(roomRoot, floor.artifact),
            floor.artifact.path,
        );
        if (
            slice.data_version !== roomManifest.data_version
            || slice.exam_period_id !== roomManifest.exam_period_id
            || slice.date !== date.date
            || slice.floor_key !== floor.floor_key
        ) {
            throw new Error(`RoomOccupancy slice identity mismatch: ${floor.artifact.path}`);
        }
        roomSlices += 1;
    }
}
artifactJson(roomRoot, roomManifest.diagnostics);

process.stdout.write(`${JSON.stringify({
    exam_snapshot_id: manifest.snapshot_id,
    exams: exams.length,
    classes: classIndex.classes.length,
    history_snapshots: historyManifest.snapshots.length,
    ics_class: calendarClass.class_name,
    ics_events: calendarEvents,
    ics_bytes: new TextEncoder().encode(calendar).byteLength,
    room_occupancy_id: roomManifest.occupancy_id,
    rooms: roomManifest.rooms.length,
    room_slices: roomSlices,
}, null, 2)}\n`);

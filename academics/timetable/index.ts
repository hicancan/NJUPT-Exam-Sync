export interface ArtifactRef {
    path: string;
    bytes: number;
    sha256: string;
}

export interface TeachingWeek {
    week: number;
    start_date: string;
    end_date: string;
}

export interface TeachingPeriod {
    period: number;
    start_time: string;
    end_time: string;
    day_part: string;
}

export interface TeachingSnapshotManifest {
    format: 'njupt-teaching-schedule';
    snapshot_id: string;
    source_id: string;
    observed_at: string;
    academic_year: string;
    term_number: number;
    week_count: number;
    class_count: number;
    meeting_count: number;
    term: ArtifactRef;
    periods: ArtifactRef;
    class_index: ArtifactRef;
    class_chunks: ArtifactRef[];
    meeting_chunks: ArtifactRef[];
}

export interface TeachingClassIndexEntry {
    class_id: string;
    class_name: string;
    meeting_count: number;
    chunk_path: string;
    chunk_id: string;
}

export interface TeachingClassIndex {
    format: 'njupt-teaching-class-index';
    source_id: string;
    class_count: number;
    meeting_count: number;
    classes: TeachingClassIndexEntry[];
    meeting_chunks: Array<{ meeting_id: string; chunk_path: string }>;
}

export interface TeachingClass {
    class_id: string;
    class_name: string;
    grade: string | null;
    college: string | null;
    major: string | null;
    direction: string | null;
    level: string | null;
    campus: string | null;
    meeting_ids: string[];
}

export interface TeachingMeeting {
    meeting_id: string;
    teaching_class_id: string | null;
    teaching_class_name: string | null;
    course_code: string | null;
    course_name: string;
    course_category: string | null;
    course_nature: string | null;
    teacher: string | null;
    teacher_title: string | null;
    instructor_role: string | null;
    campus: string | null;
    space_family_id: string | null;
    space_unit_id: string | null;
    location: string | null;
    location_type: string | null;
    weekday: number;
    start_period: number;
    end_period: number;
    week_numbers: number[];
    teaching_method: string | null;
    assessment_method: string | null;
    exam_method: string | null;
    credits: number | null;
    class_hours: number | null;
    course_total_hours: number | null;
    class_hours_composition: string | null;
    weekly_hours: number | null;
    teaching_class_size: number | null;
    enrollment_count: number | null;
    capacity: number | null;
    enrollment_note: string | null;
    direction: string | null;
    online_information: string | null;
    scheduling_flag: string | null;
    class_ids: string[];
}

export interface TeachingTerm {
    format: 'njupt-teaching-term';
    source_id: string;
    academic_year: string;
    term_number: number;
    weeks: TeachingWeek[];
}

export interface TeachingPeriods {
    format: 'njupt-teaching-periods';
    source_id: string;
    periods: TeachingPeriod[];
}

export interface TeachingRoomOccupancyManifest {
    format: 'njupt-teaching-room-occupancy';
    occupancy_id: string;
    teaching_snapshot_id: string;
    exam_snapshot_id: string;
    space_snapshot_id: string;
    academic_year: string;
    term_number: number;
    weeks: TeachingWeek[];
    periods: TeachingPeriod[];
    unresolved_locations: Array<{ location: string; count: number }>;
    days: Array<{ week: number; weekday: number; artifact: ArtifactRef }>;
}

export interface TeachingRoomBooking {
    meeting_id: string;
    course_name: string;
    course_code: string | null;
    class_ids: string[];
    teacher: string | null;
    campus: string;
    building: string;
    floor: string;
    floor_id: string;
    room: string;
    space_family_id: string;
    space_unit_id: string | null;
    location: string | null;
    start_period: number;
    end_period: number;
}

export interface TeachingRoomDay {
    format: 'njupt-teaching-room-day';
    teaching_snapshot_id: string;
    week: number;
    weekday: number;
    periods: Record<string, TeachingRoomBooking[]>;
}

export class TeachingContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TeachingContractError';
    }
}

const SHA256 = /^[a-f0-9]{64}$/;
const object = (value: unknown, source: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TeachingContractError(`${source}: must be an object`);
    return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, keys: string[], source: string): void => {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
        throw new TeachingContractError(`${source}: incompatible fields`);
    }
};
const text = (value: unknown, source: string): string => {
    if (typeof value !== 'string' || !value) throw new TeachingContractError(`${source}: must be a non-empty string`);
    return value;
};
const nullableText = (value: unknown, source: string): string | null => value === null ? null : text(value, source);
const integer = (value: unknown, source: string, minimum = 0): number => {
    if (!Number.isSafeInteger(value) || Number(value) < minimum) throw new TeachingContractError(`${source}: must be an integer >= ${minimum}`);
    return Number(value);
};
const nullableNumber = (value: unknown, source: string): number | null => {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TeachingContractError(`${source}: must be a number or null`);
    return value;
};
const hash = (value: unknown, source: string): string => {
    const result = text(value, source);
    if (!SHA256.test(result)) throw new TeachingContractError(`${source}: must be a SHA-256`);
    return result;
};
const stringArray = (value: unknown, source: string): string[] => {
    if (!Array.isArray(value)) throw new TeachingContractError(`${source}: must be an array`);
    return value.map((item, index) => text(item, `${source}[${index}]`));
};
const artifact = (value: unknown, source: string): ArtifactRef => {
    const result = object(value, source);
    exact(result, ['path', 'bytes', 'sha256'], source);
    return { path: text(result.path, `${source}.path`), bytes: integer(result.bytes, `${source}.bytes`), sha256: hash(result.sha256, `${source}.sha256`) };
};

const parseWeek = (value: unknown, source: string): TeachingWeek => {
    const result = object(value, source);
    exact(result, ['week', 'start_date', 'end_date'], source);
    return { week: integer(result.week, `${source}.week`, 1), start_date: text(result.start_date, `${source}.start_date`), end_date: text(result.end_date, `${source}.end_date`) };
};

const parsePeriod = (value: unknown, source: string): TeachingPeriod => {
    const result = object(value, source);
    exact(result, ['period', 'start_time', 'end_time', 'day_part'], source);
    return { period: integer(result.period, `${source}.period`, 1), start_time: text(result.start_time, `${source}.start_time`), end_time: text(result.end_time, `${source}.end_time`), day_part: text(result.day_part, `${source}.day_part`) };
};

export const parseTeachingManifest = (value: unknown, source = 'TeachingSchedule manifest'): TeachingSnapshotManifest => {
    const result = object(value, source);
    exact(result, ['format','snapshot_id','source_id','observed_at','academic_year','term_number','week_count','class_count','meeting_count','term','periods','class_index','class_chunks','meeting_chunks'], source);
    if (result.format !== 'njupt-teaching-schedule' || !Array.isArray(result.class_chunks) || !Array.isArray(result.meeting_chunks)) {
        throw new TeachingContractError(`${source}: incompatible format`);
    }
    return {
        format: 'njupt-teaching-schedule', snapshot_id: hash(result.snapshot_id, `${source}.snapshot_id`), source_id: hash(result.source_id, `${source}.source_id`),
        observed_at: text(result.observed_at, `${source}.observed_at`), academic_year: text(result.academic_year, `${source}.academic_year`), term_number: integer(result.term_number, `${source}.term_number`, 1),
        week_count: integer(result.week_count, `${source}.week_count`, 1), class_count: integer(result.class_count, `${source}.class_count`, 1), meeting_count: integer(result.meeting_count, `${source}.meeting_count`),
        term: artifact(result.term, `${source}.term`), periods: artifact(result.periods, `${source}.periods`), class_index: artifact(result.class_index, `${source}.class_index`),
        class_chunks: result.class_chunks.map((item, index) => artifact(item, `${source}.class_chunks[${index}]`)), meeting_chunks: result.meeting_chunks.map((item, index) => artifact(item, `${source}.meeting_chunks[${index}]`)),
    };
};

export const parseTeachingClassIndex = (value: unknown, source = 'TeachingSchedule class index'): TeachingClassIndex => {
    const result = object(value, source);
    exact(result, ['format','source_id','class_count','meeting_count','classes','meeting_chunks'], source);
    if (result.format !== 'njupt-teaching-class-index' || !Array.isArray(result.classes) || !Array.isArray(result.meeting_chunks)) throw new TeachingContractError(`${source}: incompatible format`);
    const classes = result.classes.map((item, index) => {
        const entrySource = `${source}.classes[${index}]`;
        const entry = object(item, entrySource);
        exact(entry, ['class_id','class_name','meeting_count','chunk_path','chunk_id'], entrySource);
        return { class_id: text(entry.class_id, `${entrySource}.class_id`), class_name: text(entry.class_name, `${entrySource}.class_name`), meeting_count: integer(entry.meeting_count, `${entrySource}.meeting_count`), chunk_path: text(entry.chunk_path, `${entrySource}.chunk_path`), chunk_id: hash(entry.chunk_id, `${entrySource}.chunk_id`) };
    });
    const meetingChunks = result.meeting_chunks.map((item, index) => {
        const entrySource = `${source}.meeting_chunks[${index}]`;
        const entry = object(item, entrySource);
        exact(entry, ['meeting_id','chunk_path'], entrySource);
        return { meeting_id: text(entry.meeting_id, `${entrySource}.meeting_id`), chunk_path: text(entry.chunk_path, `${entrySource}.chunk_path`) };
    });
    return { format:'njupt-teaching-class-index', source_id:hash(result.source_id, `${source}.source_id`), class_count:integer(result.class_count, `${source}.class_count`,1), meeting_count:integer(result.meeting_count, `${source}.meeting_count`), classes, meeting_chunks:meetingChunks };
};

const CLASS_KEYS = ['class_id','class_name','grade','college','major','direction','level','campus','meeting_ids'];
export const parseTeachingClassChunk = (value: unknown, source = 'TeachingSchedule class chunk'): Record<string, TeachingClass> => {
    const result = object(value, source);
    exact(result, ['format','source_id','chunk_id','classes'], source);
    if (result.format !== 'njupt-teaching-class-chunk') throw new TeachingContractError(`${source}: incompatible format`);
    hash(result.source_id, `${source}.source_id`); hash(result.chunk_id, `${source}.chunk_id`);
    const classes = object(result.classes, `${source}.classes`);
    return Object.fromEntries(Object.entries(classes).map(([classId, item]) => {
        const entry = object(item, `${source}.${classId}`); exact(entry, CLASS_KEYS, `${source}.${classId}`);
        const parsed: TeachingClass = { class_id:text(entry.class_id, `${source}.${classId}.class_id`), class_name:text(entry.class_name, `${source}.${classId}.class_name`), grade:nullableText(entry.grade, `${source}.${classId}.grade`), college:nullableText(entry.college, `${source}.${classId}.college`), major:nullableText(entry.major, `${source}.${classId}.major`), direction:nullableText(entry.direction, `${source}.${classId}.direction`), level:nullableText(entry.level, `${source}.${classId}.level`), campus:nullableText(entry.campus, `${source}.${classId}.campus`), meeting_ids:stringArray(entry.meeting_ids, `${source}.${classId}.meeting_ids`) };
        if (parsed.class_id !== classId) throw new TeachingContractError(`${source}.${classId}: class identity mismatch`);
        return [classId, parsed];
    }));
};

const MEETING_KEYS = ['meeting_id','teaching_class_id','teaching_class_name','course_code','course_name','course_category','course_nature','teacher','teacher_title','instructor_role','campus','space_family_id','space_unit_id','location','location_type','weekday','start_period','end_period','week_numbers','teaching_method','assessment_method','exam_method','credits','class_hours','course_total_hours','class_hours_composition','weekly_hours','teaching_class_size','enrollment_count','capacity','enrollment_note','direction','online_information','scheduling_flag','class_ids'];
export const parseTeachingMeetingChunk = (value: unknown, source = 'TeachingSchedule meeting chunk'): Record<string, TeachingMeeting> => {
    const result = object(value, source); exact(result, ['format','source_id','chunk_id','meetings'], source);
    if (result.format !== 'njupt-teaching-meeting-chunk') throw new TeachingContractError(`${source}: incompatible format`);
    hash(result.source_id, `${source}.source_id`); hash(result.chunk_id, `${source}.chunk_id`);
    const meetings = object(result.meetings, `${source}.meetings`);
    return Object.fromEntries(Object.entries(meetings).map(([meetingId, item]) => {
        const entry = object(item, `${source}.${meetingId}`); exact(entry, MEETING_KEYS, `${source}.${meetingId}`);
        if (entry.meeting_id !== meetingId || !Array.isArray(entry.week_numbers)) throw new TeachingContractError(`${source}.${meetingId}: meeting identity mismatch`);
        const parsed = {
            ...Object.fromEntries(MEETING_KEYS.map(key => [key, entry[key]])),
            meeting_id: text(entry.meeting_id, `${source}.${meetingId}.meeting_id`), course_name:text(entry.course_name, `${source}.${meetingId}.course_name`),
            teaching_class_id:nullableText(entry.teaching_class_id, `${source}.${meetingId}.teaching_class_id`), teaching_class_name:nullableText(entry.teaching_class_name, `${source}.${meetingId}.teaching_class_name`), course_code:nullableText(entry.course_code, `${source}.${meetingId}.course_code`),
            course_category:nullableText(entry.course_category, `${source}.${meetingId}.course_category`), course_nature:nullableText(entry.course_nature, `${source}.${meetingId}.course_nature`), teacher:nullableText(entry.teacher, `${source}.${meetingId}.teacher`), teacher_title:nullableText(entry.teacher_title, `${source}.${meetingId}.teacher_title`), instructor_role:nullableText(entry.instructor_role, `${source}.${meetingId}.instructor_role`), campus:nullableText(entry.campus, `${source}.${meetingId}.campus`), space_family_id:nullableText(entry.space_family_id, `${source}.${meetingId}.space_family_id`), space_unit_id:nullableText(entry.space_unit_id, `${source}.${meetingId}.space_unit_id`), location:nullableText(entry.location, `${source}.${meetingId}.location`), location_type:nullableText(entry.location_type, `${source}.${meetingId}.location_type`),
            weekday:integer(entry.weekday, `${source}.${meetingId}.weekday`,1), start_period:integer(entry.start_period, `${source}.${meetingId}.start_period`,1), end_period:integer(entry.end_period, `${source}.${meetingId}.end_period`,1), week_numbers:entry.week_numbers.map((week,index)=>integer(week,`${source}.${meetingId}.week_numbers[${index}]`,1)),
            teaching_method:nullableText(entry.teaching_method, `${source}.${meetingId}.teaching_method`), assessment_method:nullableText(entry.assessment_method, `${source}.${meetingId}.assessment_method`), exam_method:nullableText(entry.exam_method, `${source}.${meetingId}.exam_method`), credits:nullableNumber(entry.credits, `${source}.${meetingId}.credits`), class_hours:nullableNumber(entry.class_hours, `${source}.${meetingId}.class_hours`), course_total_hours:nullableNumber(entry.course_total_hours, `${source}.${meetingId}.course_total_hours`), class_hours_composition:nullableText(entry.class_hours_composition, `${source}.${meetingId}.class_hours_composition`), weekly_hours:nullableNumber(entry.weekly_hours, `${source}.${meetingId}.weekly_hours`), teaching_class_size:nullableNumber(entry.teaching_class_size, `${source}.${meetingId}.teaching_class_size`), enrollment_count:nullableNumber(entry.enrollment_count, `${source}.${meetingId}.enrollment_count`), capacity:nullableNumber(entry.capacity, `${source}.${meetingId}.capacity`), enrollment_note:nullableText(entry.enrollment_note, `${source}.${meetingId}.enrollment_note`), direction:nullableText(entry.direction, `${source}.${meetingId}.direction`), online_information:nullableText(entry.online_information, `${source}.${meetingId}.online_information`), scheduling_flag:nullableText(entry.scheduling_flag, `${source}.${meetingId}.scheduling_flag`), class_ids:stringArray(entry.class_ids, `${source}.${meetingId}.class_ids`),
        } as TeachingMeeting;
        if (parsed.weekday > 7 || parsed.end_period < parsed.start_period) throw new TeachingContractError(`${source}.${meetingId}: invalid schedule range`);
        return [meetingId, parsed];
    }));
};

export const parseTeachingTerm = (value: unknown, source = 'TeachingSchedule term'): TeachingTerm => {
    const result=object(value,source); exact(result,['format','source_id','academic_year','term_number','weeks'],source);
    if(result.format!=='njupt-teaching-term'||!Array.isArray(result.weeks)) throw new TeachingContractError(`${source}: incompatible format`);
    return {format:'njupt-teaching-term',source_id:hash(result.source_id,`${source}.source_id`),academic_year:text(result.academic_year,`${source}.academic_year`),term_number:integer(result.term_number,`${source}.term_number`,1),weeks:result.weeks.map((item,index)=>parseWeek(item,`${source}.weeks[${index}]`))};
};

export const parseTeachingPeriods = (value: unknown, source = 'TeachingSchedule periods'): TeachingPeriods => {
    const result=object(value,source); exact(result,['format','source_id','periods'],source);
    if(result.format!=='njupt-teaching-periods'||!Array.isArray(result.periods)) throw new TeachingContractError(`${source}: incompatible format`);
    return {format:'njupt-teaching-periods',source_id:hash(result.source_id,`${source}.source_id`),periods:result.periods.map((item,index)=>parsePeriod(item,`${source}.periods[${index}]`))};
};

export const parseTeachingOccupancyManifest=(value:unknown,source='TeachingRoomOccupancy manifest'):TeachingRoomOccupancyManifest=>{
    const result=object(value,source);exact(result,['format','occupancy_id','teaching_snapshot_id','exam_snapshot_id','space_snapshot_id','academic_year','term_number','weeks','periods','unresolved_locations','days'],source);
    if(result.format!=='njupt-teaching-room-occupancy'||!Array.isArray(result.weeks)||!Array.isArray(result.periods)||!Array.isArray(result.unresolved_locations)||!Array.isArray(result.days)) throw new TeachingContractError(`${source}: incompatible format`);
    const unresolved_locations=result.unresolved_locations.map((item,index)=>{const s=`${source}.unresolved_locations[${index}]`;const entry=object(item,s);exact(entry,['location','count'],s);return {location:text(entry.location,`${s}.location`),count:integer(entry.count,`${s}.count`,1)}});
    const days=result.days.map((item,index)=>{const s=`${source}.days[${index}]`;const entry=object(item,s);exact(entry,['week','weekday','artifact'],s);return {week:integer(entry.week,`${s}.week`,1),weekday:integer(entry.weekday,`${s}.weekday`,1),artifact:artifact(entry.artifact,`${s}.artifact`)}});
    return {format:'njupt-teaching-room-occupancy',occupancy_id:hash(result.occupancy_id,`${source}.occupancy_id`),teaching_snapshot_id:hash(result.teaching_snapshot_id,`${source}.teaching_snapshot_id`),exam_snapshot_id:hash(result.exam_snapshot_id,`${source}.exam_snapshot_id`),space_snapshot_id:hash(result.space_snapshot_id,`${source}.space_snapshot_id`),academic_year:text(result.academic_year,`${source}.academic_year`),term_number:integer(result.term_number,`${source}.term_number`,1),weeks:result.weeks.map((item,index)=>parseWeek(item,`${source}.weeks[${index}]`)),periods:result.periods.map((item,index)=>parsePeriod(item,`${source}.periods[${index}]`)),unresolved_locations,days};
};

export const parseTeachingRoomDay=(value:unknown,source='TeachingRoomOccupancy day'):TeachingRoomDay=>{
    const result=object(value,source);exact(result,['format','teaching_snapshot_id','week','weekday','periods'],source);
    if(result.format!=='njupt-teaching-room-day') throw new TeachingContractError(`${source}: incompatible format`);
    const periodsObject=object(result.periods,`${source}.periods`); const periods:Record<string,TeachingRoomBooking[]>={};
    for(const [period,items] of Object.entries(periodsObject)){if(!Array.isArray(items)) throw new TeachingContractError(`${source}.periods.${period}: must be an array`);periods[period]=items.map((item,index)=>{const s=`${source}.periods.${period}[${index}]`;const entry=object(item,s);exact(entry,['meeting_id','course_name','course_code','class_ids','teacher','campus','building','floor','floor_id','room','space_family_id','space_unit_id','location','start_period','end_period'],s);return {meeting_id:text(entry.meeting_id,`${s}.meeting_id`),course_name:text(entry.course_name,`${s}.course_name`),course_code:nullableText(entry.course_code,`${s}.course_code`),class_ids:stringArray(entry.class_ids,`${s}.class_ids`),teacher:nullableText(entry.teacher,`${s}.teacher`),campus:text(entry.campus,`${s}.campus`),building:text(entry.building,`${s}.building`),floor:text(entry.floor,`${s}.floor`),floor_id:text(entry.floor_id,`${s}.floor_id`),room:text(entry.room,`${s}.room`),space_family_id:text(entry.space_family_id,`${s}.space_family_id`),space_unit_id:nullableText(entry.space_unit_id,`${s}.space_unit_id`),location:nullableText(entry.location,`${s}.location`),start_period:integer(entry.start_period,`${s}.start_period`,1),end_period:integer(entry.end_period,`${s}.end_period`,1)}})}
    return {format:'njupt-teaching-room-day',teaching_snapshot_id:hash(result.teaching_snapshot_id,`${source}.teaching_snapshot_id`),week:integer(result.week,`${source}.week`,1),weekday:integer(result.weekday,`${source}.weekday`,1),periods};
};

const canonicalJson=(value:unknown):string=>{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return`[${value.map(canonicalJson).join(',')}]`;const record=value as Record<string,unknown>;return`{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`};
const digest=async(value:unknown):Promise<string>=>{const bytes=new TextEncoder().encode(canonicalJson(value));const result=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(result),byte=>byte.toString(16).padStart(2,'0')).join('')};
export const assertTeachingManifestIdentity=async(manifest:TeachingSnapshotManifest):Promise<void>=>{const {snapshot_id,...identity}=manifest;if(await digest(identity)!==snapshot_id)throw new TeachingContractError('TeachingScheduleSnapshot identity mismatch')};
export const assertTeachingOccupancyIdentity=async(manifest:TeachingRoomOccupancyManifest):Promise<void>=>{const {occupancy_id,...identity}=manifest;if(await digest(identity)!==occupancy_id)throw new TeachingContractError('TeachingRoomOccupancy identity mismatch')};

export interface SpaceArtifactRef { path: string; bytes: number; sha256: string }
export interface SpaceManifest {
    format: 'njupt-space-snapshot';
    snapshot_id: string;
    source_id: string;
    campus_count: number;
    building_count: number;
    floor_count: number;
    space_family_count: number;
    space_unit_count: number;
    geometry_unit_count: number;
    unresolved_count: number;
    artifacts: {
        campuses: SpaceArtifactRef;
        buildings: SpaceArtifactRef;
        floors: SpaceArtifactRef;
        space_families: SpaceArtifactRef;
        space_units: SpaceArtifactRef[];
        aliases: SpaceArtifactRef;
        connectors: SpaceArtifactRef;
        geometry: SpaceArtifactRef[];
        audit: SpaceArtifactRef;
    };
}
export interface Campus {
    campus_id: string; name: string; aliases: string[]; coordinate_system: string;
    point: [number, number] | null; footprint: number[][] | null; geometry_accuracy: string; evidence_refs: string[];
}
export interface Building {
    building_id: string; campus_id: string; name: string; aliases: string[];
    point: [number, number] | null; footprint: number[][] | null; floor_ids: string[];
    geometry_accuracy: string; evidence_refs: string[];
}
export interface Floor {
    floor_id: string; building_id: string; level: string; outline: number[][] | null;
    local_coordinate_system: string; north_rotation_degrees: number | null; north_confidence: string;
    space_unit_ids: string[]; connector_ids: string[];
    source_image_refs: Array<{ sha256: string; review_status: string }>;
    geometry_accuracy: string; geometry_path: string | null;
}
export interface SpaceFamily {
    space_family_id: string; building_id: string; floor_id: string; room_number: string;
    aliases: string[]; space_unit_ids: string[]; evidence_status: string;
    availability_eligible: 'eligible' | 'unknown' | 'ineligible';
}
export interface SpaceUnit {
    space_unit_id: string; space_family_id: string; canonical_label: string; raw_labels: string[];
    space_type: string; availability_eligible: 'eligible' | 'unknown' | 'ineligible';
    geometry_confidence: string; identity_confidence: string; evidence_refs: string[];
}
export interface SpaceAlias {
    alias: string; normalized_alias: string; sources: string[];
    status: 'resolved' | 'ambiguous' | 'non_physical' | 'unresolved';
    space_family_id: string | null; space_unit_id: string | null;
}
export interface SpaceGeometry {
    format: 'njupt-space-geometry'; source_id: string; floor_id: string;
    coordinate_system: string; geometry_accuracy: string;
    view_box: [number, number]; plan: SpaceArtifactRef;
    space_units: Array<{
        space_unit_id: string; geometry_status: string;
        label_point: [number, number] | null; polygon: number[][] | null;
    }>;
}

export class SpaceContractError extends Error {
    constructor(message: string) { super(message); this.name = 'SpaceContractError'; }
}

const HASH = /^[a-f0-9]{64}$/;
const record = (value: unknown, source: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SpaceContractError(`${source}: must be an object`);
    return value as Record<string, unknown>;
};
const exact = (value: Record<string, unknown>, keys: string[], source: string): void => {
    const actual = Object.keys(value).sort(); const expected = [...keys].sort();
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new SpaceContractError(`${source}: incompatible fields`);
};
const text = (value: unknown, source: string): string => {
    if (typeof value !== 'string' || !value) throw new SpaceContractError(`${source}: must be a non-empty string`); return value;
};
const nullableText = (value: unknown, source: string): string | null => value === null ? null : text(value, source);
const hash = (value: unknown, source: string): string => { const parsed = text(value, source); if (!HASH.test(parsed)) throw new SpaceContractError(`${source}: must be SHA-256`); return parsed; };
const integer = (value: unknown, source: string): number => { if (!Number.isSafeInteger(value) || Number(value) < 0) throw new SpaceContractError(`${source}: must be a non-negative integer`); return Number(value); };
const strings = (value: unknown, source: string): string[] => { if (!Array.isArray(value)) throw new SpaceContractError(`${source}: must be an array`); return value.map((item, index) => text(item, `${source}[${index}]`)); };
const point = (value: unknown, source: string): [number, number] | null => {
    if (value === null) return null;
    if (!Array.isArray(value) || value.length !== 2 || value.some(number => typeof number !== 'number' || number < 0 || number > 1)) throw new SpaceContractError(`${source}: invalid normalized point`);
    return [Number(value[0]), Number(value[1])];
};
const polygon = (value: unknown, source: string): number[][] | null => {
    if (value === null) return null;
    if (!Array.isArray(value) || value.length < 4) throw new SpaceContractError(`${source}: invalid polygon`);
    const parsed = value.map((item, index) => point(item, `${source}[${index}]`));
    if (parsed.some(item => item === null)) throw new SpaceContractError(`${source}: polygon points cannot be null`);
    const result = parsed as [number, number][];
    const last = result[result.length - 1];
    if (result[0]?.[0] !== last?.[0] || result[0]?.[1] !== last?.[1]) throw new SpaceContractError(`${source}: polygon must be closed`);
    return result;
};
const artifact = (value: unknown, source: string): SpaceArtifactRef => {
    const item = record(value, source); exact(item, ['path','bytes','sha256'], source);
    return { path: text(item.path, `${source}.path`), bytes: integer(item.bytes, `${source}.bytes`), sha256: hash(item.sha256, `${source}.sha256`) };
};

export const parseSpaceManifest = (value: unknown, source = 'SpaceSnapshot manifest'): SpaceManifest => {
    const item = record(value, source);
    exact(item, ['format','snapshot_id','source_id','campus_count','building_count','floor_count','space_family_count','space_unit_count','geometry_unit_count','unresolved_count','artifacts'], source);
    if (item.format !== 'njupt-space-snapshot') throw new SpaceContractError(`${source}: incompatible format`);
    const refs = record(item.artifacts, `${source}.artifacts`);
    exact(refs, ['campuses','buildings','floors','space_families','space_units','aliases','connectors','geometry','audit'], `${source}.artifacts`);
    if (!Array.isArray(refs.space_units) || !Array.isArray(refs.geometry)) throw new SpaceContractError(`${source}: chunk references must be arrays`);
    return {
        format: 'njupt-space-snapshot', snapshot_id: hash(item.snapshot_id, `${source}.snapshot_id`), source_id: hash(item.source_id, `${source}.source_id`),
        campus_count: integer(item.campus_count, `${source}.campus_count`), building_count: integer(item.building_count, `${source}.building_count`), floor_count: integer(item.floor_count, `${source}.floor_count`),
        space_family_count: integer(item.space_family_count, `${source}.space_family_count`), space_unit_count: integer(item.space_unit_count, `${source}.space_unit_count`), geometry_unit_count: integer(item.geometry_unit_count, `${source}.geometry_unit_count`), unresolved_count: integer(item.unresolved_count, `${source}.unresolved_count`),
        artifacts: {
            campuses: artifact(refs.campuses, `${source}.artifacts.campuses`), buildings: artifact(refs.buildings, `${source}.artifacts.buildings`), floors: artifact(refs.floors, `${source}.artifacts.floors`), space_families: artifact(refs.space_families, `${source}.artifacts.space_families`),
            space_units: refs.space_units.map((entry, index) => artifact(entry, `${source}.artifacts.space_units[${index}]`)), aliases: artifact(refs.aliases, `${source}.artifacts.aliases`), connectors: artifact(refs.connectors, `${source}.artifacts.connectors`), geometry: refs.geometry.map((entry, index) => artifact(entry, `${source}.artifacts.geometry[${index}]`)), audit: artifact(refs.audit, `${source}.artifacts.audit`),
        },
    };
};

const parseDocument = (value: unknown, format: string, key: string, source: string): unknown[] => {
    const item = record(value, source); exact(item, ['format','source_id',key], source);
    if (item.format !== format || !Array.isArray(item[key])) throw new SpaceContractError(`${source}: incompatible format`);
    hash(item.source_id, `${source}.source_id`); return item[key];
};
export const parseCampuses = (value: unknown, source = 'Space campuses'): Campus[] => parseDocument(value,'njupt-space-campuses','campuses',source).map((entry,index) => {
    const s=`${source}[${index}]`; const item=record(entry,s); exact(item,['campus_id','name','aliases','coordinate_system','point','footprint','geometry_accuracy','evidence_refs'],s);
    return {campus_id:text(item.campus_id,`${s}.campus_id`),name:text(item.name,`${s}.name`),aliases:strings(item.aliases,`${s}.aliases`),coordinate_system:text(item.coordinate_system,`${s}.coordinate_system`),point:point(item.point,`${s}.point`),footprint:polygon(item.footprint,`${s}.footprint`),geometry_accuracy:text(item.geometry_accuracy,`${s}.geometry_accuracy`),evidence_refs:strings(item.evidence_refs,`${s}.evidence_refs`)};
});
export const parseBuildings = (value: unknown, source = 'Space buildings'): Building[] => parseDocument(value,'njupt-space-buildings','buildings',source).map((entry,index) => {
    const s=`${source}[${index}]`; const item=record(entry,s); exact(item,['building_id','campus_id','name','aliases','point','footprint','floor_ids','geometry_accuracy','evidence_refs'],s);
    return {building_id:text(item.building_id,`${s}.building_id`),campus_id:text(item.campus_id,`${s}.campus_id`),name:text(item.name,`${s}.name`),aliases:strings(item.aliases,`${s}.aliases`),point:point(item.point,`${s}.point`),footprint:polygon(item.footprint,`${s}.footprint`),floor_ids:strings(item.floor_ids,`${s}.floor_ids`),geometry_accuracy:text(item.geometry_accuracy,`${s}.geometry_accuracy`),evidence_refs:strings(item.evidence_refs,`${s}.evidence_refs`)};
});
export const parseFloors = (value: unknown, source = 'Space floors'): Floor[] => parseDocument(value,'njupt-space-floors','floors',source).map((entry,index) => {
    const s=`${source}[${index}]`; const item=record(entry,s); exact(item,['floor_id','building_id','level','outline','local_coordinate_system','north_rotation_degrees','north_confidence','space_unit_ids','connector_ids','source_image_refs','geometry_accuracy','geometry_path'],s);
    if (item.north_rotation_degrees !== null && typeof item.north_rotation_degrees !== 'number') throw new SpaceContractError(`${s}.north_rotation_degrees: invalid`);
    if (!Array.isArray(item.source_image_refs)) throw new SpaceContractError(`${s}.source_image_refs: invalid`);
    return {floor_id:text(item.floor_id,`${s}.floor_id`),building_id:text(item.building_id,`${s}.building_id`),level:text(item.level,`${s}.level`),outline:polygon(item.outline,`${s}.outline`),local_coordinate_system:text(item.local_coordinate_system,`${s}.local_coordinate_system`),north_rotation_degrees:item.north_rotation_degrees as number|null,north_confidence:text(item.north_confidence,`${s}.north_confidence`),space_unit_ids:strings(item.space_unit_ids,`${s}.space_unit_ids`),connector_ids:strings(item.connector_ids,`${s}.connector_ids`),source_image_refs:item.source_image_refs.map((entry,refIndex)=>{const r=record(entry,`${s}.source_image_refs[${refIndex}]`);exact(r,['sha256','review_status'],`${s}.source_image_refs[${refIndex}]`);return {sha256:hash(r.sha256,`${s}.source_image_refs[${refIndex}].sha256`),review_status:text(r.review_status,`${s}.source_image_refs[${refIndex}].review_status`)}}),geometry_accuracy:text(item.geometry_accuracy,`${s}.geometry_accuracy`),geometry_path:nullableText(item.geometry_path,`${s}.geometry_path`)};
});
const eligibility = (value: unknown, source: string): 'eligible'|'unknown'|'ineligible' => { if(value!=='eligible'&&value!=='unknown'&&value!=='ineligible') throw new SpaceContractError(`${source}: invalid eligibility`); return value; };
export const parseSpaceFamilies = (value: unknown, source = 'Space families'): SpaceFamily[] => parseDocument(value,'njupt-space-families','space_families',source).map((entry,index)=>{const s=`${source}[${index}]`;const item=record(entry,s);exact(item,['space_family_id','building_id','floor_id','room_number','aliases','space_unit_ids','evidence_status','availability_eligible'],s);return {space_family_id:text(item.space_family_id,`${s}.space_family_id`),building_id:text(item.building_id,`${s}.building_id`),floor_id:text(item.floor_id,`${s}.floor_id`),room_number:text(item.room_number,`${s}.room_number`),aliases:strings(item.aliases,`${s}.aliases`),space_unit_ids:strings(item.space_unit_ids,`${s}.space_unit_ids`),evidence_status:text(item.evidence_status,`${s}.evidence_status`),availability_eligible:eligibility(item.availability_eligible,`${s}.availability_eligible`)}});
export const parseSpaceUnits = (value: unknown, source = 'Space units'): SpaceUnit[] => parseDocument(value,'njupt-space-units','space_units',source).map((entry,index)=>{const s=`${source}[${index}]`;const item=record(entry,s);exact(item,['space_unit_id','space_family_id','canonical_label','raw_labels','space_type','availability_eligible','geometry_confidence','identity_confidence','evidence_refs'],s);return {space_unit_id:text(item.space_unit_id,`${s}.space_unit_id`),space_family_id:text(item.space_family_id,`${s}.space_family_id`),canonical_label:text(item.canonical_label,`${s}.canonical_label`),raw_labels:strings(item.raw_labels,`${s}.raw_labels`),space_type:text(item.space_type,`${s}.space_type`),availability_eligible:eligibility(item.availability_eligible,`${s}.availability_eligible`),geometry_confidence:text(item.geometry_confidence,`${s}.geometry_confidence`),identity_confidence:text(item.identity_confidence,`${s}.identity_confidence`),evidence_refs:strings(item.evidence_refs,`${s}.evidence_refs`)}});
export const parseAliases = (value: unknown, source = 'Space aliases'): SpaceAlias[] => parseDocument(value,'njupt-space-aliases','aliases',source).map((entry,index)=>{const s=`${source}[${index}]`;const item=record(entry,s);exact(item,['alias','normalized_alias','sources','status','space_family_id','space_unit_id'],s);if(item.status!=='resolved'&&item.status!=='ambiguous'&&item.status!=='non_physical'&&item.status!=='unresolved')throw new SpaceContractError(`${s}.status: invalid`);return {alias:text(item.alias,`${s}.alias`),normalized_alias:text(item.normalized_alias,`${s}.normalized_alias`),sources:strings(item.sources,`${s}.sources`),status:item.status,space_family_id:nullableText(item.space_family_id,`${s}.space_family_id`),space_unit_id:nullableText(item.space_unit_id,`${s}.space_unit_id`)}});
export const parseSpaceGeometry = (value: unknown, source = 'Space geometry'): SpaceGeometry => {const item=record(value,source);exact(item,['format','source_id','floor_id','coordinate_system','geometry_accuracy','view_box','plan','space_units'],source);if(item.format!=='njupt-space-geometry'||!Array.isArray(item.space_units)||!Array.isArray(item.view_box)||item.view_box.length!==2||item.view_box.some(value=>!Number.isSafeInteger(value)||Number(value)<=0))throw new SpaceContractError(`${source}: incompatible format`);return {format:'njupt-space-geometry',source_id:hash(item.source_id,`${source}.source_id`),floor_id:text(item.floor_id,`${source}.floor_id`),coordinate_system:text(item.coordinate_system,`${source}.coordinate_system`),geometry_accuracy:text(item.geometry_accuracy,`${source}.geometry_accuracy`),view_box:[Number(item.view_box[0]),Number(item.view_box[1])],plan:artifact(item.plan,`${source}.plan`),space_units:item.space_units.map((entry,index)=>{const s=`${source}.space_units[${index}]`;const unit=record(entry,s);exact(unit,['space_unit_id','geometry_status','label_point','polygon'],s);return {space_unit_id:text(unit.space_unit_id,`${s}.space_unit_id`),geometry_status:text(unit.geometry_status,`${s}.geometry_status`),label_point:point(unit.label_point,`${s}.label_point`),polygon:polygon(unit.polygon,`${s}.polygon`)}})}};

const canonicalJson=(value:unknown):string=>{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return`[${value.map(canonicalJson).join(',')}]`;const item=value as Record<string,unknown>;return`{${Object.keys(item).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(item[key])}`).join(',')}}`};
export const assertSpaceManifestIdentity=async(manifest:SpaceManifest):Promise<void>=>{const{snapshot_id,...identity}=manifest;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonicalJson(identity)));const actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');if(actual!==snapshot_id)throw new SpaceContractError('SpaceSnapshot identity mismatch')};

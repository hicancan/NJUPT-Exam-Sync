import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpaceGeometry, SpaceUnit } from '@njupt-search/academics-space';
import type { SpaceClient, SpaceFamilyView } from './model/SpaceClient';
import './space.css';
import './spacePlan.css';

export type SpatialRoomState = 'free' | 'teaching' | 'exam' | 'both' | 'non-teaching' | 'unknown';

interface SpatialViewportProps {
    client: SpaceClient;
    campusName: string;
    buildingName: string;
    buildingId: string;
    floorId: string;
    floorLevel: string;
    northConfidence: string;
    families: SpaceFamilyView[];
    roomState: (familyId: string) => SpatialRoomState;
    detail?: (family: SpaceFamilyView) => React.ReactNode;
}

interface LoadedFloor {
    key: string;
    geometry: SpaceGeometry | null;
    planUrl: string | null;
    units: SpaceUnit[];
}

const STATE_LABEL: Record<SpatialRoomState, string> = {
    free: '未发现占用', teaching: '课程占用', exam: '考试占用', both: '课程与考试占用',
    'non-teaching': '非教学空间', unknown: '未确认空间',
};

const EVIDENCE_LABEL: Record<string, string> = {
    floor_plan_and_schedule: '平面图与教学或考试安排相互印证',
    floor_plan_only: '平面图中可见，本期安排未使用',
    schedule_only_geometry_missing: '安排中已使用，平面位置尚未采集',
    unresolved: '空间身份尚未确认',
};

const points = (polygon: number[][], width: number, height: number): string => polygon.map(point => `${Number(point[0]) * width},${Number(point[1]) * height}`).join(' ');

export function SpatialViewport({
    client, campusName, buildingName, buildingId, floorId, floorLevel, northConfidence, families, roomState, detail,
}: SpatialViewportProps) {
    const [loaded, setLoaded] = useState<LoadedFloor | null>(null);
    const [error, setError] = useState<{ key: string; message: string } | null>(null);
    const [selected, setSelected] = useState<SpaceFamilyView | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [drag, setDrag] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
    const selectedTrigger = useRef<SVGElement | null>(null);
    const detailPanel = useRef<HTMLElement | null>(null);
    const loadKey = `${buildingId}:${floorId}`;

    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            client.loadFloorGeometry(floorId, controller.signal).then(async geometry => ({
                geometry,
                planUrl: geometry ? await client.loadFloorPlan(geometry, controller.signal) : null,
            })),
            client.loadBuildingUnits(buildingId, controller.signal),
        ]).then(([floorView, units]) => setLoaded({ key: loadKey, ...floorView, units })).catch(reason => {
            if (controller.signal.aborted) return;
            setError({ key: loadKey, message: reason instanceof Error ? reason.message : '楼层空间加载失败' });
        });
        return () => controller.abort();
    }, [buildingId, client, floorId, loadKey]);

    useEffect(() => {
        if (!selected) return;
        const panel = detailPanel.current;
        panel?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSelected(null);
                window.setTimeout(() => selectedTrigger.current?.focus(), 0);
                return;
            }
            if (event.key !== 'Tab' || !panel) return;
            const focusable = [...panel.querySelectorAll<HTMLElement>('button,[href],[tabindex]:not([tabindex="-1"])')]
                .filter(element => !element.hasAttribute('disabled'));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
    }, [selected]);

    const current = loaded?.key === loadKey ? loaded : null;
    const currentError = error?.key === loadKey ? error.message : null;
    const visibleSelected = selected && families.some(item => item.family.space_family_id === selected.family.space_family_id) ? selected : null;
    const familyByUnit = useMemo(() => new Map(families.flatMap(family => family.family.space_unit_ids.map(unitId => [unitId, family] as const))), [families]);
    const unitById = useMemo(() => new Map((current?.units ?? []).map(unit => [unit.space_unit_id, unit])), [current]);
    const geometryUnits = current?.geometry?.space_units ?? [];
    const viewWidth = current?.geometry?.view_box[0] ?? 1000;
    const viewHeight = current?.geometry?.view_box[1] ?? 1000;
    const close = () => {
        setSelected(null);
        window.setTimeout(() => selectedTrigger.current?.focus(), 0);
    };
    const stateFor = (family: SpaceFamilyView): SpatialRoomState => family.family.availability_eligible === 'ineligible'
        ? 'non-teaching'
        : family.family.availability_eligible === 'unknown'
            ? 'unknown'
            : roomState(family.family.space_family_id);
    const choose = (family: SpaceFamilyView, element: SVGElement) => {
        selectedTrigger.current = element;
        setSelected(family);
    };

    return (
        <section className="spatial-shell" aria-label={`${campusName}${buildingName}${floorLevel}楼空间图`}>
            <header className="spatial-header">
                <div><p>{campusName} · {buildingName}</p><h2>{floorLevel}楼空间图</h2></div>
                <div className="spatial-zoom" aria-label="空间图缩放">
                    <button type="button" onClick={() => setZoom(value => Math.max(.8, value - .25))} aria-label="缩小"><Minus /></button>
                    <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} aria-label="重置视图"><RotateCcw /></button>
                    <button type="button" onClick={() => setZoom(value => Math.min(3, value + .25))} aria-label="放大"><Plus /></button>
                </div>
            </header>
            <div className="spatial-notice">{northConfidence === 'unknown' ? '原图未证明北向；当前按原图方向展示，不声明测绘精度。' : '已按核验的北向展示；图形为语义示意，不是工程测绘图。'}</div>
            {currentError ? <p className="spatial-error">{currentError}</p> : null}
            {!current && !currentError ? <div className="spatial-loading skeleton-block" /> : null}
            {current ? (
                <div className="spatial-stage">
                    {current.geometry && current.planUrl ? (
                        <svg
                            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
                            preserveAspectRatio="xMidYMid meet"
                            role="img"
                            aria-label={`${buildingName}${floorLevel}楼房间分布`}
                            onWheel={event => { event.preventDefault(); setZoom(value => Math.max(.8, Math.min(3, value + (event.deltaY < 0 ? .15 : -.15)))); }}
                            onPointerDown={event => { if ((event.target as Element).closest('.spatial-room')) return; event.currentTarget.setPointerCapture(event.pointerId); setDrag({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }); }}
                            onPointerMove={event => { if (!drag) return; setPan({ x: drag.panX + (event.clientX - drag.x) / zoom, y: drag.panY + (event.clientY - drag.y) / zoom }); }}
                            onPointerUp={() => setDrag(null)}
                        >
                            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                                <image className="spatial-plan" href={current.planUrl} x="0" y="0" width={viewWidth} height={viewHeight} preserveAspectRatio="none" />
                                {geometryUnits.map(geometryUnit => {
                                    const family = familyByUnit.get(geometryUnit.space_unit_id);
                                    const unit = unitById.get(geometryUnit.space_unit_id);
                                    if (!geometryUnit.polygon || !family || !unit) return null;
                                    const state = stateFor(family);
                                    const label = family.family.room_number;
                                    return <g
                                        key={geometryUnit.space_unit_id}
                                        className={`spatial-room spatial-room-${state}`}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`${label}，${STATE_LABEL[state]}`}
                                        onClick={event => choose(family, event.currentTarget)}
                                        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(family, event.currentTarget); } }}
                                    >
                                        <title>{`${label}，${STATE_LABEL[state]}`}</title>
                                        <polygon points={points(geometryUnit.polygon, viewWidth, viewHeight)} />
                                    </g>;
                                })}
                            </g>
                        </svg>
                    ) : (
                        <div className="spatial-missing"><p>本层暂时没有可公开的核验几何。</p><div className="spatial-room-list">{families.map(family => <button key={family.family.space_family_id} type="button" onClick={event => choose(family, event.currentTarget as unknown as SVGElement)}>{family.family.room_number}<small>{STATE_LABEL[roomState(family.family.space_family_id)]}</small></button>)}</div></div>
                    )}
                </div>
            ) : null}
            <footer className="spatial-legend">{(['free','teaching','exam','both','non-teaching','unknown'] as const).map(state => <span key={state}><i className={`spatial-swatch spatial-room-${state}`} />{STATE_LABEL[state]}</span>)}</footer>
            {visibleSelected ? <div className="space-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}>
                <aside ref={detailPanel} tabIndex={-1} className="space-detail-panel" role="dialog" aria-modal="true" aria-labelledby="space-detail-title">
                    <div className="space-detail-handle" aria-hidden="true" />
                    <header><div><p>{visibleSelected.campus.name} · {visibleSelected.building.name} · {visibleSelected.floor.level}楼</p><h2 id="space-detail-title">{visibleSelected.family.room_number}</h2></div><button autoFocus type="button" onClick={close} aria-label="关闭空间详情"><X /></button></header>
                    <div className="space-detail-body">
                        <dl><div><dt>当前状态</dt><dd>{STATE_LABEL[stateFor(visibleSelected)]}</dd></div><div><dt>空间依据</dt><dd>{EVIDENCE_LABEL[visibleSelected.family.evidence_status] ?? '空间依据尚未确认'}</dd></div><div><dt>空教室资格</dt><dd>{visibleSelected.family.availability_eligible === 'eligible' ? '教学空间候选' : visibleSelected.family.availability_eligible === 'ineligible' ? '非教学空间' : '尚未确认'}</dd></div>{visibleSelected.family.aliases.length ? <div><dt>其他名称</dt><dd>{visibleSelected.family.aliases.join('、')}</dd></div> : null}</dl>
                        {detail?.(visibleSelected)}
                        <p className="space-detail-caveat">空间图用于理解楼层和已发布占用关系，不代表消防疏散图或工程测绘成果。</p>
                    </div>
                </aside>
            </div> : null}
        </section>
    );
}

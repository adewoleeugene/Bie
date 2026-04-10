/**
 * Per-view config helpers.
 *
 * View `config` is `Json?` in Prisma. Shape depends on view type:
 *   TABLE    — (reserved; not used yet)
 *   BOARD    — { groupByPropertyId?: string }
 *   GALLERY  — { titlePropertyId?: string }
 *   CALENDAR — { datePropertyId?: string; titlePropertyId?: string }
 */

/**
 * Cross-cutting view options that apply to every view type:
 * - sort: ordered list of (propertyId, direction) pairs
 * - filters: AND-ed list of equality / contains predicates
 * - hidden columns: property ids hidden in this view
 *
 * Stored alongside the per-view-type fields in the same `view.config` blob.
 */
export interface ViewSort {
    propertyId: string;
    direction: "asc" | "desc";
}

export type ViewFilterOp =
    | "equals"
    | "notEquals"
    | "contains"
    | "isEmpty"
    | "isNotEmpty"
    | "linksTo"
    | "doesNotLinkTo";

export interface ViewFilter {
    propertyId: string;
    op: ViewFilterOp;
    value?: unknown;
}

export interface ViewOptions {
    sorts?: ViewSort[];
    filters?: ViewFilter[];
    hiddenPropertyIds?: string[];
}

export interface BoardViewConfig extends ViewOptions {
    groupByPropertyId?: string;
}

export interface GalleryViewConfig extends ViewOptions {
    titlePropertyId?: string;
    coverPropertyId?: string;
}

export interface CalendarViewConfig extends ViewOptions {
    datePropertyId?: string;
    titlePropertyId?: string;
}

export type TimelineZoom = "day" | "week" | "month";

export interface TimelineViewConfig extends ViewOptions {
    startDatePropertyId?: string;
    endDatePropertyId?: string;
    titlePropertyId?: string;
    /** Optional SELECT/STATUS property used to render swimlanes. */
    groupByPropertyId?: string;
    zoom?: TimelineZoom;
}

export interface TableViewConfig extends ViewOptions {}

function obj(raw: unknown): Record<string, unknown> {
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function str(raw: unknown): string | undefined {
    return typeof raw === "string" ? raw : undefined;
}

export function parseViewOptions(raw: unknown): ViewOptions {
    const o = obj(raw);
    const sorts = Array.isArray(o.sorts)
        ? (o.sorts as unknown[]).filter(
              (s): s is ViewSort =>
                  !!s &&
                  typeof s === "object" &&
                  typeof (s as ViewSort).propertyId === "string" &&
                  ((s as ViewSort).direction === "asc" ||
                      (s as ViewSort).direction === "desc"),
          )
        : undefined;
    const filters = Array.isArray(o.filters)
        ? (o.filters as unknown[]).filter(
              (f): f is ViewFilter =>
                  !!f &&
                  typeof f === "object" &&
                  typeof (f as ViewFilter).propertyId === "string" &&
                  typeof (f as ViewFilter).op === "string",
          )
        : undefined;
    const hiddenPropertyIds = Array.isArray(o.hiddenPropertyIds)
        ? (o.hiddenPropertyIds as unknown[]).filter(
              (x): x is string => typeof x === "string",
          )
        : undefined;
    return { sorts, filters, hiddenPropertyIds };
}

export function parseBoardConfig(raw: unknown): BoardViewConfig {
    const o = obj(raw);
    return {
        ...parseViewOptions(raw),
        groupByPropertyId: str(o.groupByPropertyId),
    };
}

export function parseTableConfig(raw: unknown): TableViewConfig {
    return parseViewOptions(raw);
}

export function parseGalleryConfig(raw: unknown): GalleryViewConfig {
    const o = obj(raw);
    return {
        ...parseViewOptions(raw),
        titlePropertyId: str(o.titlePropertyId),
        coverPropertyId: str(o.coverPropertyId),
    };
}

export function parseCalendarConfig(raw: unknown): CalendarViewConfig {
    const o = obj(raw);
    return {
        ...parseViewOptions(raw),
        datePropertyId: str(o.datePropertyId),
        titlePropertyId: str(o.titlePropertyId),
    };
}

export function parseTimelineConfig(raw: unknown): TimelineViewConfig {
    const o = obj(raw);
    const z = str(o.zoom);
    const zoom: TimelineZoom =
        z === "day" || z === "week" || z === "month" ? z : "day";
    return {
        ...parseViewOptions(raw),
        startDatePropertyId: str(o.startDatePropertyId),
        endDatePropertyId: str(o.endDatePropertyId),
        titlePropertyId: str(o.titlePropertyId),
        groupByPropertyId: str(o.groupByPropertyId),
        zoom,
    };
}

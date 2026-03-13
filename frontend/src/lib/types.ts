export type CardType =
    | 'metric'
    | 'timeseries'
    | 'status'
    | 'list'
    | 'table'
    | 'progress';
export type CardSize = 'sm' | 'md' | 'lg';

export interface Service {
    id: string;
    name: string;
    icon: string;
    color: string;
    status: 'healthy' | 'degraded' | 'down';
    cards: string[];
}

export interface Card {
    id: string;
    serviceId: string;
    title: string;
    type: CardType;
    size: CardSize;
    order: number;
}

export interface MetricData {
    value: number;
    unit: string;
    trend?: 'up' | 'down' | 'stable';
    thresholds?: { warn: number; crit: number };
}

export interface TimeseriesData {
    points: number[];
    unit: string;
    max?: number;
    min?: number;
}

export interface StatusData {
    state: 'healthy' | 'degraded' | 'down';
    label: string;
    since?: string;
}

export interface ListData {
    items: Array<{
        text: string;
        timestamp?: string;
        level?: 'info' | 'warn' | 'error';
    }>;
    maxItems?: number;
}

export interface TableData {
    rows: Array<{ key: string; value: string }>;
}

export interface ProgressData {
    value: number;
    max: number;
    label: string;
    unit?: string;
}

export type CardData =
    | MetricData
    | TimeseriesData
    | StatusData
    | ListData
    | TableData
    | ProgressData;

export interface ServiceSnapshot {
    service: Service;
    cards: Array<{ card: Card; data: CardData }>;
}

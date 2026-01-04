/**
 * Antifraud Module
 * Защита от скликивания и ботов в Яндекс.Директ
 */

export { default as antifraudRouter } from './antifraud.routes';
export { antifraudService } from './antifraud.service';
export { generateAntifraudScript, generateMinifiedScript } from './antifraud.script';
export type { AntifraudConfig } from './antifraud.script';
export type { AntifraudSettings } from './antifraud.service';

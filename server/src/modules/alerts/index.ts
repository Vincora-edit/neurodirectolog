/**
 * Alerts Module
 * Система уведомлений о критических изменениях в кампаниях
 */

export { default as alertsRouter } from './alerts.routes';
export { alertsService } from './alerts.service';
export type { Alert, AlertRule, AlertSettings } from './alerts.service';

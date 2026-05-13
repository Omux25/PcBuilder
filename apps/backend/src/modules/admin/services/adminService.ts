/**
 * Admin Service — Dashboard stats and activity logging orchestration.
 */

import { AdminRepository } from '../repositories/adminRepository.js';
import { DashboardData } from '@shared/types';

export class AdminService {
  private adminRepo: AdminRepository;

  constructor() {
    this.adminRepo = new AdminRepository();
  }

  /**
   * Returns all dashboard statistics in a single aggregated query set.
   */
  async getDashboardData(): Promise<DashboardData> {
    const [stats, updates, activity] = await Promise.all([
      this.adminRepo.getDashboardStats(),
      this.adminRepo.getPriceUpdatesChart(14),
      this.adminRepo.getRecentActivity(10)
    ]);

    return {
      stats,
      price_updates_chart: updates,
      recent_activity: activity.map(a => ({
        id: a.id,
        action: a.action,
        entity_type: a.entity_type ?? null,
        entity_id: a.entity_id ?? null,
        created_at: a.created_at
      }))
    };
  }

  async getRecentActivity(limit: number = 10) {
    return this.adminRepo.getRecentActivity(limit);
  }

  async logActivity(
    adminId: number,
    action: string,
    entityType?: string,
    entityId?: number,
    details?: Record<string, unknown>
  ) {
    return this.adminRepo.logActivity(adminId, action, entityType, entityId, details);
  }
}

const service = new AdminService();
export const logActivity = service.logActivity.bind(service);
export const getDashboardData = service.getDashboardData.bind(service);
export const getRecentActivity = service.getRecentActivity.bind(service);

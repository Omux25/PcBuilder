import { RetailerRepository } from '../repositories/retailerRepository.js';
import { AppError } from '../../../core/errors/errors.js';

export class RetailerService {
  private repository = new RetailerRepository();

  async getRetailers(includeInactive = false) {
    return this.repository.findAll(includeInactive);
  }

  async getRetailerById(id: number) {
    const retailer = await this.repository.findById(id);
    if (!retailer) {
      throw new AppError('RETAILER_NOT_FOUND', `Retailer with id ${id} not found`, 404);
    }
    return retailer;
  }

  async createRetailer(data: {
    name: string;
    base_url: string;
    logo_url?: string;
    country?: string;
    scraping_interval_hours?: number;
    notes?: string;
  }) {
    this.validateUrl(data.base_url);
    return this.repository.insert(data);
  }

  async updateRetailer(id: number, data: any) {
    if (data.base_url) {
      this.validateUrl(data.base_url);
    }
    const retailer = await this.repository.update(id, data);
    if (!retailer) {
      throw new AppError('RETAILER_NOT_FOUND', `Retailer with id ${id} not found`, 404);
    }
    return retailer;
  }

  async updateScrapeStatus(id: number, status: 'SUCCESS' | 'PARTIAL' | 'FAILED') {
    await this.repository.updateScrapeStatus(id, status);
  }

  private validateUrl(urlStr: string) {
    try {
      const url = new URL(urlStr);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new AppError('INVALID_URL', 'base_url must use http or https protocol', 400);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError('INVALID_URL', 'base_url must be a valid absolute URL', 400);
    }
  }
}

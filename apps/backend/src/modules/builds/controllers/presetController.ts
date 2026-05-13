import { Context } from 'hono';
import { PresetService } from '../services/presetService.js';
import { logActivity } from '../../admin/services/adminService.js';
import { AppError } from '../../../core/errors/errors.js';

export class PresetController {
  private service = new PresetService();

  async index(c: Context) {
    const useCase = c.req.query('use_case');
    const presets = await this.service.getPresets(useCase);
    return c.json({ presets });
  }

  async show(c: Context) {
    const id = Number(c.req.param('id'));
    if (!id) return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid id' } }, 400);
    const preset = await this.service.getPresetById(id);
    return c.json(preset);
  }

  async getAdminPresets(c: Context) {
    const presets = await this.service.getPresets(undefined, true);
    return c.json({ presets });
  }

  async create(c: Context) {
    const admin = c.get('admin') as { id: number } | undefined;
    const body = await c.req.json();

    if (!body.name || !body.use_case || !body.components) {
      return c.json({ error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } }, 400);
    }

    const preset = await this.service.createPreset(body);

    if (admin?.id) {
      await logActivity(admin.id, 'preset_created', 'preset_build', preset.id, { name: preset.name });
    }

    return c.json(preset, 201);
  }

  async update(c: Context) {
    const id = Number(c.req.param('id'));
    const admin = c.get('admin') as { id: number } | undefined;
    const body = await c.req.json();

    const preset = await this.service.updatePreset(id, body);

    if (admin?.id) {
      await logActivity(admin.id, 'preset_updated', 'preset_build', id);
    }

    return c.json(preset);
  }

  async delete(c: Context) {
    const id = Number(c.req.param('id'));
    const admin = c.get('admin') as { id: number } | undefined;

    await this.service.deletePreset(id);

    if (admin?.id) {
      await logActivity(admin.id, 'preset_deleted', 'preset_build', id);
    }

    return c.json({ message: `Preset build ${id} deleted.` });
  }
}

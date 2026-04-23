import { Hono } from 'hono';
import { getComponents, getComponentById } from '../services/componentService.js';
const componentsRouter = new Hono();
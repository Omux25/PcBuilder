import { describe, it, expect, afterEach } from 'bun:test';
import { getAllowedOrigins } from '../app.js';

describe('CORS Security Configuration', () => {
  const originalEnv = process.env.ALLOWED_ORIGINS;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.ALLOWED_ORIGINS = originalEnv;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should block unauthorized requests in production when ALLOWED_ORIGINS is not set', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOWED_ORIGINS;
    expect(getAllowedOrigins()).toEqual([]);
  });

  it('should block unauthorized requests in production when ALLOWED_ORIGINS is *', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = '*';
    expect(getAllowedOrigins()).toEqual([]);
  });

  it('should return * in development when ALLOWED_ORIGINS is not set', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOWED_ORIGINS;
    expect(getAllowedOrigins()).toEqual('*');
  });

  it('should return * in development when ALLOWED_ORIGINS is *', () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOWED_ORIGINS = '*';
    expect(getAllowedOrigins()).toEqual('*');
  });

  it('should return parsed origins when ALLOWED_ORIGINS is valid', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'https://allowed.com, https://other.com';
    expect(getAllowedOrigins()).toEqual(['https://allowed.com', 'https://other.com']);
  });
});

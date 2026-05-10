// @ts-nocheck
/**
 * Unit tests for recalculateConfidence pure function.
 *
 * No DOM needed — pure function test.
 * Requirements: 3.1, 3.2, 4.5
 */

import { describe, test, expect } from 'bun:test';
import { recalculateConfidence } from '../CanonicalGroupRow';

describe('recalculateConfidence', () => {
    test('all-high listings → high', () => {
        const listings = [
            { id: 1, confidence: 'high' },
            { id: 2, confidence: 'high' },
            { id: 3, confidence: 'high' },
        ];
        expect(recalculateConfidence(listings as any)).toBe('high');
    });

    test('single high listing → high', () => {
        expect(recalculateConfidence([{ id: 1, confidence: 'high' }] as any)).toBe('high');
    });

    test('mix of high and low → medium', () => {
        const listings = [
            { id: 1, confidence: 'high' },
            { id: 2, confidence: 'low' },
        ];
        expect(recalculateConfidence(listings as any)).toBe('medium');
    });

    test('mix of high and medium → medium', () => {
        const listings = [
            { id: 1, confidence: 'high' },
            { id: 2, confidence: 'medium' },
        ];
        expect(recalculateConfidence(listings as any)).toBe('medium');
    });

    test('all-medium listings → medium', () => {
        const listings = [
            { id: 1, confidence: 'medium' },
            { id: 2, confidence: 'medium' },
        ];
        expect(recalculateConfidence(listings as any)).toBe('medium');
    });

    test('mix of medium and low → medium', () => {
        const listings = [
            { id: 1, confidence: 'medium' },
            { id: 2, confidence: 'low' },
        ];
        expect(recalculateConfidence(listings as any)).toBe('medium');
    });

    test('all-low listings → low', () => {
        const listings = [
            { id: 1, confidence: 'low' },
            { id: 2, confidence: 'low' },
        ];
        expect(recalculateConfidence(listings as any)).toBe('low');
    });

    test('single low listing → low', () => {
        expect(recalculateConfidence([{ id: 1, confidence: 'low' }] as any)).toBe('low');
    });

    test('all-unknown listings → unknown', () => {
        const listings = [
            { id: 1, confidence: 'unknown' },
            { id: 2, confidence: 'unknown' },
        ];
        expect(recalculateConfidence(listings as any)).toBe('unknown');
    });

    test('empty array → unknown', () => {
        expect(recalculateConfidence([])).toBe('unknown');
    });

    test('mix of low and unknown → low', () => {
        const listings = [
            { id: 1, confidence: 'low' },
            { id: 2, confidence: 'unknown' },
        ];
        // low takes precedence over unknown
        expect(recalculateConfidence(listings as any)).toBe('low');
    });

    test('removing the only high listing from mixed group → medium', () => {
        const before = [
            { id: 1, confidence: 'high' },
            { id: 2, confidence: 'low' },
        ];
        const after = before.filter((l) => l.id !== 1); // remove high
        expect(recalculateConfidence(after as any)).toBe('low');
    });

    test('removing a low outlier from all-high group preserves high', () => {
        const before = [
            { id: 1, confidence: 'high' },
            { id: 2, confidence: 'high' },
            { id: 3, confidence: 'low' }, // the outlier
        ];
        const after = before.filter((l) => l.id !== 3); // remove outlier
        expect(recalculateConfidence(after as any)).toBe('high');
    });
});

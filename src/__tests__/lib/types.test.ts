import { describe, it, expect } from 'vitest';
import {
  toDate,
  ProductStatusEnum,
  OrderStatusEnum,
  UserRoleEnum,
  DeliveryStatusEnum,
} from '@/lib/types';

describe('toDate', () => {
  it('returns null for null/undefined', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
  });

  it('parses ISO strings', () => {
    const d = toDate('2024-01-15T10:30:00Z');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2024);
  });

  it('handles {seconds, nanoseconds} objects', () => {
    const d = toDate({ seconds: 1700000000, nanoseconds: 0 } as any);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getTime()).toBe(1700000000 * 1000);
  });

  it('handles objects with toDate() method', () => {
    const mock = { toDate: () => new Date('2024-06-01') };
    const d = toDate(mock as any);
    expect(d).toBeInstanceOf(Date);
  });
});

describe('Status Enums', () => {
  it('ProductStatusEnum has expected values', () => {
    expect(ProductStatusEnum.ACTIVE).toBe('active');
    expect(ProductStatusEnum.PENDING_REVIEW).toBe('pending_review');
    expect(ProductStatusEnum.SOLD).toBe('sold');
  });

  it('OrderStatusEnum has expected values', () => {
    expect(OrderStatusEnum.PROCESSING).toBe('processing');
    expect(OrderStatusEnum.DELIVERED).toBe('delivered');
    expect(OrderStatusEnum.CANCELLED).toBe('cancelled');
  });

  it('UserRoleEnum has expected values', () => {
    expect(UserRoleEnum.ADMIN).toBe('admin');
    expect(UserRoleEnum.BUYER).toBe('buyer');
    expect(UserRoleEnum.SELLER).toBe('seller');
    expect(UserRoleEnum.COURIER).toBe('courier');
  });

  it('DeliveryStatusEnum has expected values', () => {
    expect(DeliveryStatusEnum.PENDING_ASSIGNMENT).toBe('pending_assignment');
    expect(DeliveryStatusEnum.DELIVERED).toBe('delivered');
  });
});

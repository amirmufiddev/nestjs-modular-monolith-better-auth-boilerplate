import { applyPatch } from './patch.util';

type SampleEntity = {
  name: string;
  phone: string | null;
  notes: string;
};

describe('applyPatch', () => {
  it('should copy defined fields from allowed keys (happy path)', () => {
    const input: Partial<SampleEntity> = {
      name: 'Alice',
      phone: '08123456789',
    };

    expect(applyPatch(input, ['name', 'phone', 'notes'])).toEqual({
      name: 'Alice',
      phone: '08123456789',
    });
  });

  it('should ignore undefined values', () => {
    const input: Partial<SampleEntity> = {
      name: 'Alice',
      phone: undefined,
      notes: undefined,
    };

    expect(applyPatch(input, ['name', 'phone', 'notes'])).toEqual({
      name: 'Alice',
    });
  });

  it('should ignore keys not in allowedKeys', () => {
    const input = {
      name: 'Alice',
      phone: '08123456789',
      injected: 'malicious',
    } as Partial<SampleEntity> & { injected: string };

    expect(applyPatch(input, ['name', 'phone'])).toEqual({
      name: 'Alice',
      phone: '08123456789',
    });
  });

  it('should include null values to clear nullable fields', () => {
    const input: Partial<SampleEntity> = {
      phone: null,
    };

    expect(applyPatch(input, ['name', 'phone', 'notes'])).toEqual({
      phone: null,
    });
  });
});

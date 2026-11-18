import { describe, expect, it } from 'bun:test';
import { parseWilayahTuple, parseWilayahSqlContent } from './regional.seed';

describe('parseWilayahTuple', () => {
  it('should parse province correctly (2 digits) and keep the dot separators', () => {
    const res = parseWilayahTuple("('11','Aceh')");
    expect(res).toEqual({ code: '11', name: 'Aceh' });
  });

  it('should parse regency correctly and keep the dot separator (11.01)', () => {
    const res = parseWilayahTuple("('11.01','Kabupaten Aceh Selatan')");
    expect(res).toEqual({ code: '11.01', name: 'Kabupaten Aceh Selatan' });
  });

  it('should parse district correctly and keep the dot separators (11.01.01)', () => {
    const res = parseWilayahTuple("('11.01.01','Bakongan')");
    expect(res).toEqual({ code: '11.01.01', name: 'Bakongan' });
  });

  it('should parse village correctly and keep the dot separators (11.01.01.2001)', () => {
    const res = parseWilayahTuple("('11.01.01.2001','Keude Bakongan')");
    expect(res).toEqual({ code: '11.01.01.2001', name: 'Keude Bakongan' });
  });

  it("should unescape SQL apostrophes in names (Ba'u)", () => {
    const res = parseWilayahTuple("('11.01.02.2018','Pasi Kuala Ba''u')");
    expect(res).toEqual({
      code: '11.01.02.2018',
      name: "Pasi Kuala Ba'u",
    });
  });

  it('should return null for non-tuple input', () => {
    expect(parseWilayahTuple('not a tuple')).toBeNull();
    expect(parseWilayahTuple('')).toBeNull();
  });

  it('should return null when the code is not numeric/dotted', () => {
    expect(parseWilayahTuple("('abc','Foo')")).toBeNull();
    expect(parseWilayahTuple("('11.01.abc','Foo')")).toBeNull();
  });

  it('should parse (kode, kodepos) tuple generically — second column is opaque', () => {
    // wilayah_kodepos.sql uses the same (kode, <second>) tuple shape as
    // wilayah.sql. The parser is generic over the second column so callers
    // can pass `(kode, kodepos)` tuples and read the kodepos from `name`.
    const res = parseWilayahTuple("('11.01.01.2001','23773')");
    expect(res).toEqual({ code: '11.01.01.2001', name: '23773' });
  });
});

describe('parseWilayahSqlContent', () => {
  it('should parse multiple tuples from a chunk and keep dot separators', () => {
    const sql = `
      INSERT INTO wilayah (kode, nama) VALUES
      ('11','Aceh'),
      ('11.01','Kabupaten Aceh Selatan'),
      ('11.01.01','Bakongan');
    `;
    const res = parseWilayahSqlContent(sql);
    expect(res).toEqual([
      { code: '11', name: 'Aceh' },
      { code: '11.01', name: 'Kabupaten Aceh Selatan' },
      { code: '11.01.01', name: 'Bakongan' },
    ]);
  });

  it('should skip non-tuple lines (comments, headers)', () => {
    const sql = `-- comment
DROP TABLE IF EXISTS wilayah;
CREATE TABLE IF NOT EXISTS wilayah (
  kode varchar(13) NOT NULL,
  nama varchar(100) NOT NULL,
  PRIMARY KEY (kode)
) ENGINE=MyISAM;
INSERT INTO wilayah (kode, nama)
VALUES
('11','Aceh');`;
    const res = parseWilayahSqlContent(sql);
    expect(res).toEqual([{ code: '11', name: 'Aceh' }]);
  });
});

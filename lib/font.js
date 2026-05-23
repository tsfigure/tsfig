import { range } from "./util.js";
class Parser {
    bytes;
    offset;
    data_view;
    constructor(bytes, offset) {
        this.bytes = bytes;
        this.data_view = new DataView(bytes.buffer);
        this.offset = offset;
    }
    read_u32() {
        const result = this.data_view.getUint32(this.offset);
        this.offset += 4;
        return result;
    }
    read_u16() {
        const result = this.data_view.getUint16(this.offset);
        this.offset += 2;
        return result;
    }
    read_u16_array(num_elements) {
        const result = new Uint16Array(num_elements);
        for (const i of range(num_elements)) {
            result[i] = this.read_u16();
        }
        return result;
    }
    read_string(len) {
        const result = new TextDecoder().decode(this.bytes.subarray(this.offset, this.offset + len));
        this.offset += len;
        return result;
    }
    skip(num_bytes) {
        this.offset += num_bytes;
    }
}
export class TTFFont {
    bytes;
    tables;
    num_long_hor_metrics;
    num_glyphs;
    char_to_glyph;
    glyph_advance_width;
    units_per_em;
    constructor(bytes) {
        this.bytes = bytes;
        this.tables = new Map();
        const header = new Parser(bytes, 0);
        const sfntVersion = header.read_u32();
        if (sfntVersion != 0x10000) {
            throw new Error(`Unsupported font file magic 0x${sfntVersion.toString(16)}`);
        }
        const numTables = header.read_u16();
        header.skip(6);
        for (const i of range(numTables)) {
            const tableTag = header.read_string(4);
            header.skip(4);
            const offset = header.read_u32();
            const length = header.read_u32();
            this.tables.set(tableTag, { offset, size: length });
        }
        this.parse_head();
        this.parse_hhea();
        this.parse_maxp();
        this.parse_cmap();
        this.parse_hmtx();
    }
    parse_cmap() {
        this.char_to_glyph = new Map();
        const table = this.tables.get("cmap");
        const cmap = new Parser(this.bytes, table.offset);
        const version = cmap.read_u16();
        if (version != 0) {
            throw new Error(`Unsupported cmap table version ${version}`);
        }
        const numTables = cmap.read_u16();
        for (const i of range(numTables)) {
            const platformID = cmap.read_u16();
            const encodingID = cmap.read_u16();
            const offset = cmap.read_u32();
            if (platformID != 0) {
                continue;
            }
            this.parse_unicode_cmap_subtable(table.offset + offset);
        }
    }
    parse_unicode_cmap_subtable(offset) {
        const subtable = new Parser(this.bytes, offset);
        const format = subtable.read_u16();
        if (format == 4) {
            const length = subtable.read_u16();
            subtable.skip(2);
            const segCountX2 = subtable.read_u16();
            const seg_count = segCountX2 / 2;
            subtable.skip(6);
            const endCode = subtable.read_u16_array(seg_count);
            subtable.skip(2);
            const startCode = subtable.read_u16_array(seg_count);
            const idDelta = subtable.read_u16_array(seg_count);
            const idRangeOffset = subtable.read_u16_array(seg_count);
            const num_glyph_ids = (length - 16 - 8 * seg_count) / 2;
            const glyphIdArray = subtable.read_u16_array(num_glyph_ids);
            for (const seg of range(seg_count)) {
                const start = startCode[seg];
                const end = endCode[seg];
                for (const char_code of range(start, end + 1)) {
                    let glyph;
                    if (idRangeOffset[seg] == 0) {
                        glyph = (char_code + idDelta[seg]) & 0xffff;
                    }
                    else {
                        glyph = glyphIdArray[(idRangeOffset[seg] / 2) + char_code - start + seg - seg_count];
                    }
                    this.char_to_glyph.set(char_code, glyph);
                }
            }
        }
        else if (format == 12) {
            subtable.skip(10);
            const numGroups = subtable.read_u32();
            for (const i of range(numGroups)) {
                const startCharCode = subtable.read_u32();
                const endCharCode = subtable.read_u32();
                const startGlyghId = subtable.read_u32();
                for (const char_code of range(startCharCode, endCharCode + 1)) {
                    this.char_to_glyph.set(char_code, startGlyghId + char_code - startCharCode);
                }
            }
        }
        else {
            throw new Error(`Unsupported cmap subtable format ${format}`);
        }
    }
    parse_hhea() {
        const hhea = new Parser(this.bytes, this.tables.get("hhea").offset);
        const majorVersion = hhea.read_u16();
        if (majorVersion != 1) {
            throw new Error(`Unsupported hhea table major version ${majorVersion}`);
        }
        hhea.skip(32);
        this.num_long_hor_metrics = hhea.read_u16();
    }
    parse_head() {
        const head = new Parser(this.bytes, this.tables.get("head").offset);
        const majorVersion = head.read_u16();
        if (majorVersion != 1) {
            throw new Error(`Unsupported head table major version ${majorVersion}`);
        }
        head.skip(16);
        this.units_per_em = head.read_u16();
    }
    parse_hmtx() {
        this.glyph_advance_width = new Map();
        const hmtx = new Parser(this.bytes, this.tables.get("hmtx").offset);
        let advance_width = undefined;
        for (const glyph of range(this.num_long_hor_metrics)) {
            advance_width = hmtx.read_u16();
            hmtx.skip(2);
            this.glyph_advance_width.set(glyph, advance_width);
        }
        for (const glyph of range(this.num_long_hor_metrics, this.num_glyphs)) {
            this.glyph_advance_width.set(glyph, advance_width);
        }
    }
    parse_maxp() {
        const maxp = new Parser(this.bytes, this.tables.get("maxp").offset);
        const version = maxp.read_u32();
        if (version != 0x5000 && version != 0x10000) {
            throw new Error(`Unsupported maxp table version ${version}`);
        }
        this.num_glyphs = maxp.read_u16();
    }
    sanitize(text) {
        let result = [];
        let fallback_char_code = 0xfffd;
        if (!this.char_to_glyph.has(fallback_char_code)) {
            fallback_char_code = "?".charCodeAt(0);
        }
        for (const ch of text) {
            const char_code = ch.codePointAt(0);
            if (!this.char_to_glyph.has(char_code)) {
                console.log(`fallback ${char_code} -> ${fallback_char_code}`);
                result.push(fallback_char_code);
            }
            else {
                result.push(char_code);
            }
        }
        return String.fromCodePoint(...result);
    }
    text_to_glyphs(text) {
        let result = [];
        for (const ch of text) {
            const char_code = ch.codePointAt(0);
            if (!this.char_to_glyph.has(char_code)) {
                result.push(0);
            }
            else {
                result.push(this.char_to_glyph.get(char_code));
            }
        }
        return result;
    }
    text_aspect_ratio(content) {
        if (content.length == 0) {
            throw new Error("aspect ratio undefined for empty string");
        }
        let width_units = 0;
        for (const glyph of this.text_to_glyphs(this.sanitize(content))) {
            width_units += this.glyph_advance_width.get(glyph);
        }
        return width_units / this.units_per_em;
    }
    baseline_relative_height() {
        return 0.293 / 1.362;
    }
}
let builtin_font = null;
export async function load_builtin_font() {
    const font_url = new URL("NotoSansMono-Regular.ttf", import.meta.url);
    const response = await fetch(font_url);
    const font_bytes = new Uint8Array(await response.arrayBuffer());
    builtin_font = new TTFFont(font_bytes);
}
export function get_builtin_font() {
    if (builtin_font === null) {
        throw new Error("Built-in font not loaded");
    }
    return builtin_font;
}

import * as JSZipNamespace from 'jszip';
const JSZip: any = (JSZipNamespace as any).default || JSZipNamespace;

const MTCODE_MAP: Record<number, string> = {
  0x2212: '-',
  0x00b1: '\\pm ',
  0x2260: '\\neq ',
  0x2264: '\\le ',
  0x2265: '\\ge ',
  0x00d7: '\\times ',
  0x00f7: '\\div ',
  0x22c5: '\\cdot ',
  0x221e: '\\infty ',
  0x2208: '\\in ',
  0x2209: '\\notin ',
  0x2205: '\\varnothing ',
  0x21d4: '\\iff ',
  0x21d2: '\\Rightarrow ',
  0x2229: '\\cap ',
  0x222a: '\\cup ',
  0x2282: '\\subset ',
  0x2286: '\\subseteq ',
  0x2220: '\\angle ',
  0x22a5: '\\perp ',
  0x2225: '\\parallel ',
  0x2248: '\\approx ',
  0x2261: '\\equiv ',
  0x03c0: '\\pi ',
  0x0394: '\\Delta ',
  0x03b1: '\\alpha ',
  0x03b2: '\\beta ',
  0x03b3: '\\gamma ',
  0x03c6: '\\varphi ',
  0x00b0: '^\\circ ',
  0x2218: '\\circ ',
  0x25b3: '\\triangle ',
  0xf020: ' ',
  0x2026: '\\dots ',
};

function hasUtf16Marker(sector: Uint8Array, asciiStr: string): boolean {
  const pat: number[] = [];
  for (let i = 0; i < asciiStr.length; i++) {
    pat.push(asciiStr.charCodeAt(i), 0);
  }
  for (let i = 0; i <= sector.length - pat.length; i++) {
    let ok = true;
    for (let j = 0; j < pat.length; j++) {
      if (sector[i + j] !== pat[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function extractMtefStream(data: Uint8Array): Uint8Array {
  // Loại bỏ các sector 512-byte chứa OLE2 Directory ("Root Entry" hoặc "Equation Native")
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  for (let s = 0; s < data.length; s += 512) {
    const sec = data.subarray(s, Math.min(s + 512, data.length));
    if (hasUtf16Marker(sec, 'Equation') || hasUtf16Marker(sec, 'Root')) {
      continue;
    }
    chunks.push(sec);
    totalLen += sec.length;
  }

  const joined = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    joined.set(c, offset);
    offset += c.length;
  }

  // Tìm chuỗi khởi đầu nội dung phương trình MTEF v5: 0x0a 0x01 0x00 (với byte kế tiếp khác 0x00)
  for (let i = 0; i <= joined.length - 4; i++) {
    if (
      joined[i] === 0x0a &&
      joined[i + 1] === 0x01 &&
      joined[i + 2] === 0x00 &&
      joined[i + 3] !== 0x00
    ) {
      let pos = i + 3;
      // Bỏ qua các bản ghi COLOR_DEF (0x10 + 6 bytes) hoặc 8 bytes định nghĩa màu mặc định
      if (joined[pos] === 0x10) {
        pos += 8;
        while (pos < joined.length && joined[pos] === 0x10) {
          pos += 7;
        }
      }
      return joined.subarray(pos);
    }
  }
  return new Uint8Array(0);
}

function skipNudge(buf: Uint8Array, pos: number): number {
  if (pos + 2 > buf.length) return buf.length;
  const b1 = buf[pos];
  const b2 = buf[pos + 1];
  pos += 2;
  if (b1 === 128 && b2 === 128) {
    pos += 4;
  }
  return pos;
}

function parseSingleChar(buf: Uint8Array, pos: number): { ch: string; pos: number } {
  pos += 1; // skip 2 (CHAR)
  if (pos >= buf.length) return { ch: '', pos };
  const opts = buf[pos++];
  if (opts & 0x08) {
    pos = skipNudge(buf, pos);
  }
  pos += 1; // skip typeface
  let mtcode = 0;
  if (!(opts & 0x20)) {
    if (pos + 2 > buf.length) return { ch: '', pos: buf.length };
    mtcode = buf[pos] | (buf[pos + 1] << 8);
    pos += 2;
  }
  if (opts & 0x04) pos += 1; // 8-bit font char
  if (opts & 0x10) pos += 2; // 16-bit font char

  let ch = MTCODE_MAP[mtcode];
  if (ch === undefined) {
    if ((mtcode >= 32 && mtcode <= 126) || (mtcode >= 0x00a0 && mtcode <= 0x1ef9)) {
      ch = String.fromCharCode(mtcode);
    } else {
      ch = '';
    }
  }

  // Nếu có dấu phụ trên ký tự (mtefOPT_CHAR_EMBELL = 0x01): vd góc \widehat{C}, vectơ, ngang đầu
  if (opts & 0x01) {
    let hasHat = false;
    let hasVec = false;
    let hasBar = false;
    while (pos < buf.length && buf[pos] !== 0) {
      if (buf[pos] === 6) {
        const eOpts = buf[pos + 1] || 0;
        pos += 2;
        if (eOpts & 0x08) pos = skipNudge(buf, pos);
        const embType = buf[pos++] || 0;
        if (embType >= 0x09 && embType <= 0x0c) hasHat = true;
        else if (embType === 0x08) hasVec = true;
        else if (embType === 0x07) hasBar = true;
      } else if (buf[pos] === 15) {
        pos += 2; // COLOR record inside embell list
      } else {
        pos += 1;
      }
    }
    if (pos < buf.length && buf[pos] === 0) pos += 1;
    if (hasHat && ch) ch = `\\widehat{${ch}}`;
    else if (hasVec && ch) ch = `\\vec{${ch}}`;
    else if (hasBar && ch) ch = `\\bar{${ch}}`;
  }

  return { ch, pos };
}

function parseMtefNodes(buf: Uint8Array, startPos = 0): { latex: string; pos: number } {
  const items: string[] = [];
  let pos = startPos;
  const n = buf.length;

  while (pos < n) {
    const rec = buf[pos];
    if (rec === 0) {
      pos += 1;
      break;
    } else if (rec === 1) {
      // LINE
      pos += 1;
      const opts = buf[pos++] || 0;
      if (opts & 0x08) pos = skipNudge(buf, pos);
      if (opts & 0x04) pos += 2;
      if (opts & 0x01) {
        items.push('');
      } else {
        const sub = parseMtefNodes(buf, pos);
        items.push(sub.latex);
        pos = sub.pos;
      }
    } else if (rec === 2) {
      // CHAR
      const parsed = parseSingleChar(buf, pos);
      items.push(parsed.ch);
      pos = parsed.pos;
    } else if (rec === 3) {
      // TMPL (Template: Phân số, Căn thức, Số mũ, Hệ phương trình, Ngoặc...)
      pos += 1;
      const opts = buf[pos++] || 0;
      if (opts & 0x08) pos = skipNudge(buf, pos);
      const selector = buf[pos++] || 0;
      let variation = buf[pos++] || 0;
      if (variation & 0x80) {
        variation = (variation & 0x7f) | ((buf[pos++] || 0) << 7);
      }
      pos += 1; // tmpl_opts

      const slots: string[] = [];
      while (pos < n) {
        const r = buf[pos];
        if (r === 0) {
          pos += 1;
          break;
        } else if (r === 1) {
          pos += 1;
          const lOpts = buf[pos++] || 0;
          if (lOpts & 0x08) pos = skipNudge(buf, pos);
          if (lOpts & 0x04) pos += 2;
          if (lOpts & 0x01) {
            slots.push('');
          } else {
            const sub = parseMtefNodes(buf, pos);
            slots.push(sub.latex);
            pos = sub.pos;
          }
        } else if (r === 2) {
          const parsed = parseSingleChar(buf, pos);
          pos = parsed.pos;
        } else if (r >= 10 && r <= 14) {
          pos += 1;
        } else if (r === 15) {
          pos += 2;
        } else {
          const sub = parseMtefNodes(buf, pos);
          slots.push(sub.latex);
          pos = sub.pos;
        }
      }

      if (selector === 0x00) {
        items.push(`\\widehat{${slots[0] || ''}}`);
      } else if (selector === 0x01) {
        items.push(`(${slots[0] || ''})`);
      } else if (selector === 0x02) {
        const inner = slots[0] || '';
        if (variation === 0x01 || inner.includes('\\\\')) {
          items.push(`\\begin{cases} ${inner} \\end{cases}`);
        } else {
          items.push(`\\{${inner}\\}`);
        }
      } else if (selector === 0x03) {
        const inner = slots[0] || '';
        if (variation === 0x01 && inner.includes('\\\\')) {
          items.push(`\\left[ \\begin{aligned} ${inner} \\end{aligned} \\right.`);
        } else {
          items.push(`[${inner}]`);
        }
      } else if (selector === 0x04) {
        items.push(`|${slots[0] || ''}|`);
      } else if (selector === 0x0a) {
        const rad = slots[0] || '';
        const deg = slots[1] || '';
        items.push(deg ? `\\sqrt[${deg}]{${rad}}` : `\\sqrt{${rad}}`);
      } else if (selector === 0x0b) {
        const num = slots[0] || '';
        const den = slots[1] || '';
        items.push(`\\frac{${num}}{${den}}`);
      } else if (selector === 0x1b || selector === 0x1c || selector === 0x1d) {
        const sub = slots[0] || '';
        const sup = slots[1] || '';
        if (sub && sup) items.push(`_{${sub}}^{${sup}}`);
        else if (sup) items.push(`^{${sup}}`);
        else if (sub) items.push(`_{${sub}}`);
      } else if (selector >= 0x16 && selector <= 0x18) {
        items.push(`\\overline{${slots[0] || ''}}`);
      } else {
        items.push(slots.filter(Boolean).join(''));
      }
    } else if (rec === 5) {
      // MATRIX (Hệ phương trình nhiều dòng trong MathType 7)
      pos += 1;
      const opts = buf[pos++] || 0;
      if (opts & 0x08) pos = skipNudge(buf, pos);
      const rowsCnt = buf[pos + 3] || 2;
      const colsCnt = buf[pos + 4] || 1;
      pos += 5;
      const rowBytes = Math.floor((2 * (rowsCnt + 1) + 7) / 8);
      const colBytes = Math.floor((2 * (colsCnt + 1) + 7) / 8);
      pos += rowBytes + colBytes;

      const cells: string[] = [];
      while (pos < n) {
        const r = buf[pos];
        if (r === 0) {
          pos += 1;
          break;
        } else if (r === 1) {
          pos += 1;
          const lOpts = buf[pos++] || 0;
          if (lOpts & 0x08) pos = skipNudge(buf, pos);
          if (lOpts & 0x04) pos += 2;
          if (lOpts & 0x01) {
            cells.push('');
          } else {
            const sub = parseMtefNodes(buf, pos);
            cells.push(sub.latex);
            pos = sub.pos;
          }
        } else if (r >= 10 && r <= 14) {
          pos += 1;
        } else if (r === 15) {
          pos += 2;
        } else {
          pos += 1;
        }
      }
      items.push(cells.filter(Boolean).join(' \\\\ '));
    } else if (rec >= 10 && rec <= 14) {
      pos += 1;
    } else if (rec === 15) {
      pos += 2;
    } else if (rec === 16) {
      pos += 7;
    } else if (rec === 17) {
      pos += 2;
      while (pos < n && buf[pos] !== 0) pos += 1;
      pos += 1;
    } else if (rec === 18) {
      pos += 3;
    } else {
      pos += 1;
    }
  }

  return { latex: items.join('').trim(), pos };
}

/**
 * Giải mã file nhị phân MathType OLE (`word/embeddings/oleObject*.bin`) sang chuỗi LaTeX
 */
export function decodeMtefOleBinaryToLatex(data: Uint8Array): string {
  try {
    const stream = extractMtefStream(data);
    if (!stream || stream.length === 0) return '';
    const { latex } = parseMtefNodes(stream, 0);
    return latex.trim();
  } catch {
    return '';
  }
}

/**
 * Chuyển đổi công thức toán Word OMML (<m:oMath>) sang định dạng LaTeX
 */
export function ommlToLatex(ommlStr: string): string {
  let res = ommlStr;
  let prev = '';

  while (prev !== res) {
    prev = res;
    // 1. Căn bậc hai / bậc n: <m:rad>
    res = res.replace(
      /<m:rad(?:\s[^>]*)?>[\s\S]*?<m:deg(?:\s[^>]*)?>([\s\S]*?)<\/m:deg>[\s\S]*?<m:e(?:\s[^>]*)?>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:rad>/g,
      (_m, deg, rad) => (deg.trim() ? `\\sqrt[${deg}]{${rad}}` : `\\sqrt{${rad}}`)
    );
    // 2. Dấu ngoặc <m:d>...</m:d>
    res = res.replace(
      /<m:d(?:\s[^>]*)?>[\s\S]*?<m:e(?:\s[^>]*)?>([\s\S]*?)<\/m:e>[\s\S]*?<\/m:d>/g,
      (_m, content) => `(${content})`
    );
    // 3. Phân số <m:f>
    res = res.replace(
      /<m:f(?:\s[^>]*)?>[\s\S]*?<m:num(?:\s[^>]*)?>([\s\S]*?)<\/m:num>[\s\S]*?<m:den(?:\s[^>]*)?>([\s\S]*?)<\/m:den>[\s\S]*?<\/m:f>/g,
      (_m, num, den) => `\\frac{${num}}{${den}}`
    );
    // 4. Số mũ & chỉ số dưới kết hợp <m:sSubSup>
    res = res.replace(
      /<m:sSubSup(?:\s[^>]*)?>[\s\S]*?<m:e(?:\s[^>]*)?>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub(?:\s[^>]*)?>([\s\S]*?)<\/m:sub>[\s\S]*?<m:sup(?:\s[^>]*)?>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSubSup>/g,
      (_m, e, sub, sup) => `${e}_{${sub}}^{${sup}}`
    );
    // 5. Số mũ <m:sSup>
    res = res.replace(
      /<m:sSup(?:\s[^>]*)?>[\s\S]*?<m:e(?:\s[^>]*)?>([\s\S]*?)<\/m:e>[\s\S]*?<m:sup(?:\s[^>]*)?>([\s\S]*?)<\/m:sup>[\s\S]*?<\/m:sSup>/g,
      (_m, e, s) => `${e}^{${s}}`
    );
    // 6. Chỉ số dưới <m:sSub>
    res = res.replace(
      /<m:sSub(?:\s[^>]*)?>[\s\S]*?<m:e(?:\s[^>]*)?>([\s\S]*?)<\/m:e>[\s\S]*?<m:sub(?:\s[^>]*)?>([\s\S]*?)<\/m:sub>[\s\S]*?<\/m:sSub>/g,
      (_m, e, s) => `${e}_{${s}}`
    );
    // 7. Mảng phương trình <m:eqArr>
    res = res.replace(
      /<m:eqArr(?:\s[^>]*)?>([\s\S]*?)<\/m:eqArr>/g,
      (_m, inner) => {
        const rows = Array.from(inner.matchAll(/<m:e(?:\s[^>]*)?>([\s\S]*?)<\/m:e>/g)).map(
          (rm: any) => rm[1]
        );
        return rows.length > 1 ? `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}` : inner;
      }
    );
    // 8. Loại bỏ thẻ <m:r> và <w:r>
    res = res.replace(/<(?:m:r|w:r)(?:\s[^>]*)?>([\s\S]*?)<\/(?:m:r|w:r)>/g, (_m, content) => content);
    // 9. Lấy chữ từ thẻ <m:t> và <w:t>
    res = res.replace(/<(?:m:t|w:t)(?:\s[^>]*)?>([\s\S]*?)<\/(?:m:t|w:t)>/g, (_m, txt) => txt);
  }

  res = res.replace(/<[^>]+>/g, '');
  return res.trim();
}

/**
 * Bóc tách toàn bộ văn bản, công thức Toán (MathType OLE `oleObject*.bin` + Word OMML `<m:oMath>`),
 * bảng đáp án và hình ảnh minh họa từ file `.docx`.
 */
export async function extractDocxWithMtefAndOmml(
  arrayBuffer: ArrayBuffer | Uint8Array
): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 1. Đọc word/_rels/document.xml.rels
  const relsMap: Record<string, string> = {};
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('string');
    const relRegex = /<Relationship\s+[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = relRegex.exec(relsXml)) !== null) {
      const id = match[1];
      let target = match[2].replace(/^\/+/, '');
      if (!target.startsWith('word/')) {
        target = 'word/' + target;
      }
      relsMap[id] = target;
    }
  }

  // 2. Giải mã toàn bộ MathType OLE (`oleObject*.bin`) và Hình ảnh thực tế (`.png`, `.jpg`, `.gif`, `.svg`)
  const oleLatexMap: Record<string, string> = {};
  const imageDataUrls: Record<string, string> = {};

  for (const [rId, targetPath] of Object.entries(relsMap)) {
    const entry = zip.file(targetPath);
    if (!entry) continue;

    if (targetPath.includes('oleObject') && targetPath.endsWith('.bin')) {
      const uint8 = await entry.async('uint8array');
      const latex = decodeMtefOleBinaryToLatex(uint8);
      if (latex) {
        oleLatexMap[rId] = `$${latex}$`;
      }
    } else {
      const ext = targetPath.split('.').pop()?.toLowerCase() || '';
      // Chỉ lấy ảnh raster/svg thực sự (bỏ qua file preview .wmf/.emf của MathType)
      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
        const base64 = await entry.async('base64');
        const mime =
          ext === 'png'
            ? 'image/png'
            : ext === 'gif'
              ? 'image/gif'
              : ext === 'svg'
                ? 'image/svg+xml'
                : ext === 'webp'
                  ? 'image/webp'
                  : 'image/jpeg';
        imageDataUrls[rId] = `data:${mime};base64,${base64}`;
      }
    }
  }

  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) return '';
  const xml = await docXmlFile.async('string');

  const bodyMatch = xml.match(/<w:body(?:\s[^>]*)?>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) return '';
  const bodyXml = bodyMatch[1];

  const parseParagraph = (pXmlInner: string): string => {
    const foundImages: string[] = [];

    // 1. Thay thế các thẻ <w:object>...</w:object> của MathType bằng công thức LaTeX $...$
    let processedXml = pXmlInner.replace(
      /<w:object(?:\s[^>]*)?>([\s\S]*?)<\/w:object>/gi,
      (fullObj) => {
        const oleMatch = fullObj.match(/OLEObject[^>]*r:id="([^"]+)"/i);
        if (oleMatch && oleLatexMap[oleMatch[1]]) {
          return `<w:t> ${oleLatexMap[oleMatch[1]]} </w:t>`;
        }
        return '';
      }
    );

    // 2. Thay thế các thẻ <m:oMath>...</m:oMath> của Word bằng công thức LaTeX $...$
    processedXml = processedXml.replace(
      /<m:oMath(?:\s[^>]*)?>([\s\S]*?)<\/m:oMath>/gi,
      (fullOmml) => {
        const latex = ommlToLatex(fullOmml);
        return latex ? `<w:t> $${latex}$ </w:t>` : '';
      }
    );

    // 3. Thay thế <w:tab/> bằng ký tự tab để tách các đáp án A, B, C, D cùng dòng
    processedXml = processedXml.replace(/<w:tab(?:\s[^>]*)?\/>/gi, '<w:t>\t</w:t>');
    processedXml = processedXml.replace(/<w:br(?:\s[^>]*)?\/>/gi, '<w:t>\n</w:t>');

    // 4. Tìm các hình ảnh minh họa thực sự (<w:drawing>, <w:pict>)
    const drawingRegex = /<(?:w:drawing|w:pict)(?:\s[^>]*)?>([\s\S]*?)<\/(?:w:drawing|w:pict)>/gi;
    let dMatch: RegExpExecArray | null;
    while ((dMatch = drawingRegex.exec(processedXml)) !== null) {
      const rMatch = dMatch[0].match(/(?:r:embed|r:id)="([^"]+)"/i);
      if (rMatch && imageDataUrls[rMatch[1]]) {
        const url = imageDataUrls[rMatch[1]];
        if (!foundImages.includes(url)) foundImages.push(url);
      }
    }

    // 5. Trích xuất văn bản từ <w:t> (đồng thời nhận diện gạch chân <w:u> cho đáp án đúng)
    let text = '';
    const runRegex = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let rMatch: RegExpExecArray | null;
    while ((rMatch = runRegex.exec(processedXml)) !== null) {
      if (rMatch[1] !== undefined) {
        const runContent = rMatch[1];
        const hasUnderline = /<w:u(?:\s+w:val="(?!none)[^"]*"|\s*\/)>/i.test(runContent);
        const hasRedColor = /<w:color[^>]*w:val="(?:FF0000|red|C00000|E00000)"/i.test(runContent);
        const tMatches = Array.from(runContent.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g));
        const runText = tMatches.map((m) => m[1]).join('');
        if ((hasUnderline || hasRedColor) && /^[A-Ea-e](?:[\.\)\:]|\s*$)/.test(runText.trim())) {
          text += `*${runText.trimStart()}`;
        } else {
          text += runText;
        }
      } else if (rMatch[2] !== undefined) {
        text += rMatch[2];
      }
    }

    // Làm sạch khoảng trắng thừa quanh công thức và dấu chấm câu cuối đáp án (VD: "$2x-3y=5$ ." -> "$2x-3y=5$")
    let fullParagraph = text
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\$\s+\.(?=\s|\t|$)/g, '$')
      .trim();

    if (foundImages.length > 0) {
      const imgMarkdown = foundImages.map((u) => `\n![Hình minh họa](${u})`).join('');
      fullParagraph = fullParagraph ? `${fullParagraph}\n${imgMarkdown}` : imgMarkdown.trim();
    }

    return fullParagraph;
  };

  const parseTable = (tblXml: string): string => {
    const trRegex = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
    let trMatch: RegExpExecArray | null;
    const rows: string[] = [];

    while ((trMatch = trRegex.exec(tblXml)) !== null) {
      const trXml = trMatch[1];
      const tcRegex = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
      let tcMatch: RegExpExecArray | null;
      const cells: string[] = [];

      while ((tcMatch = tcRegex.exec(trXml)) !== null) {
        const tcXml = tcMatch[1];
        const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
        let pMatch: RegExpExecArray | null;
        const pTexts: string[] = [];
        while ((pMatch = pRegex.exec(tcXml)) !== null) {
          const t = parseParagraph(pMatch[1]);
          if (t) pTexts.push(t);
        }
        cells.push(pTexts.join(' ').trim());
      }
      if (cells.some(Boolean)) {
        rows.push('| ' + cells.join(' | ') + ' |');
      }
    }
    return rows.join('\n');
  };

  const elemRegex = /<(w:p|w:tbl)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
  let elemMatch: RegExpExecArray | null;
  const blocks: string[] = [];

  while ((elemMatch = elemRegex.exec(bodyXml)) !== null) {
    const tag = elemMatch[1];
    if (tag === 'w:tbl') {
      const tblStr = parseTable(elemMatch[0]);
      if (tblStr) blocks.push(tblStr);
    } else {
      const pStr = parseParagraph(elemMatch[2]);
      if (pStr) blocks.push(pStr);
    }
  }

  return blocks.join('\n');
}

export interface UnifiedParsedAnswer {
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface UnifiedParsedQuestion {
  index: number;
  questionNumber: number;
  title: string;
  questionType: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'ESSAY';
  difficulty: 'RECOGNITION' | 'UNDERSTANDING' | 'APPLICATION' | 'ADVANCED_APPLICATION';
  chapter: string;
  content: string;
  imageUrls: string[];
  explain: string;
  shortAnswer?: string;
  points: number;
  answers: UnifiedParsedAnswer[];
}

function extractImagesFromText(raw: string): { cleanText: string; imageUrls: string[] } {
  const imageUrls: string[] = [];
  const imgRegex = /!\[(?:[^\]]*)\]\((data:image\/[^;]+;base64,[^\s\)]+|https?:\/\/[^\s\)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = imgRegex.exec(raw)) !== null) {
    if (!imageUrls.includes(m[1])) {
      imageUrls.push(m[1]);
    }
  }
  const cleanText = raw.replace(imgRegex, '').replace(/\n{2,}/g, '\n').trim();
  return { cleanText, imageUrls };
}

function cleanOptionContent(raw: string): string {
  return raw
    .replace(/\t+/g, ' ')
    .replace(/\$\s*\.(?=\s|$)/g, '$')
    .replace(/^\.\s*$/, '')
    .trim();
}

/**
 * Phân tích văn bản đề thi đã giải mã MathType/OMML thành danh sách câu hỏi chuẩn,
 * tự động khớp BẢNG ĐÁP ÁN ở cuối file (Trắc nghiệm ABCD, Đúng/Sai a-b-c-d, Trả lời ngắn).
 */
export function parseExamTextWithMathAndKeys(text: string): UnifiedParsedQuestion[] {
  if (!text || !text.trim()) return [];

  const allLines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // 1. Tách phần thân đề thi và phần BẢNG ĐÁP ÁN ở cuối tài liệu
  let keyStartIndex = -1;
  let bodyEndIndex = allLines.length;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    if (/^[-—=\s]*HẾT[-—=\s]*$/i.test(line)) {
      if (bodyEndIndex === allLines.length) bodyEndIndex = i;
    }
    if (/^(?:[-—=\s]*BẢNG\s+ĐÁP\s+ÁN|PHẦN\s+ĐÁP\s+ÁN|ĐÁP\s+ÁN\s*(?:VÀ\s+HƯỚNG\s+DẪN)?|KEY\b)/i.test(line)) {
      keyStartIndex = i;
      if (bodyEndIndex === allLines.length) bodyEndIndex = i;
      break;
    }
  }

  const mcKeyMap: Record<number, string> = {};
  const tfKeyMap: Record<number, boolean[]> = {};
  const saKeyMap: Record<number, string> = {};

  if (keyStartIndex >= 0) {
    const keyLines = allLines.slice(keyStartIndex);

    for (let i = 0; i < keyLines.length; i++) {
      const line = keyLines[i];

      if (line.startsWith('|') && line.endsWith('|')) {
        const cells = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());

        // Trường hợp 1: Hàng tiêu đề câu | C1 | C2 | ... | theo sau bởi hàng đáp án | B | C | ... |
        const nextLine = keyLines[i + 1] || '';
        if (nextLine.startsWith('|') && nextLine.endsWith('|')) {
          const nextCells = nextLine
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());

          if (
            cells.length === nextCells.length &&
            cells.every((c) => /^(?:C|Câu\s*)?\d+$/i.test(c)) &&
            nextCells.every((c) => /^[A-Ea-e]$/.test(c))
          ) {
            cells.forEach((c, idx) => {
              const numMatch = c.match(/(\d+)/);
              if (numMatch) {
                mcKeyMap[parseInt(numMatch[1], 10)] = nextCells[idx].toUpperCase();
              }
            });
            i += 1;
            continue;
          }
        }

        // Trường hợp 2: Hàng bảng Đúng/Sai: | C31 | Đ | S | Đ | Đ | C39 | Đ | Đ | Đ | S |
        let matchedTfInRow = false;
        for (let cIdx = 0; cIdx <= cells.length - 5; cIdx++) {
          const qMatch = cells[cIdx].match(/^(?:C|Câu\s*)?(\d+)$/i);
          if (
            qMatch &&
            /^[ĐSTFđstf]$/.test(cells[cIdx + 1]) &&
            /^[ĐSTFđstf]$/.test(cells[cIdx + 2]) &&
            /^[ĐSTFđstf]$/.test(cells[cIdx + 3]) &&
            /^[ĐSTFđstf]$/.test(cells[cIdx + 4])
          ) {
            const qNum = parseInt(qMatch[1], 10);
            tfKeyMap[qNum] = [
              /^[ĐTđt]$/.test(cells[cIdx + 1]),
              /^[ĐTđt]$/.test(cells[cIdx + 2]),
              /^[ĐTđt]$/.test(cells[cIdx + 3]),
              /^[ĐTđt]$/.test(cells[cIdx + 4]),
            ];
            matchedTfInRow = true;
            cIdx += 4;
          }
        }
        if (matchedTfInRow) continue;

        // Trường hợp 3: Hàng bảng Trả lời ngắn: | C46 | y = 3 | C59 | 28 m |
        for (let cIdx = 0; cIdx <= cells.length - 2; cIdx++) {
          const qMatch = cells[cIdx].match(/^(?:C|Câu\s*)?(\d+)$/i);
          const valCell = cells[cIdx + 1];
          if (
            qMatch &&
            valCell &&
            valCell !== '–' &&
            valCell !== '-' &&
            !/^(?:C|Câu\s*)?\d+$/i.test(valCell) &&
            !/^(?:Đáp\s*số|a|b|c|d)$/i.test(valCell)
          ) {
            const qNum = parseInt(qMatch[1], 10);
            if (!mcKeyMap[qNum] && !tfKeyMap[qNum]) {
              saKeyMap[qNum] = valCell;
              cIdx += 1;
            }
          }
        }
      } else {
        // Các cặp đáp án viết liền trên dòng: "1.A 2.B 3.C" hoặc "Câu 1: B"
        const pairRegex = /(?:^|\s)(?:C|Câu\s*)?(\d+)[\s\.\:\-\=]+([A-Ea-e])(?=\s|$|\b)/g;
        let pm: RegExpExecArray | null;
        while ((pm = pairRegex.exec(line)) !== null) {
          mcKeyMap[parseInt(pm[1], 10)] = pm[2].toUpperCase();
        }
      }
    }
  }

  // 2. Duyệt phần thân đề thi
  const bodyLines = allLines.slice(0, bodyEndIndex);
  const results: UnifiedParsedQuestion[] = [];

  let currentSection: 1 | 2 | 3 | 4 = 1; // 1: Trắc nghiệm ABCD, 2: Đúng/Sai, 3: Trả lời ngắn, 4: Tự luận
  let currentChapter = 'Chương chung';
  let currentQ: {
    localNum: number;
    title: string;
    section: 1 | 2 | 3 | 4;
    stemLines: string[];
    explainLines: string[];
    inExplain: boolean;
    imageUrls: string[];
    answers: UnifiedParsedAnswer[];
    shortAnswer?: string;
    difficulty: UnifiedParsedQuestion['difficulty'];
    chapter: string;
  } | null = null;

  const commitCurrentQuestion = () => {
    if (!currentQ) return;
    const rawStem = currentQ.stemLines.join('\n').trim();
    const { cleanText: cleanStem, imageUrls: stemImgs } = extractImagesFromText(rawStem);
    const allImgs = [...currentQ.imageUrls];
    for (const u of stemImgs) {
      if (!allImgs.includes(u)) allImgs.push(u);
    }

    if (!cleanStem && currentQ.answers.length === 0) {
      currentQ = null;
      return;
    }

    const seqIndex = results.length + 1;
    const lookupNums = [seqIndex, currentQ.localNum];

    let qType: UnifiedParsedQuestion['questionType'] =
      currentQ.section === 2
        ? 'TRUE_FALSE'
        : currentQ.section === 3
          ? 'FILL_BLANK'
          : currentQ.section === 4
            ? 'ESSAY'
            : 'SINGLE_CHOICE';

    let answers = [...currentQ.answers];
    let explain = currentQ.explainLines.join('\n').trim();
    let shortAnswer = currentQ.shortAnswer;

    if (qType === 'SINGLE_CHOICE') {
      if (answers.length === 0) {
        qType = 'ESSAY';
      } else {
        // Tra cứu đáp án đúng từ BẢNG ĐÁP ÁN nếu chưa được đánh dấu trực tiếp
        let keyLetter = '';
        for (const n of lookupNums) {
          if (mcKeyMap[n]) {
            keyLetter = mcKeyMap[n];
            break;
          }
        }
        if (keyLetter) {
          answers = answers.map((a, idx) => {
            const lbl = a.label || String.fromCharCode(65 + idx);
            return { ...a, isCorrect: lbl.toUpperCase() === keyLetter };
          });
        }
        const correctCnt = answers.filter((a) => a.isCorrect).length;
        if (correctCnt > 1) {
          qType = 'MULTIPLE_CHOICE';
        } else if (correctCnt === 0 && answers.length > 0) {
          answers[0].isCorrect = true;
        }
      }
    } else if (qType === 'TRUE_FALSE') {
      let tfFlags: boolean[] | undefined;
      for (const n of lookupNums) {
        if (tfKeyMap[n]) {
          tfFlags = tfKeyMap[n];
          break;
        }
      }
      if (tfFlags && answers.length > 0) {
        answers = answers.map((a, idx) => ({
          ...a,
          isCorrect: tfFlags![idx] ?? a.isCorrect,
        }));
      }
    } else if (qType === 'FILL_BLANK') {
      if (!shortAnswer) {
        for (const n of lookupNums) {
          if (saKeyMap[n]) {
            shortAnswer = saKeyMap[n];
            break;
          }
        }
      }
      if (shortAnswer) {
        answers = [{ label: 'Đáp số', content: shortAnswer, isCorrect: true }];
        if (!explain) explain = `Đáp số đúng: ${shortAnswer}`;
      } else if (answers.length === 0) {
        answers = [{ label: 'Đáp số', content: '(Điền đáp số)', isCorrect: true }];
      }
    } else if (qType === 'ESSAY') {
      if (answers.length === 0) {
        answers = [
          {
            label: 'Tự luận',
            content: 'Học sinh trình bày lời giải chi tiết theo từng bước lập luận.',
            isCorrect: true,
          },
        ];
      }
    }

    const points =
      qType === 'TRUE_FALSE'
        ? 1.0
        : qType === 'FILL_BLANK'
          ? 0.5
          : qType === 'ESSAY'
            ? 2.0
            : 0.25;

    results.push({
      index: seqIndex,
      questionNumber: currentQ.localNum,
      title: currentQ.title,
      questionType: qType,
      difficulty: currentQ.difficulty,
      chapter: currentQ.chapter,
      content: cleanStem,
      imageUrls: allImgs,
      explain,
      shortAnswer,
      points,
      answers,
    });

    currentQ = null;
  };

  for (const rawLine of bodyLines) {
    // Tách hình ảnh nếu dòng có chứa ![Hình minh họa](...)
    const { cleanText: line, imageUrls: lineImgs } = extractImagesFromText(rawLine);
    if (lineImgs.length > 0 && currentQ) {
      for (const u of lineImgs) {
        if (!currentQ.imageUrls.includes(u)) currentQ.imageUrls.push(u);
      }
    }
    if (!line) continue;

    // 1. Nhận diện chuyển Phần (Section I, II, III, B. Tự luận)
    if (
      /^(?:PHẦN\s*(?:1|I)\b|I\.\s*CÂU\s*TRẮC\s*NGHIỆM\s*NHIỀU|I\.\s*TRẮC\s*NGHIỆM\s*NHIỀU)/i.test(line)
    ) {
      commitCurrentQuestion();
      currentSection = 1;
      currentChapter = 'Trắc nghiệm nhiều lựa chọn';
      continue;
    }
    if (
      /^(?:PHẦN\s*(?:2|II)\b|II\.\s*CÂU\s*TRẮC\s*NGHIỆM\s*ĐÚNG|II\.\s*TRẮC\s*NGHIỆM\s*ĐÚNG)/i.test(line)
    ) {
      commitCurrentQuestion();
      currentSection = 2;
      currentChapter = 'Trắc nghiệm Đúng / Sai';
      continue;
    }
    if (
      /^(?:PHẦN\s*(?:3|III)\b|III\.\s*CÂU\s*HỎI\s*TRẮC\s*NGHIỆM\s*TRẢ\s*LỜI\s*NGẮN|III\.\s*TRẮC\s*NGHIỆM\s*TRẢ\s*LỜI\s*NGẮN)/i.test(
        line
      )
    ) {
      commitCurrentQuestion();
      currentSection = 3;
      currentChapter = 'Trắc nghiệm trả lời ngắn';
      continue;
    }
    if (
      /^(?:PHẦN\s*(?:4|IV)\b|B\.\s*BÀI\s*TẬP\s*TỰ\s*LUẬN|IV\.\s*TỰ\s*LUẬN)/i.test(line)
    ) {
      commitCurrentQuestion();
      currentSection = 4;
      currentChapter = 'Bài tập Tự luận';
      continue;
    }

    // Bỏ qua các tiêu đề lớn đầu đề (VD: "ĐỀ CƯƠNG ÔN TẬP...", "A. BÀI TẬP TRẮC NGHIỆM", "NĂM HỌC...")
    if (
      !currentQ &&
      /^(?:ĐỀ\s+CƯƠNG|ĐỀ\s+THI|ĐỀ\s+KIỂM\s+TRA|NĂM\s+HỌC|A\.\s*BÀI\s*TẬP|MÔN[\s\:]|THỜI\s+GIAN)/i.test(
        line
      )
    ) {
      continue;
    }

    // 2. Nhận diện bắt đầu Câu hỏi mới ("Câu 1.", "Bài 1.", "Question 1:")
    const qStartMatch = line.match(/^(?:(Câu\s+hỏi|Câu|Bài|Question)\s*(\d+)[\.\:\)\-\]]+)\s*(.*)/i);
    if (qStartMatch) {
      commitCurrentQuestion();
      const prefixWord = qStartMatch[1];
      const qNum = parseInt(qStartMatch[2], 10);
      let restText = qStartMatch[3].trim();

      let diff: UnifiedParsedQuestion['difficulty'] =
        currentSection === 4
          ? 'APPLICATION'
          : currentSection === 3
            ? 'APPLICATION'
            : currentSection === 2
              ? 'UNDERSTANDING'
              : qNum <= 15
                ? 'RECOGNITION'
                : 'UNDERSTANDING';

      if (/\[(VDC|VẬN DỤNG CAO)\]/i.test(restText) || /vận dụng cao/i.test(restText)) {
        diff = 'ADVANCED_APPLICATION';
        restText = restText.replace(/\[(VDC|VẬN DỤNG CAO)\]/gi, '').trim();
      } else if (/\[(VD|VẬN DỤNG)\]/i.test(restText)) {
        diff = 'APPLICATION';
        restText = restText.replace(/\[(VD|VẬN DỤNG)\]/gi, '').trim();
      } else if (/\[(NB|NHẬN BIẾT)\]/i.test(restText)) {
        diff = 'RECOGNITION';
        restText = restText.replace(/\[(NB|NHẬN BIẾT)\]/gi, '').trim();
      } else if (/\[(TH|THÔNG HIỂU)\]/i.test(restText)) {
        diff = 'UNDERSTANDING';
        restText = restText.replace(/\[(TH|THÔNG HIỂU)\]/gi, '').trim();
      }

      const chapMatch = restText.match(/\[(Chương[^\]]+|Chuyên đề[^\]]+)\]/i);
      let qChapter = currentChapter;
      if (chapMatch) {
        qChapter = chapMatch[1].trim();
        restText = restText.replace(chapMatch[0], '').trim();
      }

      currentQ = {
        localNum: qNum,
        title: `${prefixWord.charAt(0).toUpperCase() + prefixWord.slice(1).toLowerCase()} ${qNum}`,
        section: currentSection,
        stemLines: restText ? [restText] : [],
        explainLines: [],
        inExplain: false,
        imageUrls: [...lineImgs],
        answers: [],
        difficulty: diff,
        chapter: qChapter,
      };
      continue;
    }

    if (!currentQ) continue;

    // 3. Nhận diện dòng "Lời giải:" / "Hướng dẫn giải:"
    const explainMatch = line.match(/^(?:Lời\s*giải|Hướng\s*dẫn\s*giải|Giải\s*chi\s*tiết)[\:\s]*(.*)/i);
    if (explainMatch) {
      currentQ.inExplain = true;
      if (explainMatch[1].trim()) {
        currentQ.explainLines.push(explainMatch[1].trim());
      }
      continue;
    }

    if (currentQ.inExplain) {
      currentQ.explainLines.push(line);
      continue;
    }

    // 4. Bóc tách phương án theo từng Section
    if (currentQ.section === 1) {
      // Hỗ trợ cả phương án nằm trong bảng | A. ... | B. ... |
      const normalizedLine =
        line.startsWith('|') && line.endsWith('|')
          ? line.slice(1, -1).replace(/\|/g, '\t').trim()
          : line;

      if (/^(?:\*|\[x\]\s*)?[A-Ea-e][\.\:\)\/]\s*/.test(normalizedLine)) {
        const optMatches = Array.from(
          normalizedLine.matchAll(
            /(?:^|\t+|\s{2,})(\*|\[x\]\s*)?([A-Ea-e])[\.\:\)\/]\s*([\s\S]*?)(?=(?:\t+(?:\*|\[x\]\s*)?[A-Ea-e][\.\:\)\/]\s*|\s{2,}(?:\*|\[x\]\s*)?[A-Ea-e][\.\:\)\/]\s*|$))/g
          )
        );
        if (optMatches.length > 0) {
          for (const m of optMatches) {
            const isMarked = Boolean(m[1]);
            const letter = m[2].toUpperCase();
            const contentStr = cleanOptionContent(m[3]);
            if (!contentStr) continue;
            currentQ.answers.push({
              label: letter,
              content: contentStr,
              isCorrect: isMarked,
            });
          }
          continue;
        }
      }
      currentQ.stemLines.push(line);
    } else if (currentQ.section === 2) {
      // Các ý a), b), c), d) Đúng / Sai (có thể nằm trên cùng 1 dòng cách nhau bởi \t)
      if (/^(?:\*)?[a-d][\)\.\:]\s*/i.test(line)) {
        const tfMatches = Array.from(
          line.matchAll(
            /(?:^|\t+|\s{2,})(\*)?([a-d])[\)\.\:]\s*([\s\S]*?)(?=(?:\t+\*?[a-d][\)\.\:]\s*|\s{2,}\*?[a-d][\)\.\:]\s*|$))/gi
          )
        );
        if (tfMatches.length > 0) {
          for (const m of tfMatches) {
            const hasStar = Boolean(m[1]);
            const subLabel = m[2].toLowerCase();
            let subContent = m[3].trim();
            const inlineTrue = /\[[ĐT]\]/i.test(subContent) || hasStar;
            subContent = subContent.replace(/\[[ĐSTF]\]/gi, '').trim();
            currentQ.answers.push({
              label: subLabel,
              content: subContent,
              isCorrect: inlineTrue,
            });
          }
          continue;
        }
      }
      currentQ.stemLines.push(line);
    } else if (currentQ.section === 3) {
      // Phần 3: Trả lời ngắn ("Đáp số: ......." hoặc "Trả lời: [[...]]")
      const saLineMatch = line.match(/^(?:Đáp\s*số|Đáp\s*án|Trả\s*lời|Kết\s*quả)[\:\s]*(.*)/i);
      if (saLineMatch) {
        const rawVal = saLineMatch[1]
          .replace(/\[\[(.*?)\]\]/, '$1')
          .replace(/[\.…_]{2,}/g, '')
          .trim();
        if (rawVal && rawVal !== '.') {
          currentQ.shortAnswer = rawVal;
        }
        continue;
      }
      currentQ.stemLines.push(line);
    } else {
      // Phần 4: Bài tập Tự luận
      currentQ.stemLines.push(line);
    }
  }

  commitCurrentQuestion();
  return results;
}


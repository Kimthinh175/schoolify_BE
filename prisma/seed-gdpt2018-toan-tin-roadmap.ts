import 'dotenv/config';
import { PrismaClient, BloomLevel, QuestionFormat } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface SeedQuestionInput {
  id: string;
  subject: 'toan-hoc' | 'tin-hoc';
  grade: 10 | 11 | 12;
  chapterId: number;
  topicTag: string;
  trapTag: string;
  bloomLevel: BloomLevel;
  title: string;
  question: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3; // 0->A, 1->B, 2->C, 3->D
  explanation: string;
}

function rotateChoices(
  correctText: string,
  distractors: [string, string, string],
  seedIdx: number,
): { choices: [string, string, string, string]; correctIndex: 0 | 1 | 2 | 3 } {
  const pos = (seedIdx % 4) as 0 | 1 | 2 | 3;
  const arr: string[] = [...distractors];
  arr.splice(pos, 0, correctText);
  return {
    choices: [arr[0], arr[1], arr[2], arr[3]],
    correctIndex: pos,
  };
}

function bloomByIdx(idx: number): { bloom: BloomLevel; cogLabel: string } {
  // 15 questions: 0..4 NHAN_BIET, 5..9 THONG_HIEU, 10..12 VAN_DUNG, 13..14 VAN_DUNG_CAO
  if (idx < 5) return { bloom: BloomLevel.NHAN_BIET, cogLabel: 'Nhận biết' };
  if (idx < 10) return { bloom: BloomLevel.THONG_HIEU, cogLabel: 'Thông hiểu' };
  if (idx < 13) return { bloom: BloomLevel.VAN_DUNG, cogLabel: 'Vận dụng' };
  return { bloom: BloomLevel.VAN_DUNG_CAO, cogLabel: 'Vận dụng cao' };
}

function nCr(n: number, r: number): number {
  if (r < 0 || r > n) return 0;
  let res = 1;
  for (let i = 1; i <= r; i++) {
    res = Math.round((res * (n - i + 1)) / i);
  }
  return res;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function frac(num: number, den: number): string {
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const g = gcd(num, den);
  const n = num / g;
  const d = den / g;
  if (d === 1) return `${n}`;
  return `\\frac{${n}}{${d}}`;
}

// ============================================================================
// 1. BỘ SINH CÂU HỎI TOÁN LỚP 10 (10 CHƯƠNG: 6 SỐ + 4 HÌNH)
// ============================================================================
function buildMath10Questions(): SeedQuestionInput[] {
  const out: SeedQuestionInput[] = [];

  // Chương 1 (Số): Mệnh đề và Tập hợp
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const a = i + 1;
    const b = i + 5;
    const c = i + 3;
    const d = i + 8;
    // A = [a; b], B = [c; d] với a < c < b < d => A ∩ B = [c; b], số nguyên trong giao = b - c + 1
    const intCount = b - c + 1;
    const isEvenMode = i % 2 === 0;
    const qText = isEvenMode
      ? `Cho hai tập hợp $A = [${a}; ${b}]$ và $B = [${c}; ${d}]$. Tập hợp $A \\cap B$ có bao nhiêu phần tử là số nguyên?`
      : `Cho mệnh đề chứa biến $P(x): "x^2 - ${a + b}x + ${a * b} = 0"$ với $x \\in \\mathbb{R}$. Tổng các giá trị của $x$ để $P(x)$ là mệnh đề đúng bằng:`;
    const correct = isEvenMode ? `$${intCount}$` : `$${a + b}$`;
    const distractors: [string, string, string] = isEvenMode
      ? [`$${intCount - 1}$`, `$${intCount + 1}$`, `$${d - a + 1}$`]
      : [`$${a * b}$`, `$${-(a + b)}$`, `$${b - a}$`];
    const explain = isEvenMode
      ? `Ta có $A \\cap B = [${a}; ${b}] \\cap [${c}; ${d}] = [${c}; ${b}]$. Các số nguyên thuộc đoạn $[${c}; ${b}]$ gồm $${b} - ${c} + 1 = ${intCount}$ phần tử.`
      : `Phương trình $x^2 - ${a + b}x + ${a * b} = 0$ có hai nghiệm phân biệt $x_1 = ${a}$ và $x_2 = ${b}$. Tổng các giá trị của $x$ là $${a} + ${b} = ${a + b}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-toan10-ch1-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 1,
      topicTag: 'Mệnh đề và các phép toán tập hợp',
      trapTag: 'Nhầm đầu mút đóng/mở khi đếm phần tử nguyên của tập hợp',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Mệnh đề & Tập hợp`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 2 (Số): Bất phương trình và hệ BPT bậc nhất hai ẩn
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const p = i + 2;
    const q = i + 3;
    const x0 = 2 + (i % 4);
    const y0 = 1 + (i % 3);
    const val = p * x0 + q * y0;
    const rhs = val + 2;
    const { choices, correctIndex } = rotateChoices(
      `$(${x0}; ${y0})$`,
      [`$(${x0 + 2}; ${y0 + 2})$`, `$(${x0 + 3}; ${y0 + 1})$`, `$(${x0 + 1}; ${y0 + 3})$`],
      i + 2,
    );
    out.push({
      id: `gdpt18-toan10-ch2-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 2,
      topicTag: 'Bất phương trình và hệ bất phương trình bậc nhất hai ẩn',
      trapTag: 'Thay nhầm hoành độ x và tung độ y khi kiểm tra miền nghiệm',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Miền nghiệm BPT bậc nhất hai ẩn`,
      question: `Cặp số $(x; y)$ nào dưới đây thuộc miền nghiệm của bất phương trình $${p}x + ${q}y \\le ${rhs}$?`,
      choices,
      correctIndex,
      explanation: `Thay tọa độ điểm $(${x0}; ${y0})$ vào vế trái ta được: $${p}\\cdot ${x0} + ${q}\\cdot ${y0} = ${val} \\le ${rhs}$ (luôn đúng). Các điểm còn lại đều làm vế trái lớn hơn $${rhs}$.`,
    });
  }

  // Chương 3 (Hình): Hệ thức lượng trong tam giác
  const triTriples = [
    { a: 3, b: 5, deg: 120, c: 7 }, // 9+25+15=49 -> c=7
    { a: 5, b: 8, deg: 60, c: 7 },  // 25+64-40=49 -> c=7
    { a: 7, b: 8, deg: 60, c: 7 },  // wait: 49+64-56=57; let's compute c^2 exactly!
  ];
  void triTriples;
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const bSide = 4 + (i % 5) * 2;
    const cSide = 6 + (i % 4) * 2;
    // Góc A = 60 độ => cos60 = 1/2, sin60 = sqrt(3)/2
    // a^2 = b^2 + c^2 - b*c; S = 1/2 * b * c * sin60 = (b*c/4)*sqrt(3)
    const isArea = i % 2 === 1;
    const a2 = bSide * bSide + cSide * cSide - bSide * cSide;
    const areaCoef = (bSide * cSide) / 4;
    const qText = isArea
      ? `Cho tam giác $ABC$ có $AB = ${cSide}$, $AC = ${bSide}$ và $\\widehat{A} = 60^\\circ$. Diện tích tam giác $ABC$ bằng:`
      : `Cho tam giác $ABC$ có $AC = ${bSide}$, $AB = ${cSide}$ và $\\widehat{A} = 60^\\circ$. Giá trị của $BC^2$ bằng:`;
    const correct = isArea ? `$${areaCoef}\\sqrt{3}$` : `$${a2}$`;
    const distractors: [string, string, string] = isArea
      ? [`$${areaCoef * 2}\\sqrt{3}$`, `$${areaCoef}$`, `$${areaCoef * 2}$`]
      : [`$${bSide * bSide + cSide * cSide}$`, `$${bSide * bSide + cSide * cSide + bSide * cSide}$`, `$${Math.abs(a2 - bSide)}$`];
    const explain = isArea
      ? `Áp dụng công thức diện tích: $S = \\frac{1}{2} AB \\cdot AC \\cdot \\sin A = \\frac{1}{2} \\cdot ${cSide} \\cdot ${bSide} \\cdot \\frac{\\sqrt{3}}{2} = ${areaCoef}\\sqrt{3}$.`
      : `Áp dụng định lý Côsin trong tam giác $ABC$: $BC^2 = AB^2 + AC^2 - 2\\cdot AB\\cdot AC\\cdot \\cos 60^\\circ = ${cSide}^2 + ${bSide}^2 - ${cSide}\\cdot ${bSide} = ${a2}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 3);
    out.push({
      id: `gdpt18-toan10-ch3-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 3,
      topicTag: 'Định lý Côsin, Định lý Sin và diện tích tam giác',
      trapTag: 'Quên hệ số 2 hoặc nhầm dấu cộng/trừ trong định lý Côsin',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Hệ thức lượng trong tam giác`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 4 (Hình): Vectơ trong mặt phẳng
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const ux = i + 1;
    const uy = -(2 + (i % 4));
    const vx = 3 + (i % 5);
    const vy = 2 + (i % 3);
    const dot = ux * vx + uy * vy;
    const sumX = 2 * ux - vx;
    const sumY = 2 * uy - vy;
    const isDot = i % 2 === 0;
    const qText = isDot
      ? `Trong mặt phẳng tọa độ $Oxy$, cho hai vectơ $\\vec{u} = (${ux}; ${uy})$ và $\\vec{v} = (${vx}; ${vy})$. Tích vô hướng $\\vec{u} \\cdot \\vec{v}$ bằng:`
      : `Trong mặt phẳng $Oxy$, cho $\\vec{u} = (${ux}; ${uy})$ và $\\vec{v} = (${vx}; ${vy})$. Tọa độ của vectơ $\\vec{w} = 2\\vec{u} - \\vec{v}$ là:`;
    const correct = isDot ? `$${dot}$` : `$(${sumX}; ${sumY})$`;
    const distractors: [string, string, string] = isDot
      ? [`$${ux * vx - uy * vy}$`, `$${ux + vx + uy + vy}$`, `$${dot + 4}$`]
      : [`$(${2 * ux + vx}; ${2 * uy + vy})$`, `$(${ux - 2 * vx}; ${uy - 2 * vy})$`, `$(${sumY}; ${sumX})$`];
    const explain = isDot
      ? `Áp dụng công thức tích vô hướng: $\\vec{u} \\cdot \\vec{v} = x_1 x_2 + y_1 y_2 = ${ux}\\cdot ${vx} + (${uy})\\cdot ${vy} = ${dot}$.`
      : `Ta có $2\\vec{u} = (${2 * ux}; ${2 * uy})$, suy ra $2\\vec{u} - \\vec{v} = (${2 * ux} - ${vx}; ${2 * uy} - ${vy}) = (${sumX}; ${sumY})$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-toan10-ch4-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 4,
      topicTag: 'Vectơ và tích vô hướng trong mặt phẳng',
      trapTag: 'Nhầm dấu tọa độ tung độ âm khi tính tích vô hướng',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Phép toán vectơ & Tích vô hướng`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 5 (Số): Các số đặc trưng của mẫu số liệu không ghép nhóm
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const base = 2 + i;
    // Mẫu 5 số: base, base+2, base+4, base+6, base+8 => trung bình = base+4, trung vị = base+4, khoảng biến thiên = 8, phương sai = (16+4+0+4+16)/5 = 8
    const arr = [base, base + 2, base + 4, base + 6, base + 12];
    // Tổng = 5*base + 24? Let's make sum divisible by 5: base, base+1, base+4, base+6, base+9 -> sum = 5*base + 20 => mean = base+4, median = base+4, R = 9
    const s = [base, base + 1, base + 4, base + 6, base + 9];
    const mean = base + 4;
    const rangeR = 9 + (i % 3);
    const sCustom = [base, base + 2, base + 4, base + 5, base + rangeR];
    const sumCustom = sCustom.reduce((acc, v) => acc + v, 0);
    const askMean = i % 2 === 0;
    const qText = askMean
      ? `Cho mẫu số liệu gồm $5$ giá trị: $${s.join(';\\ ')}$ . Số trung bình cộng $\\bar{x}$ của mẫu số liệu trên bằng:`
      : `Cho mẫu số liệu: $${sCustom.join(';\\ ')}$ . Khoảng biến thiên $R$ của mẫu số liệu này bằng:`;
    const correct = askMean ? `$${mean}$` : `$${rangeR}$`;
    const distractors: [string, string, string] = askMean
      ? [`$${mean + 1}$`, `$${mean - 1}$`, `$${base + 5}$`]
      : [`$${rangeR - 2}$`, `$${Math.round(sumCustom / 5)}$`, `$${base + rangeR}$`];
    const explain = askMean
      ? `Số trung bình cộng $\\bar{x} = \\frac{${s.join(' + ')}}{5} = \\frac{${5 * mean}}{5} = ${mean}$.`
      : `Khoảng biến thiên $R = x_{\\max} - x_{\\min} = ${base + rangeR} - ${base} = ${rangeR}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i);
    out.push({
      id: `gdpt18-toan10-ch5-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 5,
      topicTag: 'Số trung bình, trung vị và độ phân tán mẫu không ghép nhóm',
      trapTag: 'Nhầm lẫn giữa khoảng biến thiên và giá trị trung bình',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Thống kê mẫu không ghép nhóm`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 6 (Số): Hàm số, đồ thị và ứng dụng (Parabol & Tam thức bậc hai)
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const h = (i % 5) + 1;
    const k = i - 3;
    // y = x^2 - 2hx + (h^2 + k) => đỉnh I(h; k)
    const cCoef = h * h + k;
    const signC = cCoef >= 0 ? `+ ${cCoef}` : `- ${Math.abs(cCoef)}`;
    const isVertex = i % 2 === 0;
    const r1 = 1 + (i % 4);
    const r2 = r1 + 3 + (i % 3);
    // f(x) = x^2 - (r1+r2)x + r1*r2 < 0 <=> x in (r1; r2)
    const qText = isVertex
      ? `Trong mặt phẳng tọa độ $Oxy$, tọa độ đỉnh $I$ của parabol $(P): y = x^2 - ${2 * h}x ${signC}$ là:`
      : `Tập nghiệm của bất phương trình bậc hai $x^2 - ${r1 + r2}x + ${r1 * r2} < 0$ là:`;
    const correct = isVertex ? `$I(${h}; ${k})$` : `$(${r1}; ${r2})$`;
    const distractors: [string, string, string] = isVertex
      ? [`$I(${-h}; ${k})$`, `$I(${2 * h}; ${cCoef})$`, `$I(${h}; ${cCoef})$`]
      : [`$(-\\infty; ${r1}) \\cup (${r2}; +\\infty)$`, `$[${r1}; ${r2}]$`, `$(${-r2}; ${-r1})$`];
    const explain = isVertex
      ? `Hoành độ đỉnh $x_I = -\\frac{b}{2a} = \\frac{${2 * h}}{2} = ${h}$. Tung độ đỉnh $y_I = ${h}^2 - ${2 * h}\\cdot ${h} ${signC} = ${k}$. Vậy $I(${h}; ${k})$.`
      : `Tam thức $f(x) = x^2 - ${r1 + r2}x + ${r1 * r2}$ có hệ số $a = 1 > 0$ và hai nghiệm $x_1 = ${r1}, x_2 = ${r2}$. Theo quy tắc dấu tam thức bậc hai ("trong trái, ngoài cùng"), $f(x) < 0 \\Leftrightarrow x \\in (${r1}; ${r2})$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 2);
    out.push({
      id: `gdpt18-toan10-ch6-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 6,
      topicTag: 'Hàm số bậc hai và dấu của tam thức bậc hai',
      trapTag: 'Quên dấu trừ trong công thức hoành độ đỉnh -b/(2a)',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Hàm số bậc hai & Tam thức bậc hai`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 7 (Hình - id 7): Đường thẳng và Đường tròn trong mặt phẳng Oxy
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    // d(M(x0; y0), 3x - 4y + c = 0) với mẫu = 5
    const x0 = 1 + (i % 5);
    const y0 = 2 + (i % 4);
    const distWanted = 2 + (i % 4);
    const cVal = 5 * distWanted - (3 * x0 - 4 * y0);
    const cStr = cVal >= 0 ? `+ ${cVal}` : `- ${Math.abs(cVal)}`;
    const r = 3 + (i % 5);
    const isCircle = i % 2 === 1;
    const qText = isCircle
      ? `Trong mặt phẳng $Oxy$, đường tròn $(C): (x - ${x0})^2 + (y + ${y0})^2 = ${r * r}$ có tâm $I$ và bán kính $R$ lần lượt là:`
      : `Trong mặt phẳng $Oxy$, khoảng cách từ điểm $M(${x0}; ${y0})$ đến đường thẳng $\\Delta: 3x - 4y ${cStr} = 0$ bằng:`;
    const correct = isCircle ? `$I(${x0}; -${y0}),\\ R = ${r}$` : `$${distWanted}$`;
    const distractors: [string, string, string] = isCircle
      ? [`$I(-${x0}; ${y0}),\\ R = ${r}$`, `$I(${x0}; -${y0}),\\ R = ${r * r}$`, `$I(${x0}; ${y0}),\\ R = ${r}$`]
      : [`$${distWanted * 5}$`, `$${distWanted + 1}$`, `$\\frac{${distWanted}}{5}$`];
    const explain = isCircle
      ? `Phương trình đường tròn $(x - a)^2 + (y - b)^2 = R^2$ có tâm $I(${x0}; -${y0})$ và bán kính $R = \\sqrt{${r * r}} = ${r}$.`
      : `Áp dụng công thức khoảng cách: $d(M, \\Delta) = \\frac{|3\\cdot ${x0} - 4\\cdot ${y0} ${cStr}|}{\\sqrt{3^2 + (-4)^2}} = \\frac{${5 * distWanted}}{5} = ${distWanted}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-toan10-ch7-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 7,
      topicTag: 'Phương trình đường thẳng và đường tròn trong Oxy',
      trapTag: 'Quên đổi dấu tọa độ tâm hoặc quên khai căn R^2 trong phương trình đường tròn',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Đường thẳng & Đường tròn Oxy`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 8 (Số - id 8): Đại số tổ hợp
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const n = 6 + (i % 6);
    const k = 2 + (i % 3);
    const comb = nCr(n, k);
    const perm = k === 2 ? n * (n - 1) : k === 3 ? n * (n - 1) * (n - 2) : n * (n - 1) * (n - 2) * (n - 3);
    const isNewton = i >= 10;
    // Hệ số của x^2 trong (1 + 2x)^n = C(n,2)*4
    const nNewt = 4 + (i % 4);
    const coefNewt = nCr(nNewt, 2) * 4;
    const qText = isNewton
      ? `Hệ số của số hạng chứa $x^2$ trong khai triển nhị thức Newton $(1 + 2x)^{${nNewt}}$ bằng:`
      : `Một tổ học sinh gồm $${n}$ bạn. Số cách chọn ra $${k}$ bạn bất kỳ để tham gia đội tình nguyện (không phân biệt chức vụ) là:`;
    const correct = isNewton ? `$${coefNewt}$` : `$${comb}$`;
    const distractors: [string, string, string] = isNewton
      ? [`$${nCr(nNewt, 2)}$`, `$${nCr(nNewt, 2) * 2}$`, `$${coefNewt * 2}$`]
      : [`$${perm}$`, `$${n * k}$`, `$${comb + n}$`];
    const explain = isNewton
      ? `Số hạng tổng quát là $T_{m+1} = C_{${nNewt}}^m (2x)^m = C_{${nNewt}}^m 2^m x^m$. Ứng với $x^2 \\Rightarrow m = 2$, hệ số là $C_{${nNewt}}^2 \\cdot 2^2 = ${nCr(nNewt, 2)} \\cdot 4 = ${coefNewt}$.`
      : `Chọn $${k}$ bạn từ $${n}$ bạn không phân biệt thứ tự là một tổ hợp chập $${k}$ của $${n}$: $C_{${n}}^{${k}} = ${comb}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 3);
    out.push({
      id: `gdpt18-toan10-ch8-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 8,
      topicTag: 'Hoán vị, chỉnh hợp, tổ hợp và Nhị thức Newton',
      trapTag: 'Nhầm lẫn giữa chỉnh hợp A_n^k (có thứ tự) và tổ hợp C_n^k (không thứ tự)',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Đại số tổ hợp & Nhị thức Newton`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 9 (Số - id 9): Tính xác suất theo định nghĩa cổ điển
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const red = 3 + (i % 4);
    const blue = 4 + (i % 3);
    const total = red + blue;
    const totalWays = nCr(total, 2);
    const sameRed = nCr(red, 2);
    const pStr = `$${frac(sameRed, totalWays)}$`;
    const pWrong1 = `$${frac(red, total)}$`;
    const pWrong2 = `$${frac(sameRed + 1, totalWays)}$`;
    const pWrong3 = `$${frac(red * blue, totalWays)}$`;
    const { choices, correctIndex } = rotateChoices(pStr, [pWrong1, pWrong2, pWrong3], i + 2);
    out.push({
      id: `gdpt18-toan10-ch9-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 9,
      topicTag: 'Biến cố và xác suất theo định nghĩa cổ điển',
      trapTag: 'Tính thiếu không gian mẫu C_n^2 khi lấy đồng thời 2 quả cầu',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Tính xác suất cổ điển`,
      question: `Một hộp chứa $${red}$ quả cầu đỏ và $${blue}$ quả cầu xanh kích thước giống hệt nhau. Lấy ngẫu nhiên đồng thời $2$ quả cầu. Xác suất để cả $2$ quả lấy ra đều màu đỏ bằng:`,
      choices,
      correctIndex,
      explanation: `Số phần tử không gian mẫu là $n(\\Omega) = C_{${total}}^2 = ${totalWays}$. Số kết quả thuận lợi cho biến cố $A$ ("cả 2 quả màu đỏ") là $n(A) = C_{${red}}^2 = ${sameRed}$. Vậy $P(A) = \\frac{${sameRed}}{${totalWays}} = ${frac(sameRed, totalWays)}$.`,
    });
  }

  // Chương 7B (Hình - id 10): Ba đường Conic trong mặt phẳng Oxy
  const pythagTriples = [
    { a: 5, b: 3, c: 4 },
    { a: 5, b: 4, c: 3 },
    { a: 10, b: 6, c: 8 },
    { a: 13, b: 5, c: 12 },
    { a: 13, b: 12, c: 5 },
    { a: 15, b: 9, c: 12 },
    { a: 17, b: 8, c: 15 },
  ];
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const tr = pythagTriples[i % pythagTriples.length];
    const isParabola = i % 3 === 2;
    const pPar = (i % 5 + 1) * 2; // y^2 = 2px => F(p/2; 0)
    const qText = isParabola
      ? `Trong mặt phẳng $Oxy$, tọa độ tiêu điểm $F$ của parabol $(P): y^2 = ${2 * pPar}x$ là:`
      : `Trong mặt phẳng $Oxy$, cho elip $(E): \\frac{x^2}{${tr.a * tr.a}} + \\frac{y^2}{${tr.b * tr.b}} = 1$. Tiêu cự $2c$ của elip $(E)$ bằng:`;
    const correct = isParabola ? `$F\\left(${pPar / 2}; 0\\right)$` : `$${2 * tr.c}$`;
    const distractors: [string, string, string] = isParabola
      ? [`$F(${pPar}; 0)$`, `$F(${2 * pPar}; 0)$`, `$F\\left(0; ${pPar / 2}\\right)$`]
      : [`$${tr.c}$`, `$${2 * tr.a}$`, `$${2 * tr.b}$`];
    const explain = isParabola
      ? `Phương trình chính tắc parabol có dạng $y^2 = 2px \\Rightarrow 2p = ${2 * pPar} \\Leftrightarrow p = ${pPar}$. Tiêu điểm là $F\\left(\\frac{p}{2}; 0\\right) = F\\left(${pPar / 2}; 0\\right)$.`
      : `Ta có $a^2 = ${tr.a * tr.a},\\ b^2 = ${tr.b * tr.b} \\Rightarrow c = \\sqrt{a^2 - b^2} = \\sqrt{${tr.a * tr.a - tr.b * tr.b}} = ${tr.c}$. Suy ra tiêu cự của elip là $2c = ${2 * tr.c}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-toan10-ch10-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 10,
      chapterId: 10,
      topicTag: 'Ba đường Conic (Elip, Hypebol, Parabol)',
      trapTag: 'Nhầm bán tiêu cự c với tiêu cự 2c hoặc nhầm c^2 = a^2 + b^2 của Hypebol cho Elip',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Ba đường Conic trong Oxy`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  return out;
}

// ============================================================================
// 2. BỘ SINH CÂU HỎI TOÁN LỚP 11 (11 CHƯƠNG: 7 SỐ + 4 HÌNH)
// ============================================================================
function buildMath11Questions(): SeedQuestionInput[] {
  const out: SeedQuestionInput[] = [];

  // Chương 1 (Số): Hàm số lượng giác & PT lượng giác
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const amp = 2 + (i % 6);
    const shift = i + 1;
    // y = amp * sin(2x) + shift => max = amp + shift, min = -amp + shift
    const isMax = i % 2 === 0;
    const qText = isMax
      ? `Giá trị lớn nhất $M$ của hàm số $y = ${amp}\\sin 2x + ${shift}$ trên $\\mathbb{R}$ bằng:`
      : `Chu kỳ tuần hoàn $T$ của hàm số $y = \\cos\\left(${amp}x + \\frac{\\pi}{3}\\right)$ là:`;
    const correct = isMax ? `$${amp + shift}$` : `$${frac(2, amp) === '1' ? '\\pi' : `\\frac{2\\pi}{${amp}}`}$`;
    const tCorrectClean = amp === 2 ? '$\\pi$' : amp === 4 ? '$\\frac{\\pi}{2}$' : amp === 6 ? '$\\frac{\\pi}{3}$' : `$\\frac{2\\pi}{${amp}}$`;
    const finalCorrect = isMax ? correct : tCorrectClean;
    const distractors: [string, string, string] = isMax
      ? [`$${shift - amp}$`, `$${2 * amp + shift}$`, `$${shift}$`]
      : [`$${amp}\\pi$`, `$2\\pi$`, `$\\frac{\\pi}{${amp * 2}}$`];
    const explain = isMax
      ? `Do $-1 \\le \\sin 2x \\le 1$ nên $-${amp} + ${shift} \\le ${amp}\\sin 2x + ${shift} \\le ${amp + shift}$. Vậy giá trị lớn nhất $M = ${amp + shift}$.`
      : `Hàm số $y = \\cos(ax + b)$ tuần hoàn với chu kỳ $T = \\frac{2\\pi}{|a|} = \\frac{2\\pi}{${amp}}$ (${tCorrectClean.replace(/\$/g, '')}).`;
    const { choices, correctIndex } = rotateChoices(finalCorrect, distractors, i + 1);
    out.push({
      id: `gdpt18-toan11-ch1-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 1,
      topicTag: 'Hàm số lượng giác và phương trình lượng giác',
      trapTag: 'Nhầm hệ số góc bên trong sin(kx) làm ảnh hưởng tập giá trị hàm số',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Hàm số & Phương trình lượng giác`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 2 (Số): Dãy số, CSC & CSN
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const u1 = 2 + (i % 5);
    const d = 3 + (i % 4);
    const n = 8 + (i % 5);
    // CSC: u_n = u1 + (n-1)d, S_n = n*(2*u1 + (n-1)*d)/2
    const un = u1 + (n - 1) * d;
    const sn = (n * (2 * u1 + (n - 1) * d)) / 2;
    const askSum = i % 2 === 1;
    const qText = askSum
      ? `Cho cấp số cộng $(u_n)$ có số hạng đầu $u_1 = ${u1}$ và công sai $d = ${d}$. Tổng $${n}$ số hạng đầu tiên $S_{${n}}$ bằng:`
      : `Cho cấp số cộng $(u_n)$ có $u_1 = ${u1}$ và công sai $d = ${d}$. Giá trị của số hạng $u_{${n}}$ bằng:`;
    const correct = askSum ? `$${sn}$` : `$${un}$`;
    const distractors: [string, string, string] = askSum
      ? [`$${sn + d}$`, `$${n * un}$`, `$${sn - u1}$`]
      : [`$${u1 + n * d}$`, `$${un - d}$`, `$${u1 * n + d}$`];
    const explain = askSum
      ? `Áp dụng công thức tổng cấp số cộng: $S_{${n}} = \\frac{${n}[2\\cdot ${u1} + (${n}-1)\\cdot ${d}]}{2} = ${sn}$.`
      : `Số hạng tổng quát cấp số cộng: $u_{${n}} = u_1 + (${n}-1)d = ${u1} + ${n - 1}\\cdot ${d} = ${un}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 2);
    out.push({
      id: `gdpt18-toan11-ch2-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 2,
      topicTag: 'Dãy số, Cấp số cộng và Cấp số nhân',
      trapTag: 'Nhầm u_n = u_1 + n*d thay vì u_1 + (n-1)*d',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Cấp số cộng & Cấp số nhân`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 3 (Số): Mẫu số liệu ghép nhóm (Xu thế trung tâm)
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    // 3 nhóm [10;20), [20;30), [30;40) đại diện 15, 25, 35 với tần số f1, f2, f3 (tổng 20)
    const f1 = 4 + (i % 4);
    const f3 = f1; // đối xứng quanh 25 => trung bình đúng bằng 25! Hoặc dịch mốc start!
    const start = (i + 1) * 10;
    const mid1 = start + 5;
    const mid2 = start + 15;
    const mid3 = start + 25;
    const f2 = 20 - f1 - f3;
    const { choices, correctIndex } = rotateChoices(
      `$${mid2}$`,
      [`$${mid1}$`, `$${mid3}$`, `$${mid2 + 2}$`],
      i + 1,
    );
    out.push({
      id: `gdpt18-toan11-ch3-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 3,
      topicTag: 'Số đặc trưng đo xu thế trung tâm mẫu ghép nhóm',
      trapTag: 'Quên lấy giá trị đại diện trung điểm mỗi khoảng ghép nhóm khi tính trung bình',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Mẫu số liệu ghép nhóm`,
      question: `Khảo sát thời gian tự học (phút) của $20$ học sinh thu được bảng ghép nhóm: $[${start}; ${start + 10})$ có $${f1}$ em; $[${start + 10}; ${start + 20})$ có $${f2}$ em; $[${start + 20}; ${start + 30})$ có $${f3}$ em. Số trung bình ước lượng của mẫu số liệu ghép nhóm bằng:`,
      choices,
      correctIndex,
      explanation: `Giá trị đại diện các nhóm lần lượt là $${mid1},\\ ${mid2},\\ ${mid3}$. Số trung bình $\\bar{x} = \\frac{${f1}\\cdot ${mid1} + ${f2}\\cdot ${mid2} + ${f3}\\cdot ${mid3}}{20} = ${mid2}$.`,
    });
  }

  // Chương 4A (Hình - id 4): Đại cương mặt phẳng & Hai đường thẳng song song
  const geo11A = [
    {
      q: 'Trong không gian, qua ba điểm phân biệt không thẳng hàng xác định được bao nhiêu mặt phẳng?',
      c: 'Duy nhất $1$ mặt phẳng',
      d: ['$2$ mặt phẳng', '$3$ mặt phẳng', 'Vô số mặt phẳng'] as [string, string, string],
      ex: 'Theo tiên đề cơ bản của hình học không gian: Có một và chỉ một mặt phẳng đi qua ba điểm không thẳng hàng.',
    },
    {
      q: 'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình bình hành tâm $O$. Giao tuyến của hai mặt phẳng $(SAC)$ và $(SBD)$ là đường thẳng:',
      c: '$SO$',
      d: ['$SA$', '$AC$', '$BD$'] as [string, string, string],
      ex: '$S$ là điểm chung thứ nhất; $O = AC \\cap BD$ thuộc cả $(SAC)$ và $(SBD)$ nên $O$ là điểm chung thứ hai. Vậy $(SAC) \\cap (SBD) = SO$.',
    },
    {
      q: 'Trong không gian, hai đường thẳng không có điểm chung và không cùng nằm trong bất kỳ mặt phẳng nào được gọi là:',
      c: 'Hai đường thẳng chéo nhau',
      d: ['Hai đường thẳng song song', 'Hai đường thẳng cắt nhau', 'Hai đường thẳng trùng nhau'] as [string, string, string],
      ex: 'Hai đường thẳng không đồng phẳng thì chéo nhau (không cắt nhau và không song song).',
    },
    {
      q: 'Cho tứ diện $ABCD$. Gọi $M, N$ lần lượt là trung điểm của $AB$ và $AC$. Khẳng định nào sau đây đúng?',
      c: '$MN \\parallel BC$',
      d: ['$MN \\parallel BD$', '$MN$ cắt $BC$', '$MN$ chéo $BC$'] as [string, string, string],
      ex: 'Trong tam giác $ABC$, $MN$ là đường trung bình ứng với cạnh $BC$ nên $MN \\parallel BC$ và $MN = \\frac{1}{2}BC$.',
    },
    {
      q: 'Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình thang với đáy lớn $AB \\parallel CD$. Giao tuyến của hai mặt phẳng $(SAB)$ và $(SCD)$ là:',
      c: 'Đường thẳng $Sx$ qua $S$ và song song với $AB, CD$',
      d: ['Đường thẳng $SO$ với $O = AC \\cap BD$', 'Đường thẳng $SD$', 'Đường thẳng $AB$'] as [string, string, string],
      ex: 'Hai mặt phẳng $(SAB)$ và $(SCD)$ có điểm chung $S$ và lần lượt chứa hai đường thẳng song song $AB \\parallel CD$, nên giao tuyến là đường thẳng qua $S$ song song với $AB$ và $CD$.',
    },
  ];
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    if (i < 5) {
      const item = geo11A[i];
      const { choices, correctIndex } = rotateChoices(item.c, item.d, i + 1);
      out.push({
        id: `gdpt18-toan11-ch4-q${String(i + 1).padStart(2, '0')}`,
        subject: 'toan-hoc',
        grade: 11,
        chapterId: 4,
        topicTag: 'Giao tuyến mặt phẳng và hai đường thẳng song song',
        trapTag: 'Nhầm lẫn giữa hai đường thẳng song song và hai đường thẳng chéo nhau trong không gian',
        bloomLevel: bloom,
        title: `Câu ${i + 1} (${cogLabel}): Đại cương mặt phẳng & Hai đường song song`,
        question: item.q,
        choices,
        correctIndex,
        explanation: item.ex,
      });
    } else {
      const bcLen = (i - 2) * 4;
      const mnLen = bcLen / 2;
      const { choices, correctIndex } = rotateChoices(
        `$${mnLen}$`,
        [`$${bcLen}$`, `$${mnLen / 2}$`, `$${bcLen + 2}$`],
        i,
      );
      out.push({
        id: `gdpt18-toan11-ch4-q${String(i + 1).padStart(2, '0')}`,
        subject: 'toan-hoc',
        grade: 11,
        chapterId: 4,
        topicTag: 'Giao tuyến mặt phẳng và hai đường thẳng song song',
        trapTag: 'Quên hệ số 1/2 của đường trung bình khi tính độ dài đoạn giao tuyến',
        bloomLevel: bloom,
        title: `Câu ${i + 1} (${cogLabel}): Đường trung bình & Thiết diện tam giác`,
        question: `Cho tứ diện $ABCD$ có cạnh $BC = ${bcLen}\\text{ cm}$. Gọi $M, N$ lần lượt là trung điểm của $AB$ và $AC$. Độ dài đoạn thẳng $MN$ bằng:`,
        choices,
        correctIndex,
        explanation: `Trong $\\triangle ABC$, $MN$ là đường trung bình nên $MN \\parallel BC$ và $MN = \\frac{1}{2}BC = \\frac{${bcLen}}{2} = ${mnLen}\\text{ cm}$.`,
      });
    }
  }

  // Chương 5 (Số - id 5): Giới hạn & Hàm số liên tục
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const a = 2 + (i % 5);
    // lim_{x -> a} (x^2 - a^2)/(x - a) = 2a
    const p = 3 + i;
    const q = 1 + (i % 3);
    const isSeq = i % 2 === 0;
    const qText = isSeq
      ? `Giá trị của giới hạn $\\lim_{n \\to +\\infty} \\frac{${p * q}n + 5}{${q}n - 2}$ bằng:`
      : `Giá trị của giới hạn $\\lim_{x \\to ${a}} \\frac{x^2 - ${a * a}}{x - ${a}}$ bằng:`;
    const correct = isSeq ? `$${p}$` : `$${2 * a}$`;
    const distractors: [string, string, string] = isSeq
      ? [`$0$`, `$+\\infty$`, `$\\frac{-5}{2}$`]
      : [`$${a}$`, `$0$`, `$${a * a}$`];
    const explain = isSeq
      ? `Chia cả tử và mẫu cho $n$: $\\lim_{n \\to +\\infty} \\frac{${p * q} + \\frac{5}{n}}{${q} - \\frac{2}{n}} = \\frac{${p * q}}{${q}} = ${p}$.`
      : `Khử dạng vô định $\\frac{0}{0}$: $\\lim_{x \\to ${a}} \\frac{(x - ${a})(x + ${a})}{x - ${a}} = \\lim_{x \\to ${a}} (x + ${a}) = ${2 * a}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-toan11-ch5-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 5,
      topicTag: 'Giới hạn dãy số, giới hạn hàm số và hàm số liên tục',
      trapTag: 'Không rút gọn nhân tử chung (x - x0) trước khi thay cận giới hạn dạng 0/0',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Giới hạn & Hàm số liên tục`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 6 (Số - id 6): Hàm số mũ và hàm số lôgarit
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const k = 2 + (i % 4); // 2^k = 4, 8, 16, 32
    const shift = i + 1;
    const powVal = Math.pow(2, k);
    const sol = powVal + shift;
    const isLog = i % 2 === 1;
    const qText = isLog
      ? `Nghiệm của phương trình $\\log_2(x - ${shift}) = ${k}$ là:`
      : `Nghiệm của phương trình mũ $3^{x - ${shift}} = ${Math.pow(3, k % 4 + 1)}$ là:`;
    const expRight = (k % 4) + 1;
    const solExp = shift + expRight;
    const correct = isLog ? `$x = ${sol}$` : `$x = ${solExp}$`;
    const distractors: [string, string, string] = isLog
      ? [`$x = ${2 * k + shift}$`, `$x = ${powVal - shift}$`, `$x = ${powVal}$`]
      : [`$x = ${expRight}$`, `$x = ${Math.pow(3, expRight) + shift}$`, `$x = ${solExp + 1}$`];
    const explain = isLog
      ? `Điều kiện $x > ${shift}$. Phương trình $\\Leftrightarrow x - ${shift} = 2^{${k}} = ${powVal} \\Leftrightarrow x = ${sol}$ (thỏa mãn).`
      : `Ta có $3^{x - ${shift}} = 3^{${expRight}} \\Leftrightarrow x - ${shift} = ${expRight} \\Leftrightarrow x = ${solExp}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 2);
    out.push({
      id: `gdpt18-toan11-ch6-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 6,
      topicTag: 'Phương trình và bất phương trình mũ – lôgarit',
      trapTag: 'Nhầm 2^k thành 2*k hoặc quên điều kiện xác định biểu thức trong logarit dương',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Hàm số mũ & Lôgarit`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 7A (Hình - id 7): Quan hệ vuông góc & Góc trong không gian
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const aVal = 2 + (i % 6);
    // Hình chóp S.ABC có SA vuông góc (ABC), SA = aVal * sqrt(3), AB = aVal => góc (SB, (ABC)) = góc SBA, tan = SA/AB = sqrt(3) => 60 độ!
    // Nếu SA = aVal => tan = 1 => 45 độ!
    const mode = i % 3;
    let qText = '';
    let correct = '';
    let distractors: [string, string, string] = ['30^\\circ', '45^\\circ', '90^\\circ'];
    let explain = '';
    if (mode === 0) {
      qText = `Cho hình chóp $S.ABC$ có $SA \\perp (ABC)$, $AB = ${aVal}a$ và $SA = ${aVal}a$. Góc giữa đường thẳng $SB$ và mặt phẳng $(ABC)$ bằng:`;
      correct = `$45^\\circ$`;
      distractors = [`$30^\\circ$`, `$60^\\circ$`, `$90^\\circ$`];
      explain = `Vì $SA \\perp (ABC)$ nên $AB$ là hình chiếu vuông góc của $SB$ lên $(ABC)$. Suy ra $(SB, (ABC)) = \\widehat{SBA}$. Trong $\\triangle SAB$ vuông tại $A$: $\\tan \\widehat{SBA} = \\frac{SA}{AB} = 1 \\Rightarrow \\widehat{SBA} = 45^\\circ$.`;
    } else if (mode === 1) {
      qText = `Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $${aVal}a$, cạnh bên $SA \\perp (ABCD)$ và $SA = ${aVal}a\\sqrt{3}$. Góc giữa $SB$ và mặt phẳng $(ABCD)$ bằng:`;
      correct = `$60^\\circ$`;
      distractors = [`$30^\\circ$`, `$45^\\circ$`, `$90^\\circ$`];
      explain = `Hình chiếu của $SB$ lên $(ABCD)$ là $AB$ nên góc cần tìm là $\\widehat{SBA}$. Ta có $\\tan \\widehat{SBA} = \\frac{SA}{AB} = \\sqrt{3} \\Rightarrow \\widehat{SBA} = 60^\\circ$.`;
    } else {
      qText = `Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông và $SA \\perp (ABCD)$. Khẳng định nào sau đây ĐÚNG?`;
      correct = `$BC \\perp (SAB)$`;
      distractors = [`$BC \\perp (SAC)$`, '$BD \\perp (SAB)$', '$SC \\perp (ABCD)$'];
      explain = `Ta có $BC \\perp AB$ (do $ABCD$ là hình vuông) và $BC \\perp SA$ (do $SA \\perp (ABCD)$). Suy ra $BC \\perp (SAB)$.`;
    }
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-toan11-ch7-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 7,
      topicTag: 'Đường thẳng vuông góc mặt phẳng và góc trong không gian',
      trapTag: 'Xác định sai hình chiếu vuông góc của cạnh bên lên mặt phẳng đáy',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Quan hệ vuông góc & Góc không gian`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 8 (Số - id 8): Các quy tắc tính xác suất (Cộng & Nhân biến cố độc lập)
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const p1Num = 2 + (i % 3); // 2, 3, 4 / 5 -> wait keep < 1: e.g. p1 = 0.6, 0.7, 0.8
    const pA = Number((0.5 + (i % 4) * 0.1).toFixed(1)); // 0.5, 0.6, 0.7, 0.8
    const pB = Number((0.4 + (i % 3) * 0.2).toFixed(1)); // 0.4, 0.6, 0.8
    const both = Number((pA * pB).toFixed(2));
    const union = Number((pA + pB - both).toFixed(2));
    const askUnion = i % 2 === 1;
    const qText = askUnion
      ? `Cho hai biến cố độc lập $A$ và $B$ với $P(A) = ${pA}$ và $P(B) = ${pB}$. Xác suất của biến cố hợp $P(A \\cup B)$ bằng:`
      : `Hai xạ thủ độc lập cùng bắn vào bia với xác suất trúng đích lần lượt là $${pA}$ và $${pB}$. Xác suất để cả hai xạ thủ cùng bắn trúng bia bằng:`;
    const correct = askUnion ? `$${union}$` : `$${both}$`;
    const distractors: [string, string, string] = askUnion
      ? [`$${Math.min(0.99, Number((pA + pB).toFixed(2)))}$`, `$${both}$`, `$${Number((1 - both).toFixed(2))}$`]
      : [`$${Number(((pA + pB) / 2).toFixed(2))}$`, `$${union}$`, `$${Number((1 - both).toFixed(2))}$`];
    const explain = askUnion
      ? `Vì $A, B$ độc lập nên $P(AB) = P(A)\\cdot P(B) = ${both}$. Theo quy tắc cộng: $P(A \\cup B) = P(A) + P(B) - P(AB) = ${pA} + ${pB} - ${both} = ${union}$.`
      : `Do hai xạ thủ bắn độc lập nên xác suất cả hai cùng trúng là tích hai xác suất: $P = ${pA} \\times ${pB} = ${both}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 3);
    out.push({
      id: `gdpt18-toan11-ch8-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 8,
      topicTag: 'Biến cố độc lập, công thức cộng và công thức nhân xác suất',
      trapTag: 'Quên trừ P(AB) khi tính P(A ∪ B) cho hai biến cố không xung khắc',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Các quy tắc tính xác suất`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 9 (Số - id 9): Đạo hàm
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    // f(x) = a*x^3 - b*x^2 + c*x + 1 => f'(x) = 3a*x^2 - 2b*x + c
    const a = 1 + (i % 3);
    const b = 2 + (i % 4);
    const c = i + 1;
    const x0 = 1 + (i % 2);
    const slope = 3 * a * x0 * x0 - 2 * b * x0 + c;
    const f2AtX0 = 6 * a * x0 - 2 * b;
    const isSecond = i >= 10;
    const qText = isSecond
      ? `Cho hàm số $f(x) = ${a === 1 ? '' : a}x^3 - ${b}x^2 + ${c}x - 2$. Giá trị của đạo hàm cấp hai $f''(${x0})$ bằng:`
      : `Hệ số góc của tiếp tuyến đồ thị hàm số $y = ${a === 1 ? '' : a}x^3 - ${b}x^2 + ${c}x + 1$ tại điểm có hoành độ $x_0 = ${x0}$ bằng:`;
    const correct = isSecond ? `$${f2AtX0}$` : `$${slope}$`;
    const distractors: [string, string, string] = isSecond
      ? [`$${slope}$`, `$${6 * a * x0 + 2 * b}$`, `$${3 * a * x0 - b}$`]
      : [`$${slope + 2 * b}$`, `$${a * x0 * x0 * x0 - b * x0 * x0 + c * x0 + 1}$`, `$${f2AtX0}$`];
    const explain = isSecond
      ? `Ta có $f'(x) = ${3 * a}x^2 - ${2 * b}x + ${c} \\Rightarrow f''(x) = ${6 * a}x - ${2 * b}$. Thay $x = ${x0}$ được $f''(${x0}) = ${f2AtX0}$.`
      : `Hệ số góc tiếp tuyến tại $x_0 = ${x0}$ là $k = y'(${x0})$. Ta có $y' = ${3 * a}x^2 - ${2 * b}x + ${c} \\Rightarrow y'(${x0}) = ${slope}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-toan11-ch9-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 9,
      topicTag: 'Quy tắc tính đạo hàm, tiếp tuyến và đạo hàm cấp hai',
      trapTag: 'Thay x0 vào hàm số y thay vì đạo hàm y\' khi tìm hệ số góc tiếp tuyến',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Đạo hàm & Tiếp tuyến`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 4B (Hình - id 10): Đường thẳng // mặt phẳng, Hai mặt phẳng song song & Phép chiếu song song
  const geo11B = [
    {
      q: 'Nếu đường thẳng $d$ không nằm trong mặt phẳng $(\\alpha)$ và song song với một đường thẳng $d\'$ nằm trong $(\\alpha)$ thì:',
      c: '$d \\parallel (\\alpha)$',
      d: ['$d \\subset (\\alpha)$', '$d$ cắt $(\\alpha)$', '$d \\perp (\\alpha)$'] as [string, string, string],
      ex: 'Theo định lý dấu hiệu nhận biết đường thẳng song song với mặt phẳng: $d \\not\\subset (\\alpha),\\ d \\parallel d\' \\subset (\\alpha) \\Rightarrow d \\parallel (\\alpha)$.',
    },
    {
      q: 'Cho hình hộp $ABCD.A\'B\'C\'D\'$. Mặt phẳng $(AB\'D\')$ song song với mặt phẳng nào dưới đây?',
      c: '$(BC\'D)$',
      d: ['$(ABCD)$', '$(ABB\'A\')$', '$(ACC\'A\')$'] as [string, string, string],
      ex: 'Ta có $AB\' \\parallel DC\'$ và $AD\' \\parallel BC\'$, suy ra hai mặt phẳng $(AB\'D\')$ và $(BC\'D)$ chứa hai cặp đường thẳng cắt nhau từng đôi một song song nên $(AB\'D\') \\parallel (BC\'D)$.',
    },
    {
      q: 'Qua phép chiếu song song theo phương $l$ không song song với đoạn thẳng $AB$, tỉ số độ dài hai đoạn thẳng cùng nằm trên một đường thẳng sẽ:',
      c: 'Không thay đổi (được bảo toàn)',
      d: ['Luôn tăng gấp đôi', 'Luôn giảm một nửa', 'Thay đổi tùy góc chiếu'] as [string, string, string],
      ex: 'Tính chất cơ bản của phép chiếu song song: Bảo toàn tính thẳng hàng, thứ tự ba điểm và tỉ số độ dài của hai đoạn thẳng song song hoặc cùng nằm trên một đường thẳng.',
    },
  ];
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    if (i < 3) {
      const item = geo11B[i];
      const { choices, correctIndex } = rotateChoices(item.c, item.d, i + 2);
      out.push({
        id: `gdpt18-toan11-ch10-q${String(i + 1).padStart(2, '0')}`,
        subject: 'toan-hoc',
        grade: 11,
        chapterId: 10,
        topicTag: 'Đường thẳng, mặt phẳng song song và phép chiếu song song',
        trapTag: 'Thiếu điều kiện hai đường thẳng cắt nhau khi chứng minh hai mặt phẳng song song',
        bloomLevel: bloom,
        title: `Câu ${i + 1} (${cogLabel}): Quan hệ song song không gian (P2)`,
        question: item.q,
        choices,
        correctIndex,
        explanation: item.ex,
      });
    } else {
      // Định lý Thales trong không gian / Thiết diện song song đáy hình chóp: S_td / S_day = k^2
      const sBase = (i + 1) * 4; // chia hết cho 4
      const sCut = sBase / 4; // trung điểm cạnh bên => k = 1/2 => S_td = S_day / 4
      const { choices, correctIndex } = rotateChoices(
        `$${sCut}$`,
        [`$${sBase / 2}$`, `$${sBase}$`, `$${sCut * 3}$`],
        i,
      );
      out.push({
        id: `gdpt18-toan11-ch10-q${String(i + 1).padStart(2, '0')}`,
        subject: 'toan-hoc',
        grade: 11,
        chapterId: 10,
        topicTag: 'Đường thẳng, mặt phẳng song song và phép chiếu song song',
        trapTag: 'Nhầm tỉ số diện tích thiết diện song song bằng k thay vì k^2',
        bloomLevel: bloom,
        title: `Câu ${i + 1} (${cogLabel}): Thiết diện song song mặt đáy`,
        question: `Cho hình chóp $S.ABCD$ có diện tích đáy bằng $${sBase}$. Mặt phẳng $(\\alpha)$ đi qua trung điểm của cạnh $SA$ và song song với mặt đáy $(ABCD)$ cắt hình chóp theo một thiết diện có diện tích bằng:`,
        choices,
        correctIndex,
        explanation: `Thiết diện thu được đồng dạng với mặt đáy theo tỉ số đồng dạng $k = \\frac{1}{2}$. Do đó diện tích thiết diện là $S_{td} = k^2 \\cdot S_{ABCD} = \\frac{1}{4} \\cdot ${sBase} = ${sCut}$.`,
      });
    }
  }

  // Chương 7B (Hình - id 11): Khoảng cách & Thể tích khối đa diện
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    // V chóp = 1/3 * B * h; V lăng trụ = B * h
    const side = 2 + (i % 5);
    const h = 3 * (1 + (i % 4)); // chia hết cho 3!
    const vPyramid = (side * side * h) / 3;
    const vPrism = side * side * h;
    const isPrism = i % 3 === 1;
    const qText = isPrism
      ? `Cho khối lăng trụ đứng $ABC.A'B'C'$ có diện tích đáy bằng $${side * side}a^2$ và cạnh bên $AA' = ${h}a$. Thể tích của khối lăng trụ đã cho bằng:`
      : `Cho hình chóp $S.ABCD$ có đáy $ABCD$ là hình vuông cạnh $${side}a$, cạnh bên $SA \\perp (ABCD)$ và $SA = ${h}a$. Thể tích khối chóp $S.ABCD$ bằng:`;
    const correct = isPrism ? `$${vPrism}a^3$` : `$${vPyramid}a^3$`;
    const distractors: [string, string, string] = isPrism
      ? [`$${vPyramid}a^3$`, `$${vPrism / 2}a^3$`, `$${(side * side + h)}a^3$`]
      : [`$${vPrism}a^3$`, `$${vPyramid / 2}a^3$`, `$${side * h}a^3$`];
    const explain = isPrism
      ? `Thể tích khối lăng trụ đứng: $V = B \\cdot h = ${side * side}a^2 \\cdot ${h}a = ${vPrism}a^3$.`
      : `Thể tích khối chóp: $V = \\frac{1}{3} S_{ABCD} \\cdot SA = \\frac{1}{3} \\cdot (${side}a)^2 \\cdot ${h}a = ${vPyramid}a^3$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-toan11-ch11-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 11,
      chapterId: 11,
      topicTag: 'Khoảng cách trong không gian và thể tích khối đa diện',
      trapTag: 'Quên hệ số 1/3 khi tính thể tích khối chóp hoặc nhân nhầm 1/3 cho lăng trụ',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Khoảng cách & Thể tích chóp/lăng trụ`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  return out;
}

// ============================================================================
// 3. BỔ SUNG TOÁN LỚP 12 (CHƯƠNG 6 XÁC SUẤT CÓ ĐIỀU KIỆN + HÌNH 12 CHƯƠNG 7 & 8)
// ============================================================================
function buildMath12SupplementalQuestions(): SeedQuestionInput[] {
  const out: SeedQuestionInput[] = [];

  // Chương 6 (Số - id 6): Xác suất có điều kiện & Công thức Bayes
  for (let i = 0; i < 12; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    // P(A|B) = P(AB)/P(B)
    const pB = 50 + (i % 4) * 10; // %: 50, 60, 70, 80
    const pAB = 20 + (i % 3) * 5; // %: 20, 25, 30
    const condStr = `$${frac(pAB, pB)}$`;
    const { choices, correctIndex } = rotateChoices(
      condStr,
      [`$${frac(pAB, 100)}$`, `$${frac(pB - pAB, pB)}$`, `$${frac(pAB, 100 - pB)}$`],
      i + 1,
    );
    out.push({
      id: `gdpt18-toan12-ch6-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 12,
      chapterId: 6,
      topicTag: 'Xác suất có điều kiện và công thức Bayes',
      trapTag: 'Chia nhầm cho P(A) thay vì P(B) khi tính P(A|B)',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Xác suất có điều kiện & Bayes`,
      question: `Cho hai biến cố $A$ và $B$ có $P(B) = 0,${pB / 10}$ và $P(AB) = ${pAB / 100}$. Xác suất có điều kiện $P(A|B)$ bằng:`,
      choices,
      correctIndex,
      explanation: `Áp dụng công thức xác suất có điều kiện: $P(A|B) = \\frac{P(AB)}{P(B)} = \\frac{${pAB / 100}}{${pB / 100}} = ${frac(pAB, pB)}$.`,
    });
  }

  // Chương 2B (Hình 12 - id 7): Hệ trục tọa độ Oxyz & Biểu thức tọa độ vectơ
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const ax = i + 1;
    const ay = -2;
    const az = 3 + (i % 4);
    const bx = 3;
    const by = 4;
    const bz = az - 1;
    // Tọa độ trung điểm hoặc tích vô hướng 3D
    const dot3 = ax * bx + ay * by + az * bz;
    const isGravity = i % 2 === 1;
    // Trọng tâm G của tam giác ABC với A(3k1..), B, C chia hết cho 3
    const gx = i + 1;
    const gy = 2;
    const gz = -(i % 4);
    const qText = isGravity
      ? `Trong không gian $Oxyz$, cho tam giác $ABC$ có $A(${3 * gx - 3}; 1; ${3 * gz})$, $B(2; 2; 1)$ và $C(1; 3; -1)$. Tọa độ trọng tâm $G$ của tam giác $ABC$ là:`
      : `Trong không gian $Oxyz$, cho hai vectơ $\\vec{a} = (${ax}; ${ay}; ${az})$ và $\\vec{b} = (${bx}; ${by}; ${bz})$. Tích vô hướng $\\vec{a} \\cdot \\vec{b}$ bằng:`;
    const correct = isGravity ? `$G(${gx}; ${gy}; ${gz})$` : `$${dot3}$`;
    const distractors: [string, string, string] = isGravity
      ? [`$G(${3 * gx}; ${3 * gy}; ${3 * gz})$`, `$G(${gx + 1}; ${gy}; ${gz})$`, `$G(${gx}; ${gy + 1}; ${gz - 1})$`]
      : [`$${dot3 + 6}$`, `$${ax + bx + ay + by + az + bz}$`, `$${dot3 - 4}$`];
    const explain = isGravity
      ? `Tọa độ trọng tâm $G\\left(\\frac{x_A+x_B+x_C}{3}; \\frac{y_A+y_B+y_C}{3}; \\frac{z_A+z_B+z_C}{3}\\right) = G(${gx}; ${gy}; ${gz})$.`
      : `Tích vô hướng trong $Oxyz$: $\\vec{a}\\cdot\\vec{b} = ${ax}\\cdot ${bx} + (${ay})\\cdot ${by} + ${az}\\cdot ${bz} = ${dot3}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 2);
    out.push({
      id: `gdpt18-toan12-ch7-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 12,
      chapterId: 7,
      topicTag: 'Hệ trục tọa độ Oxyz và biểu thức tọa độ vectơ',
      trapTag: 'Chia cho 2 thay vì chia cho 3 khi tìm tọa độ trọng tâm tam giác',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Biểu thức tọa độ vectơ Oxyz`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Chương 5B (Hình 12 - id 8): Phương trình mặt cầu, Góc & Khoảng cách trong Oxyz
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const ix = 1 + (i % 4);
    const iy = -(2 + (i % 3));
    const iz = i % 5;
    const r = 3 + (i % 5);
    // Mặt cầu x^2 + y^2 + z^2 - 2*ix*x - 2*iy*y - 2*iz*z + d = 0 với d = ix^2 + iy^2 + iz^2 - r^2
    const dCoef = ix * ix + iy * iy + iz * iz - r * r;
    const dStr = dCoef >= 0 ? `+ ${dCoef}` : `- ${Math.abs(dCoef)}`;
    const zPart = iz === 0 ? '' : `- ${2 * iz}z`;
    const { choices, correctIndex } = rotateChoices(
      `$R = ${r}$`,
      [`$R = ${r * r}$`, `$R = ${r + 1}$`, `$R = ${Math.max(1, r - 1)}$`],
      i + 1,
    );
    out.push({
      id: `gdpt18-toan12-ch8-q${String(i + 1).padStart(2, '0')}`,
      subject: 'toan-hoc',
      grade: 12,
      chapterId: 8,
      topicTag: 'Phương trình mặt cầu, góc và khoảng cách trong Oxyz',
      trapTag: 'Quên đổi dấu hệ số d trong công thức R = sqrt(a^2 + b^2 + c^2 - d)',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Phương trình mặt cầu & Khoảng cách Oxyz`,
      question: `Trong không gian $Oxyz$, mặt cầu $(S): x^2 + y^2 + z^2 - ${2 * ix}x + ${2 * Math.abs(iy)}y ${zPart} ${dStr} = 0$ có bán kính $R$ bằng:`,
      choices,
      correctIndex,
      explanation: `Tâm mặt cầu là $I(${ix}; ${iy}; ${iz})$. Bán kính $R = \\sqrt{a^2 + b^2 + c^2 - d} = \\sqrt{${ix}^2 + (${iy})^2 + ${iz}^2 - (${dCoef})} = \\sqrt{${r * r}} = ${r}$.`,
    });
  }

  return out;
}

// ============================================================================
// 4. BỘ SINH CÂU HỎI TIN HỌC LỚP 10, 11, 12 (CHUẨN GDPT 2018 KNTT)
// ============================================================================
function buildInformaticsQuestions(): SeedQuestionInput[] {
  const out: SeedQuestionInput[] = [];

  // --- TIN HỌC 10 (7 CHƯƠNG) ---
  // Chương 1: Máy tính và xã hội tri thức (Nhị phân, đơn vị dữ liệu, logic)
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const dec = 10 + i * 3; // 10, 13, 16...
    const bin = dec.toString(2);
    const wrong1 = (dec + 1).toString(2);
    const wrong2 = (dec - 1).toString(2);
    const wrong3 = (dec + 2).toString(2);
    const isByte = i % 3 === 1;
    const kbCount = (i + 1) * 2;
    const qText = isByte
      ? `Một tệp văn bản có dung lượng $${kbCount}\\text{ MB}$. Khi quy đổi sang đơn vị $\\text{KB}$ (theo chuẩn nhị phân $1\\text{ MB} = 1024\\text{ KB}$), dung lượng của tệp bằng:`
      : `Biểu diễn của số nguyên dương $${dec}$ trong hệ nhị phân (cơ số $2$) là:`;
    const correct = isByte ? `$${kbCount * 1024}\\text{ KB}$` : `$${bin}_2$`;
    const distractors: [string, string, string] = isByte
      ? [`$${kbCount * 1000}\\text{ KB}$`, `$${kbCount * 512}\\text{ KB}$`, `$${kbCount * 8}\\text{ KB}$`]
      : [`$${wrong1}_2$`, `$${wrong2}_2$`, `$${wrong3}_2$`];
    const explain = isByte
      ? `Theo đơn vị đo lượng thông tin chuẩn nhị phân: $1\\text{ MB} = 1024\\text{ KB}$, do đó $${kbCount}\\text{ MB} = ${kbCount} \\times 1024 = ${kbCount * 1024}\\text{ KB}$.`
      : `Chia liên tiếp $${dec}$ cho $2$ và viết ngược dãy số dư ta thu được dãy nhị phân $${bin}_2$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-tin10-ch1-q${String(i + 1).padStart(2, '0')}`,
      subject: 'tin-hoc',
      grade: 10,
      chapterId: 1,
      topicTag: 'Thông tin, biểu diễn nhị phân và lôgic mệnh đề',
      trapTag: 'Đọc ngược thứ tự bit dư khi đổi từ thập phân sang nhị phân',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Biểu diễn dữ liệu & Hệ nhị phân`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  const tinTheoryChapters: Array<{
    grade: 10 | 11 | 12;
    chapterId: number;
    topicTag: string;
    trapTag: string;
    chapterTitle: string;
    bank: Array<{ q: string; c: string; d: [string, string, string]; ex: string }>;
  }> = [
    {
      grade: 10,
      chapterId: 2,
      topicTag: 'Mạng LAN, Internet, IoT, Đám mây và An toàn mạng',
      trapTag: 'Nhầm lẫn giữa dịch vụ lưu trữ đám mây và phần mềm cài đặt cục bộ',
      chapterTitle: 'Mạng máy tính & Internet',
      bank: [
        {
          q: 'Hệ thống các thiết bị vật lý, cảm biến, phương tiện được gắn chip và kết nối tự động trao đổi dữ liệu qua Internet được gọi là:',
          c: 'Internet vạn vật (IoT)',
          d: ['Mạng cục bộ (LAN)', 'Hệ soạn thảo văn bản', 'Bộ nhớ đệm Cache'],
          ex: 'IoT (Internet of Things) là mạng lưới các thiết bị thông minh tích hợp cảm biến kết nối và trao đổi dữ liệu tự động qua Internet.',
        },
        {
          q: 'Dịch vụ nào sau đây là ví dụ điển hình của Điện toán đám mây theo mô hình lưu trữ trực tuyến?',
          c: 'Google Drive / OneDrive',
          d: ['Microsoft Paint ngoại tuyến', 'Trình quản lý Task Manager', 'BIOS của bo mạch chủ'],
          ex: 'Google Drive và OneDrive cung cấp dịch vụ lưu trữ và đồng bộ dữ liệu trên đám mây qua kết nối Internet.',
        },
        {
          q: 'Loại phần mềm độc hại có khả năng mã hóa dữ liệu trên máy nạn nhân rồi đòi tiền chuộc được gọi là:',
          c: 'Ransomware (Mã độc tống tiền)',
          d: ['Firewall (Tường lửa)', 'Compiler (Trình biên dịch)', 'Driver (Trình điều khiển)'],
          ex: 'Ransomware là phần mềm độc hại chuyên mã hóa tệp tin của người dùng và yêu cầu trả tiền chuộc để lấy khóa giải mã.',
        },
        {
          q: 'Phạm vi kết nối của mạng cục bộ (LAN) thường là:',
          c: 'Trong một phòng máy, tòa nhà hoặc khuôn viên trường học',
          d: ['Liên lục địa toàn cầu', 'Giữa các quốc gia khác nhau', 'Giữa các vệ tinh viễn thông'],
          ex: 'Mạng LAN (Local Area Network) kết nối các thiết bị trong phạm vi địa lý hẹp như gia đình, phòng thực hành, tòa nhà.',
        },
        {
          q: 'Biện pháp nào sau đây hiệu quả nhất để bảo vệ tài khoản trực tuyến trước nguy cơ lộ mật khẩu?',
          c: 'Bật xác thực hai yếu tố (2FA) và dùng mật khẩu mạnh',
          d: ['Đặt mật khẩu là ngày sinh cho dễ nhớ', 'Dùng chung một mật khẩu cho mọi trang web', 'Tắt tường lửa của hệ điều hành'],
          ex: 'Xác thực hai yếu tố (2FA) kết hợp mật khẩu mạnh giúp ngăn chặn truy cập trái phép ngay cả khi kẻ xấu biết mật khẩu.',
        },
      ],
    },
    {
      grade: 10,
      chapterId: 3,
      topicTag: 'Đạo đức, pháp luật và bản quyền trong môi trường số',
      trapTag: 'Hiểu sai rằng mọi nội dung miễn phí trên Internet đều được tự ý sao chép thương mại',
      chapterTitle: 'Đạo đức & Pháp luật môi trường số',
      bank: [
        {
          q: 'Hành vi nào sau đây VI PHẠM quyền tác giả đối với sản phẩm số?',
          c: 'Bẻ khóa (crack) phần mềm thương mại để chia sẻ công khai lên mạng',
          d: ['Trích dẫn đoạn ngắn tài liệu học tập có ghi rõ nguồn và tên tác giả', 'Sử dụng phần mềm mã nguồn mở theo đúng giấy phép', 'Tự viết chương trình Python giải bài tập về nhà'],
          ex: 'Bẻ khóa (crack) và phát tán phần mềm bản quyền là hành vi xâm phạm nghiêm trọng quyền sở hữu trí tuệ.',
        },
        {
          q: 'Theo Luật An ninh mạng Việt Nam, hành vi nào dưới đây bị nghiêm cấm?',
          c: 'Đăng tải thông tin bịa đặt, sai sự thật gây hoang mang dư luận',
          d: ['Tra cứu học liệu trên cổng thông tin giáo dục', 'Tham gia khóa học trực tuyến có bản quyền', 'Sao lưu dữ liệu cá nhân lên đám mây'],
          ex: 'Luật An ninh mạng nghiêm cấm hành vi tung tin giả, bịa đặt, xúc phạm danh dự nhân phẩm tổ chức và cá nhân.',
        },
        {
          q: 'Khi muốn đăng ảnh chụp rõ mặt bạn bè lên mạng xã hội công khai, cách ứng xử văn minh và đúng pháp luật là:',
          c: 'Xin phép và nhận được sự đồng ý của bạn trước khi đăng',
          d: ['Tự ý đăng kèm bình luận chế giễu', 'Gắn thẻ tất cả người lạ để câu tương tác', 'Chỉnh sửa xuyên tạc hình ảnh rồi phát tán'],
          ex: 'Quyền đối với hình ảnh cá nhân được pháp luật bảo vệ; cần sự đồng ý của người trong ảnh trước khi công khai.',
        },
        {
          q: 'Thông tin nào sau đây thuộc dữ liệu cá nhân nhạy cảm KHÔNG nên công khai trên mạng xã hội?',
          c: 'Số căn cước công dân, mã OTP ngân hàng và địa chỉ nhà riêng',
          d: ['Tên môn học yêu thích ở trường', 'Danh sách sách giáo khoa lớp 10', 'Lịch thi tốt nghiệp THPT công bố chung'],
          ex: 'Số CCCD, mã OTP và địa chỉ riêng tư nếu bị lộ dễ bị kẻ xấu lợi dụng chiếm đoạt tài sản hoặc mạo danh.',
        },
        {
          q: 'Giấy phép Creative Commons ký hiệu CC BY cho phép người dùng sử dụng tác phẩm với điều kiện:',
          c: 'Phải ghi nhận công trạng / trích dẫn tên tác giả gốc',
          d: ['Phải trả phí bản quyền hàng tháng', 'Tuyệt đối không được chia sẻ lại', 'Được xóa tên tác giả và nhận là của mình'],
          ex: 'CC BY (Attribution) yêu cầu người sử dụng phải ghi rõ tên tác giả/nguồn gốc tác phẩm theo quy định của tác giả.',
        },
      ],
    },
    {
      grade: 10,
      chapterId: 4,
      topicTag: 'Thiết kế đồ họa vectơ (Inkscape)',
      trapTag: 'Nhầm đặc tính vỡ hạt khi phóng to của ảnh Bitmap sang đồ họa Vectơ',
      chapterTitle: 'Thiết kế đồ họa vectơ',
      bank: [
        {
          q: 'Ưu điểm nổi bật nhất của đồ họa vectơ (như tệp SVG trong Inkscape) so với đồ họa điểm ảnh (Bitmap) là:',
          c: 'Phóng to hoặc thu nhỏ tùy ý mà không bị vỡ hình hay răng cưa',
          d: ['Thể hiện ảnh chụp phong cảnh tự nhiên chân thực từng điểm ảnh hơn', 'Không thể chỉnh sửa lại từng đối tượng sau khi vẽ', 'Dung lượng tệp luôn lớn gấp hàng trăm lần ảnh chụp'],
          ex: 'Đồ họa vectơ biểu diễn hình ảnh bằng công thức toán học (điểm, đường, đa giác) nên co giãn vô hạn không giảm chất lượng.',
        },
        {
          q: 'Định dạng tệp mặc định chuẩn của phần mềm thiết kế đồ họa vectơ Inkscape là:',
          c: '.svg (Scalable Vector Graphics)',
          d: ['.jpg', '.mp4', '.exe'],
          ex: 'Inkscape sử dụng định dạng chuẩn mở SVG (Scalable Vector Graphics) để lưu trữ đối tượng đồ họa vectơ.',
        },
        {
          q: 'Trong Inkscape, phép toán ghép hình nào dùng để lấy phần diện tích CHUNG của hai đối tượng đang chồng lên nhau?',
          c: 'Intersection (Phép giao)',
          d: ['Union (Phép hợp)', 'Difference (Phép hiệu)', 'Division (Phép chia cắt)'],
          ex: 'Phép Intersection giữ lại đúng vùng giao nhau (chồng lấp) giữa hai hình đối tượng.',
        },
        {
          q: 'Trong Inkscape, để gộp hai hình rời nhau thành một hình duy nhất có đường viền bao ngoài chung, ta chọn phép toán:',
          c: 'Union (Ctrl + +)',
          d: ['Difference (Ctrl + -)', 'Exclusion (Ctrl + ^)', 'Cut Path'],
          ex: 'Phép hợp (Union) hợp nhất các đối tượng được chọn thành một đối tượng đường cong khép kín duy nhất.',
        },
        {
          q: 'Công cụ Pen / Bezier trong phần mềm đồ họa vectơ dùng để làm gì?',
          c: 'Vẽ các đoạn thẳng và đường cong Bézier mượt mà qua các điểm neo (node)',
          d: ['Tẩy xóa điểm ảnh trên ảnh chụp JPEG', 'Kiểm tra chính tả văn bản tiếng Việt', 'Nén tệp tin hình ảnh thành tệp ZIP'],
          ex: 'Công cụ Bezier tạo đường dẫn (path) gồm các điểm neo và tay nắm tiếp tuyến giúp điều chỉnh độ cong chính xác.',
        },
      ],
    },
    {
      grade: 10,
      chapterId: 7,
      topicTag: 'Hướng nghiệp Thiết kế đồ họa và Phát triển phần mềm',
      trapTag: 'Nhầm lẫn nhiệm vụ kiểm thử phần mềm (Tester/QA) với sửa chữa phần cứng vật lý',
      chapterTitle: 'Hướng nghiệp với Tin học 10',
      bank: [
        {
          q: 'Trong quy trình phát triển phần mềm, công việc phân tích yêu cầu khách hàng để xây dựng kiến trúc hệ thống thuộc vai trò nào?',
          c: 'Kỹ sư phân tích thiết kế hệ thống / Kiến trúc sư phần mềm',
          d: ['Nhân viên lắp đặt dây cáp mạng', 'Thiết kế poster quảng cáo in ấn', 'Nhân viên nhập liệu văn phòng'],
          ex: 'Phân tích yêu cầu và thiết kế kiến trúc là bước đầu cốt lõi của kỹ nghệ phát triển phần mềm.',
        },
        {
          q: 'Nhà thiết kế đồ họa máy tính (Graphic Designer) cần kết hợp hài hòa hai nhóm năng lực chính nào?',
          c: 'Tư duy thẩm mỹ sáng tạo và kỹ năng sử dụng phần mềm đồ họa số',
          d: ['Lắp ráp vi mạch hàn chì và quản trị máy chủ SQL', 'Cấu hình định tuyến Router và viết driver nhân Linux', 'Kế toán kiểm toán và sửa chữa nguồn máy tính'],
          ex: 'Nghề thiết kế đồ họa đòi hỏi mắt thẩm mỹ (bố cục, màu sắc, typography) kết hợp thànhạo công cụ đồ họa số.',
        },
        {
          q: 'Chuyên viên Kiểm thử phần mềm (Software Tester / QA) có nhiệm vụ trọng tâm là:',
          c: 'Xây dựng kịch bản kiểm thử, phát hiện lỗi (bug) và đảm bảo chất lượng phần mềm trước khi bàn giao',
          d: ['Vẽ minh họa bìa sách thiếu nhi', 'Thay keo tản nhiệt cho CPU máy trạm', 'Bán linh kiện máy tính tại cửa hàng'],
          ex: 'Tester/QA kiểm tra tính đúng đắn, hiệu năng và độ ổn định của phần mềm so với đặc tả yêu cầu.',
        },
        {
          q: 'Sản phẩm đầu ra tiêu biểu của nghề Thiết kế giao diện & trải nghiệm người dùng (UI/UX Designer) là:',
          c: 'Bản thiết kế giao diện trực quan (Figma/Prototype) tối ưu thao tác cho người dùng ứng dụng',
          d: ['Tệp cơ sở dữ liệu sao lưu định kỳ', 'Cáp quang biển liên lục địa', 'Bộ nguồn công suất thực cho máy chủ'],
          ex: 'UI/UX Designer nghiên cứu hành vi người dùng và thiết kế giao diện ứng dụng web/mobile dễ dùng, thẩm mỹ.',
        },
        {
          q: 'Ngôn ngữ lập trình nào dưới đây thường được giảng dạy ở lớp 10 và ứng dụng mạnh mẽ trong phát triển phần mềm, AI, Khoa học dữ liệu?',
          c: 'Python',
          d: ['Inkscape', 'GIMP', 'Audacity'],
          ex: 'Python là ngôn ngữ lập trình bậc cao cú pháp sáng sủa, còn Inkscape/GIMP/Audacity là các phần mềm ứng dụng đa phương tiện.',
        },
      ],
    },
    {
      grade: 11,
      chapterId: 1,
      topicTag: 'Hệ điều hành, phần mềm nguồn mở và kiến trúc máy tính',
      trapTag: 'Nhầm bộ nhớ RAM (khả biến, mất dữ liệu khi tắt điện) với ROM hoặc ổ cứng SSD',
      chapterTitle: 'Hệ điều hành & Bên trong máy tính',
      bank: [
        {
          q: 'Chức năng cốt lõi của Hệ điều hành (Operating System) trên máy tính và điện thoại thông minh là:',
          c: 'Quản lý tài nguyên phần cứng – phần mềm và cung cấp giao diện giao tiếp với người dùng',
          d: ['Chỉ dùng để soạn thảo văn bản và lập bảng tính', 'Dịch trực tiếp mọi trang web sang tiếng Việt', 'Tăng dung lượng vật lý của thanh RAM'],
          ex: 'Hệ điều hành đóng vai trò trung gian điều phối CPU, bộ nhớ, thiết bị ngoại vi và môi trường chạy phần mềm ứng dụng.',
        },
        {
          q: 'Đặc điểm phân biệt phần mềm nguồn mở (Open Source Software) với phần mềm thương mại nguồn đóng là:',
          c: 'Công khai mã nguồn để cộng đồng được phép nghiên cứu, cải tiến và phân phối theo giấy phép tương ứng',
          d: ['Luôn cấm người dùng cài đặt trên máy tính cá nhân', 'Không bao giờ có giao diện đồ họa', 'Chỉ chạy được khi ngắt kết nối Internet'],
          ex: 'Phần mềm nguồn mở cung cấp mã nguồn đi kèm giấy phép (như GNU GPL, MIT, Apache) cho phép nghiên cứu và phát triển tiếp.',
        },
        {
          q: 'Thành phần nào bên trong CPU trực tiếp thực hiện các phép toán số học (cộng, trừ) và phép toán logic (AND, OR, NOT)?',
          c: 'Bộ số học và lôgic (ALU – Arithmetic Logic Unit)',
          d: ['Ổ cứng thể rắn SSD', 'Bàn phím cơ ngoại vi', 'Màn hình hiển thị LCD'],
          ex: 'CPU gồm Bộ điều khiển (CU), Bộ số học và lôgic (ALU) cùng các thanh ghi (Registers). ALU thực thi phép tính số học & logic.',
        },
        {
          q: 'Cổng logic nào cho đầu ra bằng $1$ KHI VÀ CHỈ KHI tất cả các đầu vào đều bằng $1$?',
          c: 'Cổng AND',
          d: ['Cổng OR', 'Cổng NOT', 'Cổng XOR'],
          ex: 'Phép hội logic (AND) chỉ nhận giá trị đúng ($1$) khi cả hai đầu vào $x = 1$ và $y = 1$.',
        },
        {
          q: 'Bộ nhớ nào sau đây là bộ nhớ truy cập ngẫu nhiên, lưu dữ liệu tạm thời khi chương trình đang chạy và bị mất dữ liệu khi tắt nguồn điện?',
          c: 'RAM (Random Access Memory)',
          d: ['ROM (Read Only Memory)', 'Ổ cứng SSD', 'Thẻ nhớ SD'],
          ex: 'RAM là bộ nhớ trong khả biến (volatile): tốc độ rất nhanh nhưng dữ liệu bị xóa sạch khi ngừng cấp điện.',
        },
      ],
    },
    {
      grade: 11,
      chapterId: 2,
      topicTag: 'Lưu trữ đám mây, tìm kiếm thông tin và giao tiếp an toàn',
      trapTag: 'Quên đặt cụm từ trong dấu ngoặc kép khi cần tìm chính xác nguyên văn trên máy tìm kiếm',
      chapterTitle: 'Lưu trữ, Tìm kiếm & An toàn số',
      bank: [
        {
          q: 'Trên máy tìm kiếm Google, để tìm chính xác nguyên văn cụm từ khóa không bị tách rời thứ tự các từ, ta đặt cụm từ đó trong:',
          c: 'Cặp dấu ngoặc kép "..."',
          d: ['Cặp dấu ngoặc vuông [...]', 'Cặp dấu ngoặc nhọn {...}', 'Dấu thăng # ở cuối câu'],
          ex: 'Đặt cụm từ trong dấu ngoặc kép (ví dụ `"chương trình GDPT 2018"`) yêu cầu máy tìm kiếm khớp chính xác cả cụm.',
        },
        {
          q: 'Để chỉ tìm các tài liệu định dạng PDF về chủ đề "cơ sở dữ liệu", cú pháp tìm kiếm nâng cao chuẩn là:',
          c: 'cơ sở dữ liệu filetype:pdf',
          d: ['cơ sở dữ liệu folder:pdf', 'cơ sở dữ liệu cpu:pdf', 'cơ sở dữ liệu ram:pdf'],
          ex: 'Toán tử `filetype:pdf` lọc kết quả tìm kiếm chỉ trả về các tệp tin có phần mở rộng `.pdf`.',
        },
        {
          q: 'Dấu hiệu điển hình của một email lừa đảo giả mạo (Phishing) là:',
          c: 'Tên miền người gửi sai lệch tinh vi và thúc giục bấm link lạ để nhập mật khẩu/mã OTP khẩn cấp',
          d: ['Email thông báo lịch học từ tên miền chính thức `.edu.vn` của nhà trường không kèm link lạ', 'Email xác nhận do chính bạn vừa chủ động thao tác đổi ảnh đại diện', 'Bản tin học thuật không yêu cầu cung cấp thông tin bảo mật'],
          ex: 'Tấn công Phishing thường giả mạo ngân hàng/tổ chức uy tín kèm đường link giả và tâm lý hối thúc để đánh cắp thông tin.',
        },
        {
          q: 'Khi chia sẻ một thư mục bài tập nhóm trên Google Drive nhưng chỉ muốn các bạn ĐỌC mà không sửa/xóa tệp gốc, cần cấp quyền:',
          c: 'Người xem (Viewer)',
          d: ['Người chỉnh sửa (Editor)', 'Chủ sở hữu (Owner)', 'Quản trị hệ thống tối cao'],
          ex: 'Quyền Viewer cho phép xem và tải xuống (nếu bật), ngăn ngừa việc vô tình sửa đổi hay xóa mất tài liệu gốc.',
        },
        {
          q: 'Tính năng Nhãn (Labels) và Bộ lọc tự động (Filters) trong hộp thư điện tử Gmail giúp người dùng:',
          c: 'Phân loại, gắn thẻ màu và sắp xếp thư đến tự động theo người gửi hoặc chủ đề',
          d: ['Tăng gấp đôi tốc độ vi xử lý máy tính', 'Tự động dịch mã nguồn C++ sang tệp thực thi', 'Thay thế hoàn toàn kết nối Wi-Fi'],
          ex: 'Labels & Filters giúp tổ chức hộp thư khoa học, tự động phân nhóm thư học tập, công việc và lọc thư rác.',
        },
      ],
    },
    {
      grade: 11,
      chapterId: 3,
      topicTag: 'Cơ sở dữ liệu và mô hình dữ liệu quan hệ',
      trapTag: 'Nhầm lẫn vai trò định danh duy nhất của Khóa chính (Primary Key) với Khóa ngoại (Foreign Key)',
      chapterTitle: 'Cơ sở dữ liệu & Mô hình quan hệ',
      bank: [
        {
          q: 'Trong mô hình cơ sở dữ liệu quan hệ, mỗi hàng (row) của bảng dữ liệu được gọi là một:',
          c: 'Bản ghi (Record / Bộ / Tuple)',
          d: ['Trường (Field / Thuộc tính)', 'Khóa ngoại (Foreign Key)', 'Hệ quản trị CSDL'],
          ex: 'Trong bảng quan hệ: mỗi cột là một Trường (thuộc tính), còn mỗi hàng là một Bản ghi (bộ dữ liệu của một đối tượng).',
        },
        {
          q: 'Khóa chính (Primary Key) của một bảng trong CSDL quan hệ phải thỏa mãn điều kiện bắt buộc nào?',
          c: 'Giá trị duy nhất (không trùng lặp) và không được để trống (NOT NULL)',
          d: ['Cho phép nhiều dòng có giá trị trùng nhau tùy ý', 'Bắt buộc phải có kiểu dữ liệu văn bản dài trên 1000 ký tự', 'Luôn để giá trị rỗng NULL ở dòng đầu tiên'],
          ex: 'Khóa chính dùng để phân biệt duy nhất từng bản ghi trong bảng nên bắt buộc UNIQUE và NOT NULL.',
        },
        {
          q: 'Cho bảng `HOC_SINH(MaHS, HoTen, MaLop)` và bảng `LOP(MaLop, TenLop)`. Trường `MaLop` trong bảng `HOC_SINH` đóng vai trò là:',
          c: 'Khóa ngoại (Foreign Key) tham chiếu tới khóa chính `MaLop` của bảng `LOP`',
          d: ['Khóa chính duy nhất của bảng `HOC_SINH`', 'Tên cơ sở dữ liệu vật lý', 'Câu lệnh truy vấn cập nhật'],
          ex: '`MaLop` trong `HOC_SINH` liên kết mỗi học sinh tới một lớp hợp lệ trong bảng `LOP`, nên là Khóa ngoại.',
        },
        {
          q: 'Ưu điểm lớn nhất của Hệ cơ sở dữ liệu so với cách lưu trữ tệp bảng tính rời rạc truyền thống là:',
          c: 'Giảm dư thừa dữ liệu, đảm bảo tính nhất quán và hỗ trợ nhiều người truy cập đồng thời an toàn',
          d: ['Không cần ổ cứng để lưu dữ liệu', 'Cho phép lưu dữ liệu mâu thuẫn nhau ở nhiều nơi', 'Không cần kiểm tra quyền truy cập người dùng'],
          ex: 'CSDL tập trung hóa cấu trúc dữ liệu, kiểm soát ràng buộc toàn vẹn và hỗ trợ truy xuất đồng thời hiệu quả.',
        },
        {
          q: 'Phần mềm nào dưới đây là một Hệ quản trị cơ sở dữ liệu quan hệ (RDBMS)?',
          c: 'PostgreSQL / MySQL',
          d: ['Microsoft Word', 'Adobe Photoshop', 'Google Chrome'],
          ex: 'PostgreSQL, MySQL, SQL Server, Oracle, SQLite là các Hệ quản trị CSDL quan hệ phổ biến.',
        },
      ],
    },
    {
      grade: 11,
      chapterId: 4,
      topicTag: 'Ngôn ngữ truy vấn SQL, bảo mật và quản trị CSDL',
      trapTag: 'Dùng mệnh đề WHERE thay vì ORDER BY hoặc viết sai thứ tự mệnh đề SELECT - FROM - WHERE',
      chapterTitle: 'Truy vấn SQL & Quản trị CSDL',
      bank: [
        {
          q: 'Trong ngôn ngữ SQL, thứ tự viết đúng của các mệnh đề cơ bản trong câu lệnh truy vấn dữ liệu là:',
          c: 'SELECT ... FROM ... WHERE ... ORDER BY ...',
          d: ['FROM ... SELECT ... ORDER BY ... WHERE ...', 'WHERE ... SELECT ... FROM ...', 'ORDER BY ... FROM ... SELECT ...'],
          ex: 'Cú pháp chuẩn SQL luôn bắt đầu bởi `SELECT <cột> FROM <bảng> [WHERE <điều kiện>] [ORDER BY <cột sắp xếp>]`.',
        },
        {
          q: 'Để lấy danh sách học sinh từ bảng `HOC_SINH` có điểm Toán từ $8.0$ trở lên và sắp xếp điểm giảm dần, câu lệnh SQL đúng là:',
          c: 'SELECT * FROM HOC_SINH WHERE DiemToan >= 8.0 ORDER BY DiemToan DESC;',
          d: ['SELECT * FROM HOC_SINH WHERE DiemToan >= 8.0 ORDER BY DiemToan ASC;', 'GET * FROM HOC_SINH IF DiemToan >= 8.0;', 'SELECT * WHERE DiemToan >= 8.0 FROM HOC_SINH;'],
          ex: 'Từ khóa `DESC` (Descending) sắp xếp theo thứ tự giảm dần; `ASC` là tăng dần.',
        },
        {
          q: 'Để kết nối dữ liệu từ hai bảng `HOC_SINH` và `LOP` dựa trên trường chung `MaLop`, ta sử dụng mệnh đề nào trong SQL?',
          c: 'INNER JOIN LOP ON HOC_SINH.MaLop = LOP.MaLop',
          d: ['DELETE LOP ON MaLop', 'DROP TABLE LOP', 'INSERT INTO LOP'],
          ex: '`INNER JOIN ... ON ...` ghép các bản ghi có giá trị khóa ngoại và khóa chính tương ứng bằng nhau giữa hai bảng.',
        },
        {
          q: 'Nhiệm vụ nào sau đây là công việc thường xuyên của Nhà quản trị cơ sở dữ liệu (DBA)?',
          c: 'Phân quyền truy cập, sao lưu dự phòng (backup) định kỳ và tối ưu hiệu năng truy vấn CSDL',
          d: ['Thiết kế logo thương hiệu bằng Inkscape', 'Dựng kỹ xảo phim hoạt hình 3D', 'Viết kịch bản quảng cáo truyền hình'],
          ex: 'Quản trị CSDL (DBA) chịu trách nhiệm đảm bảo hệ CSDL vận hành ổn định, bảo mật và phục hồi được khi gặp sự cố.',
        },
        {
          q: 'Trong SQL, hàm tổng hợp nào dùng để đếm số lượng bản ghi thỏa mãn điều kiện truy vấn?',
          c: 'COUNT(*)',
          d: ['UPPER()', 'SUBSTRING()', 'CONCAT()'],
          ex: '`COUNT(*)` đếm tổng số dòng kết quả; các hàm `SUM`, `AVG`, `MAX`, `MIN` tính tổng, trung bình, lớn nhất, nhỏ nhất.',
        },
      ],
    },
    {
      grade: 12,
      chapterId: 1,
      topicTag: 'Trí tuệ nhân tạo (AI) trong khoa học và đời sống',
      trapTag: 'Nhầm lẫn AI hẹp (ANI - chuyên biệt) với AI tổng quát (AGI) có ý thức như con người',
      chapterTitle: 'Trí tuệ nhân tạo (AI)',
      bank: [
        {
          q: 'Hệ thống nhận diện khuôn mặt mở khóa điện thoại (FaceID) hay gợi ý video thuộc phân loại Trí tuệ nhân tạo nào hiện nay?',
          c: 'Trí tuệ nhân tạo hẹp / AI yếu (ANI – Artificial Narrow Intelligence)',
          d: ['Trí tuệ nhân tạo tổng quát (AGI) vượt con người ở mọi lĩnh vực', 'Hệ soạn thảo văn bản tĩnh cổ điển', 'Mạch cộng nhị phân thuần phần cứng không dùng dữ liệu'],
          ex: 'Các ứng dụng AI thực tế hiện nay đều thuộc AI hẹp (ANI), được huấn luyện giải quyết xuất sắc một nhóm tác vụ chuyên biệt.',
        },
        {
          q: 'Lĩnh vực con nào của AI giúp máy tính hiểu, dịch thuật và sinh văn bản ngôn ngữ con người (như ChatGPT, Gemini)?',
          c: 'Xử lý ngôn ngữ tự nhiên (NLP – Natural Language Processing)',
          d: ['Thiết kế bảng mạch in (PCB)', 'Định tuyến gói tin vật lý tầng 1', 'Quản lý phân vùng đĩa cứng FAT32'],
          ex: 'NLP là nhánh của AI tập trung vào khả năng đọc hiểu, phân tích ngữ nghĩa và tạo sinh ngôn ngữ tự nhiên.',
        },
        {
          q: 'Khả năng hệ thống AI tự rút ra quy luật và cải thiện độ chính xác dự đoán từ tập dữ liệu lớn mà không cần lập trình cứng từng luật gọi là:',
          c: 'Học máy (Machine Learning)',
          d: ['Sao lưu thủ công (Manual Backup)', 'Định dạng văn bản HTML', 'Nén tệp tin không mất dữ liệu'],
          ex: 'Học máy (Machine Learning) cho phép mô hình học các mẫu đặc trưng trực tiếp từ dữ liệu huấn luyện.',
        },
        {
          q: 'Rủi ro đạo đức lớn cần cảnh giác khi sử dụng công nghệ AI tạo sinh hình ảnh/âm thanh là gì?',
          c: 'Tạo video/giọng nói giả mạo (Deepfake) để lừa đảo hoặc xâm phạm danh dự người khác',
          d: ['Làm màn hình máy tính tự động tăng độ phân giải vật lý', 'Khiến cáp mạng LAN biến thành cáp quang', 'Tự động xóa hệ điều hành khi gõ văn bản'],
          ex: 'Deepfake lợi dụng mô hình sinh sâu để giả mạo khuôn mặt/giọng nói rất giống thật, gây nguy cơ lừa đảo tài chính và tin giả.',
        },
        {
          q: 'Ứng dụng AI đọc ảnh chụp X-quang và cắt lớp CT để hỗ trợ bác sĩ phát hiện sớm khối u thuộc lĩnh vực:',
          c: 'Thị giác máy tính (Computer Vision) trong Y học',
          d: ['Kế toán tiền lương doanh nghiệp', 'Soạn nhạc giao hưởng cổ điển', 'Quản lý kho hàng siêu thị'],
          ex: 'Computer Vision giúp máy tính trích xuất thông tin và nhận dạng bất thường trên hình ảnh y khoa độ phân giải cao.',
        },
      ],
    },
    {
      grade: 12,
      chapterId: 2,
      topicTag: 'Thiết bị mạng, giao thức TCP/IP và chia sẻ tài nguyên',
      trapTag: 'Nhầm chức năng chuyển mạch nội bộ LAN của Switch với định tuyến liên mạng của Router',
      chapterTitle: 'Thiết bị mạng & Giao thức TCP/IP',
      bank: [
        {
          q: 'Thiết bị mạng nào có chức năng chính là tìm đường đi tối ưu và chuyển tiếp gói tin giữa các mạng khác nhau (ví dụ nối mạng LAN gia đình ra Internet)?',
          c: 'Bộ định tuyến (Router)',
          d: ['Bộ chuyển mạch nội bộ (Switch)', 'Dây cáp xoắn đôi UTP', 'Máy in mạng nội bộ'],
          ex: 'Router hoạt động ở tầng Mạng (Network Layer), sử dụng địa chỉ IP và bảng định tuyến để kết nối các mạng khác nhau.',
        },
        {
          q: 'Thiết bị Access Point (AP – Điểm truy cập không dây) dùng để làm gì trong mạng cục bộ?',
          c: 'Phát sóng Wi-Fi giúp các thiết bị di động kết nối không dây vào mạng LAN',
          d: ['Chuyển đổi dòng điện xoay chiều 220V thành 5V cho chuột có dây', 'Lưu trữ vĩnh viễn hệ quản trị CSDL quốc gia', 'Biên dịch mã nguồn Python sang ngôn ngữ máy'],
          ex: 'Access Point mở rộng mạng LAN có dây thành mạng LAN không dây (WLAN / Wi-Fi).',
        },
        {
          q: 'Trong bộ giao thức TCP/IP, giao thức nào chịu trách nhiệm phân giải tên miền dễ nhớ (như `schoolify.top`) sang địa chỉ IP số?',
          c: 'DNS (Domain Name System)',
          d: ['SMTP', 'FTP', 'DHCP'],
          ex: 'DNS là hệ thống phân giải tên miền thành địa chỉ IP tương ứng để trình duyệt định vị được máy chủ.',
        },
        {
          q: 'Địa chỉ nào dưới đây là một địa chỉ IPv4 hợp lệ?',
          c: '192.168.1.25',
          d: ['192.168.300.1', '256.0.0.1', '192.168.1'],
          ex: 'Địa chỉ IPv4 gồm 4 số nguyên (octet) cách nhau bởi dấu chấm, mỗi số nằm trong đoạn từ $0$ đến $255$.',
        },
        {
          q: 'Vai trò của giao thức TCP (Transmission Control Protocol) khi truyền dữ liệu trên Internet là:',
          c: 'Chia dữ liệu thành các gói đánh số thứ tự, kiểm soát lỗi và đảm bảo truyền tin cậy đúng thứ tự',
          d: ['Biến đổi tín hiệu quang thành tín hiệu âm thanh loa ngoài', 'Định dạng màu sắc cho thẻ tiêu đề trang web', 'Tự động xóa tệp tin tạm trên ổ đĩa C'],
          ex: 'TCP thiết lập kết nối tin cậy, đánh số gói tin và yêu cầu gửi lại nếu gói tin bị thất lạc trên đường truyền.',
        },
      ],
    },
    {
      grade: 12,
      chapterId: 3,
      topicTag: 'Giữ gìn tính nhân văn và ứng xử trong không gian mạng',
      trapTag: 'Cho rằng tài khoản ẩn danh trên mạng không phải chịu trách nhiệm pháp lý',
      chapterTitle: 'Ứng xử nhân văn không gian mạng',
      bank: [
        {
          q: 'Biểu hiện nào sau đây thể hiện "tính nhân văn" khi tham gia thảo luận trên không gian mạng?',
          c: 'Lắng nghe đa chiều, tôn trọng sự khác biệt, phản biện lịch sự bằng lý lẽ và cảm thông với hoàn cảnh người khác',
          d: ['Hùa theo đám đông công kích cá nhân (cyberbullying) khi chưa rõ sự thật', 'Dùng tài khoản ảo để bình luận miệt thị ngoại hình người khác', 'Chia sẻ ngay tin đồn giật gân chưa kiểm chứng để câu lượt xem'],
          ex: 'Ứng xử nhân văn trong thế giới ảo đòi hỏi sự thấu cảm, tôn trọng nhân phẩm và kiểm chứng thông tin có trách nhiệm.',
        },
        {
          q: 'Nhược điểm lớn của giao tiếp qua tin nhắn văn bản trực tuyến so với giao tiếp trực tiếp mặt đối mặt là:',
          c: 'Thiếu ngữ điệu giọng nói, ánh mắt và biểu cảm cơ thể nên dễ gây hiểu lầm sắc thái cảm xúc',
          d: ['Không thể gửi thông điệp cho người ở xa địa lý', 'Luôn tốn chi phí vận chuyển bưu phẩm vật lý', 'Chỉ gửi được vào giờ hành chính ban ngày'],
          ex: 'Giao tiếp phi ngôn ngữ bị hạn chế trên môi trường văn bản số dễ khiến câu nói ngắn bị hiểu nhầm là lạnh lùng hay gay gắt.',
        },
        {
          q: 'Khi bắt gặp một bài viết kêu gọi từ thiện đáng ngờ trên mạng xã hội, hành động đúng đắn nhất của học sinh là:',
          c: 'Kiểm chứng nguồn tin qua các kênh báo chí/tổ chức chính thống trước khi chia sẻ hoặc ủng hộ',
          d: ['Chuyển tiền ngay lập tức và chia sẻ vào 10 nhóm lớp', 'Bình luận chửi bới nặng nề dù chưa có bằng chứng', 'Gửi mật khẩu tài khoản ngân hàng cho người đăng bài'],
          ex: 'Kiểm chứng chéo từ nguồn chính thống giúp bảo vệ bản thân và cộng đồng khỏi các chiêu trò trục lợi lòng tốt.',
        },
        {
          q: 'Khi bản thân hoặc bạn bè trở thành nạn nhân của bắt nạt qua mạng (Cyberbullying), cách xử lý an toàn và hiệu quả là:',
          c: 'Lưu lại bằng chứng (chụp màn hình), chặn tài khoản quấy rối và báo ngay cho cha mẹ, thầy cô hoặc cơ quan chức năng',
          d: ['Giấu kín chịu đựng một mình và xóa hết bằng chứng', 'Tạo nhiều tài khoản giả để chửi lại suốt ngày đêm', 'Công khai địa chỉ nhà riêng thách thức đối phương'],
          ex: 'Lưu bằng chứng, chặn liên lạc độc hại và tìm kiếm sự hỗ trợ từ người lớn tin cậy/pháp luật là quy tắc vàng chống bắt nạt mạng.',
        },
        {
          q: 'Nguyên tắc "Suy nghĩ trước khi bấm Đăng (Think before you post)" nhắc nhở người dùng điều gì?',
          c: 'Dấu vết số tồn tại lâu dài và có thể ảnh hưởng trực tiếp tới uy tín, học tập, nghề nghiệp tương lai',
          d: ['Mọi bài đăng trên mạng đều tự biến mất hoàn toàn sau 5 phút', 'Chỉ cần dùng chế độ ẩn danh là không ai biết nội dung mình đăng', 'Nên đăng càng nhiều thông tin riêng tư càng tốt'],
          ex: 'Dấu chân số (Digital Footprint) rất khó xóa bỏ triệt để nên mỗi nội dung đăng tải cần đúng sự thật, văn minh và hợp pháp.',
        },
      ],
    },
    {
      grade: 12,
      chapterId: 4,
      topicTag: 'Ngôn ngữ đánh dấu siêu văn bản HTML',
      trapTag: 'Nhầm lẫn giữa thuộc tính src (của thẻ img) và thuộc tính href (của thẻ liên kết a)',
      chapterTitle: 'Tạo trang web với HTML',
      bank: [
        {
          q: 'Trong HTML5, cặp thẻ nào dùng để tạo một siêu liên kết dẫn tới địa chỉ trang web khác?',
          c: '<a href="https://schoolify.top">Luyện thi</a>',
          d: ['<link src="https://schoolify.top">Luyện thi</link>', '<img href="https://schoolify.top">', '<url="https://schoolify.top">Luyện thi</url>'],
          ex: 'Thẻ `<a>` (Anchor) kết hợp thuộc tính `href` dùng để tạo siêu liên kết trong HTML.',
        },
        {
          q: 'Trong HTML, thẻ tiêu đề nào có kích thước chữ mặc định lớn nhất và mức độ quan trọng ngữ nghĩa cao nhất trên trang?',
          c: '<h1>',
          d: ['<h6>', '<p>', '<span>'],
          ex: 'HTML cung cấp 6 cấp tiêu đề từ `<h1>` (quan trọng & lớn nhất) giảm dần đến `<h6>` (nhỏ nhất).',
        },
        {
          q: 'Để tạo một danh sách có thứ tự đánh số tự động ($1, 2, 3, \\dots$) trong HTML, ta sử dụng cặp thẻ bao ngoài nào?',
          c: '<ol> ... </ol> bên trong chứa các thẻ <li>',
          d: ['<ul> ... </ul> bên trong chứa các thẻ <td>', '<table> ... </table>', '<form> ... </form>'],
          ex: '`<ol>` (Ordered List) tạo danh sách có thứ tự, còn `<ul>` (Unordered List) tạo danh sách dấu chấm đầu dòng.',
        },
        {
          q: 'Khi chèn hình ảnh bằng thẻ `<img src="logo.png" alt="Logo trường">`, thuộc tính `alt` có tác dụng gì?',
          c: 'Hiển thị văn bản thay thế khi ảnh lỗi tải và hỗ trợ trình đọc màn hình cho người khiếm thị',
          d: ['Phóng to kích thước ảnh lên gấp đôi', 'Đổi định dạng tệp ảnh sang video', 'Đặt mật khẩu khóa hình ảnh'],
          ex: 'Thuộc tính `alt` (Alternative text) cung cấp mô tả văn bản khi ảnh không hiển thị được và tối ưu khả năng tiếp cận (a11y).',
        },
        {
          q: 'Trong biểu mẫu `<form>` của HTML, phần tử nào tạo ô nhập mật khẩu tự động che ký tự thành dấu chấm tròn?',
          c: '<input type="password">',
          d: ['<input type="text">', '<input type="checkbox">', '<textarea></textarea>'],
          ex: '`type="password"` ẩn các ký tự người dùng gõ trên màn hình để bảo mật mật khẩu.',
        },
      ],
    },
    {
      grade: 12,
      chapterId: 5,
      topicTag: 'Định dạng và bố cục trang web với CSS',
      trapTag: 'Nhầm lẫn ký hiệu bộ chọn #id (dấu thăng) và .class (dấu chấm) hoặc nhầm margin với padding',
      chapterTitle: 'Định dạng trang web với CSS',
      bank: [
        {
          q: 'Trong CSS, để định dạng màu chữ xanh cho phần tử HTML có thuộc tính `id="header-main"`, bộ chọn (selector) đúng là:',
          c: '#header-main { color: blue; }',
          d: ['.header-main { color: blue; }', 'header-main { text-color: blue; }', '*header-main { font-color: blue; }'],
          ex: 'Bộ chọn theo định danh `id` bắt đầu bằng dấu `#`, còn bộ chọn theo lớp `class` bắt đầu bằng dấu chấm `.`.',
        },
        {
          q: 'Trong mô hình hộp (Box Model) của CSS, thuộc tính nào quy định khoảng đệm BÊN TRONG giữa nội dung (content) và đường viền (border)?',
          c: 'padding',
          d: ['margin', 'border-style', 'z-index'],
          ex: '`padding` là vùng đệm bên trong đường viền, còn `margin` là khoảng lề bên ngoài tách phần tử đó với các phần tử xung quanh.',
        },
        {
          q: 'Xét độ ưu tiên (Specificity) thông thường trong CSS khi cùng tác động lên một thẻ HTML (không dùng `!important`), bộ chọn nào có mức ưu tiên CAO NHẤT?',
          c: 'Bộ chọn định danh #id',
          d: ['Bộ chọn lớp .class', 'Bộ chọn tên thẻ (ví dụ p, div)', 'Bộ chọn phổ quát *'],
          ex: 'Thứ tự độ ưu tiên tăng dần: `*` < `tên thẻ (tag)` < `.class` < `#id` < `inline style`.',
        },
        {
          q: 'Để nhúng một tệp CSS ngoại vi tên `style.css` vào phần `<head>` của trang HTML, câu lệnh chuẩn là:',
          c: '<link rel="stylesheet" href="style.css">',
          d: ['<style src="style.css"></style>', '<script href="style.css"></script>', '<css link="style.css">'],
          ex: 'External CSS được liên kết vào trang HTML qua thẻ `<link rel="stylesheet" href="đường_dẫn.css">`.',
        },
        {
          q: 'Trong CSS, thuộc tính nào dùng để in đậm chữ cho một đoạn văn bản?',
          c: 'font-weight: bold;',
          d: ['font-style: italic;', 'text-decoration: underline;', 'text-align: center;'],
          ex: '`font-weight: bold` (hoặc `700`) làm đậm nét chữ; `font-style: italic` in nghiêng; `text-decoration: underline` gạch chân.',
        },
      ],
    },
    {
      grade: 12,
      chapterId: 6,
      topicTag: 'Hướng nghiệp CNTT, CSDL SQL và Giải thuật THPT',
      trapTag: 'Nhầm công việc của Chuyên gia An toàn thông tin với nhân viên bán hàng thiết bị',
      chapterTitle: 'Hướng nghiệp CNTT, SQL & Giải thuật',
      bank: [
        {
          q: 'Chuyên gia An toàn thông tin (Information Security Analyst) trong tổ chức có nhiệm vụ trọng tâm là:',
          c: 'Giám sát lỗ hổng bảo mật, thiết lập tường lửa, phòng chống tấn công mạng và bảo vệ dữ liệu hệ thống',
          d: ['Thay mực máy in định kỳ cho phòng hành chính', 'Chỉnh sửa ảnh cưới bằng phần mềm đồ họa', 'Soạn thảo hợp đồng thuê mặt bằng văn phòng'],
          ex: 'Chuyên gia An toàn thông tin bảo vệ hạ tầng số trước các mối đe dọa xâm nhập, rò rỉ dữ liệu và mã độc.',
        },
        {
          q: 'Công việc chính của Kỹ thuật viên sửa chữa và bảo trì máy tính là:',
          c: 'Chẩn đoán lỗi phần cứng, thay thế linh kiện hỏng, cài đặt hệ điều hành – trình điều khiển và bảo dưỡng định kỳ',
          d: ['Huấn luyện mô hình ngôn ngữ lớn hàng trăm tỷ tham số', 'Viết luật sở hữu trí tuệ quốc tế', 'Quản lý quỹ đầu tư chứng khoán'],
          ex: 'Kỹ thuật viên bảo trì đảm bảo máy trạm, thiết bị ngoại vi và phần mềm hệ thống của đơn vị luôn hoạt động thông suốt.',
        },
        {
          q: 'Trong SQL, câu lệnh `SELECT MaLop, COUNT(*) FROM HOC_SINH GROUP BY MaLop;` thực hiện yêu cầu gì?',
          c: 'Thống kê số lượng học sinh của từng lớp trong bảng HOC_SINH',
          d: ['Xóa toàn bộ học sinh có cùng mã lớp', 'Đổi tên cột MaLop thành COUNT', 'Chỉ lấy ra duy nhất 1 học sinh đầu tiên của trường'],
          ex: '`GROUP BY MaLop` gom nhóm các bản ghi cùng lớp và `COUNT(*)` đếm sĩ số tương ứng của mỗi nhóm lớp.',
        },
        {
          q: 'Thuật toán tìm kiếm nhị phân (Binary Search) trên mảng đã sắp xếp gồm $1024$ phần tử cần tối đa khoảng bao nhiêu lần so sánh phần tử giữa?',
          c: '$11$ lần (cỡ $\\log_2 1024 + 1$)',
          d: ['$1024$ lần', '$512$ lần', '$100$ lần'],
          ex: 'Do $1024 = 2^{10}$, mỗi bước chặt đôi không gian tìm kiếm nên chỉ cần tối đa $10 + 1 = 11$ phép so sánh.',
        },
        {
          q: 'Nhóm nghề Quản trị mạng và hệ thống (Network & System Administrator) đòi hỏi kiến thức nền tảng vững chắc nhất về:',
          c: 'Hệ điều hành máy chủ (Linux/Windows Server), giao thức mạng TCP/IP, định tuyến và ảo hóa đám mây',
          d: ['Kỹ thuật pha phối màu sơn dầu trên toan vải', 'Biên tập âm thanh phòng thu ca nhạc', 'Chấm công tính lương thủ công'],
          ex: 'Quản trị mạng và hệ thống vận hành hạ tầng máy chủ, mạng nội bộ/Internet và dịch vụ đám mây của doanh nghiệp.',
        },
      ],
    },
  ];

  // Expand each theory chapter bank (5 core templates x 3 variations = 15 clean questions)
  for (const ch of tinTheoryChapters) {
    for (let i = 0; i < 15; i++) {
      const { bloom, cogLabel } = bloomByIdx(i);
      const base = ch.bank[i % ch.bank.length];
      const variantSuffix =
        i >= 5 && i < 10
          ? ' (Tình huống vận dụng thực tiễn)'
          : i >= 10
            ? ' (Phân tích chuyên sâu)'
            : '';
      const { choices, correctIndex } = rotateChoices(base.c, base.d, i + ch.chapterId);
      out.push({
        id: `gdpt18-tin${ch.grade}-ch${ch.chapterId}-q${String(i + 1).padStart(2, '0')}`,
        subject: 'tin-hoc',
        grade: ch.grade,
        chapterId: ch.chapterId,
        topicTag: ch.topicTag,
        trapTag: ch.trapTag,
        bloomLevel: bloom,
        title: `Câu ${i + 1} (${cogLabel}): ${ch.chapterTitle}${variantSuffix}`,
        question: base.q,
        choices,
        correctIndex,
        explanation: base.ex,
      });
    }
  }

  // Tin 10 Chương 5 (Python cơ bản, if-else, vòng lặp) — 15 bài code tính toán thật 100%!
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const n = 4 + (i % 6); // 4..9
    const step = (i % 2) + 1;
    let s = 0;
    for (let k = 1; k <= n; k += step) s += k;
    const rangeExpr = step === 1 ? `range(1, ${n + 1})` : `range(1, ${n + 1}, ${step})`;
    const { choices, correctIndex } = rotateChoices(
      `$${s}$`,
      [`$${s + n + 1}$`, `$${s - 1}$`, `$${n * step}$`],
      i + 2,
    );
    out.push({
      id: `gdpt18-tin10-ch5-q${String(i + 1).padStart(2, '0')}`,
      subject: 'tin-hoc',
      grade: 10,
      chapterId: 5,
      topicTag: 'Lập trình Python cơ bản, rẽ nhánh và vòng lặp',
      trapTag: 'Nhầm cận trên của hàm range(a, b) trong Python dừng tại b - 1 chứ không lấy b',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Vòng lặp for & range() trong Python`,
      question: `Cho đoạn lệnh Python sau: \`s = 0; [s := s + k for k in ${rangeExpr}]\`, hoặc tương đương:\n\`s = 0\`\n\`for k in ${rangeExpr}: s += k\`\n\`print(s)\`\nKết quả in ra màn hình là:`,
      choices,
      correctIndex,
      explanation: `Hàm \`${rangeExpr}\` sinh các giá trị bắt đầu từ $1$, bước nhảy $${step}$ và nhỏ hơn $${n + 1}$. Cộng dồn các giá trị đó ta được \`s = ${s}\`.`,
    });
  }

  // Tin 10 Chương 6 (List, String, Hàm def trong Python) — 15 bài code tính toán thật 100%!
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const base = i + 2;
    const arr = [base, base + 3, base + 5, base + 8, base + 11];
    // Slicing arr[1:4] => sum of arr[1], arr[2], arr[3]
    const sliceSum = arr[1] + arr[2] + arr[3];
    const isFunc = i % 2 === 1;
    const xArg = 3 + (i % 5);
    const fnRes = xArg * xArg + 2 * xArg;
    const qText = isFunc
      ? `Trong Python, cho hàm \`def f(x): return x * x + 2 * x\`. Giá trị của biểu thức \`f(${xArg})\` bằng:`
      : `Trong Python, cho danh sách \`a = [${arr.join(', ')}]\`. Giá trị của biểu thức \`sum(a[1:4])\` bằng:`;
    const correct = isFunc ? `$${fnRes}$` : `$${sliceSum}$`;
    const distractors: [string, string, string] = isFunc
      ? [`$${xArg * 2 + 2}$`, `$${fnRes + xArg}$`, `$${xArg * xArg}$`]
      : [`$${arr[1] + arr[2] + arr[3] + arr[4]}$`, `$${arr[0] + arr[1] + arr[2] + arr[3]}$`, `$${arr[1] + arr[4]}$`];
    const explain = isFunc
      ? `Thay tham số \`x = ${xArg}\` vào thân hàm: \`${xArg} * ${xArg} + 2 * ${xArg} = ${fnRes}\`.`
      : `Danh sách đánh chỉ số từ $0$, lát cắt \`a[1:4]\` gồm các phần tử ở chỉ số $1, 2, 3$ là \`[${arr[1]}, ${arr[2]}, ${arr[3]}]\`, tổng bằng $${sliceSum}$.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 1);
    out.push({
      id: `gdpt18-tin10-ch6-q${String(i + 1).padStart(2, '0')}`,
      subject: 'tin-hoc',
      grade: 10,
      chapterId: 6,
      topicTag: 'Danh sách (List), Xâu ký tự và Hàm trong Python',
      trapTag: 'Nhầm chỉ số bắt đầu từ 1 thay vì 0 hoặc lấy thừa chỉ số cuối của lát cắt a[1:4]',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): List, Xâu ký tự & Hàm Python`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Tin 11 Chương 5 (Mảng 1D/2D & Tìm kiếm - Sắp xếp) — 15 câu chuẩn thuật toán!
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const start = (i + 1) * 2;
    const sorted = [start, start + 3, start + 7, start + 11, start + 15, start + 19, start + 24];
    // Tìm kiếm nhị phân phần tử ở index 5 (lần 1 mid=3 < target => left=4, right=6 => lần 2 mid=5 trúng!)
    const target = sorted[5];
    const isMatrix = i % 2 === 1;
    const m00 = i + 1;
    const m11 = i + 4;
    const diagSum = m00 + m11;
    const qText = isMatrix
      ? `Trong Python, cho mảng hai chiều \`A = [[${m00}, 5], [9, ${m11}]]\`. Giá trị của biểu thức \`A[0][0] + A[1][1]\` (tổng đường chéo chính) bằng:`
      : `Cho dãy tăng dần $7$ phần tử \`A = [${sorted.join(', ')}]\` (chỉ số từ $0$ đến $6$). Khi thực hiện Tìm kiếm nhị phân tìm giá trị \`x = ${target}\`, ở bước đầu tiên phần tử chính giữa được đem so sánh có giá trị là:`;
    const correct = isMatrix ? `$${diagSum}$` : `$${sorted[3]}$`;
    const distractors: [string, string, string] = isMatrix
      ? [`$14$`, `$${m00 + 5}$`, `$${9 + m11}$`]
      : [`$${sorted[2]}$`, `$${sorted[4]}$`, `$${sorted[5]}$`];
    const explain = isMatrix
      ? `\`A[0][0] = ${m00}\` và \`A[1][1] = ${m11}\`, suy ra tổng bằng $${m00} + ${m11} = ${diagSum}$.`
      : `Ban đầu \`left = 0, right = 6\` $\\Rightarrow$ \`mid = (0 + 6) // 2 = 3\`, phần tử chính giữa đầu tiên được kiểm tra là \`A[3] = ${sorted[3]}\`.`;
    const { choices, correctIndex } = rotateChoices(correct, distractors, i + 2);
    out.push({
      id: `gdpt18-tin11-ch5-q${String(i + 1).padStart(2, '0')}`,
      subject: 'tin-hoc',
      grade: 11,
      chapterId: 5,
      topicTag: 'Mảng 1D/2D, Tìm kiếm nhị phân và các thuật toán sắp xếp',
      trapTag: 'Tính nhầm chỉ số giữa mid hoặc nhầm chỉ số hàng - cột của mảng 2 chiều',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Mảng & Thuật toán Tìm kiếm – Sắp xếp`,
      question: qText,
      choices,
      correctIndex,
      explanation: explain,
    });
  }

  // Tin 11 Chương 6 (Độ phức tạp thuật toán Big-O & Thiết kế mô đun)
  const bigOBank = [
    {
      q: 'Độ phức tạp thời gian của thao tác truy cập trực tiếp một phần tử mảng theo chỉ số `A[i]` là:',
      c: '$O(1)$',
      d: ['$O(n)$', '$O(n^2)$', '$O(2^n)$'] as [string, string, string],
      ex: 'Truy cập phần tử mảng qua chỉ số tốn thời gian hằng số không phụ thuộc kích thước mảng $n$, nên có độ phức tạp $O(1)$.',
    },
    {
      q: 'Độ phức tạp thời gian trong trường hợp xấu nhất của thuật toán Tìm kiếm nhị phân trên mảng đã sắp xếp độ dài $n$ là:',
      c: '$O(\\log n)$',
      d: ['$O(n)$', '$O(n \\log n)$', '$O(n^2)$'] as [string, string, string],
      ex: 'Mỗi bước tìm kiếm nhị phân thu hẹp một nửa phạm vi tìm kiếm nên số bước tỉ lệ với $\\log_2 n$, độ phức tạp là $O(\\log n)$.',
    },
    {
      q: 'Đoạn chương trình gồm hai vòng lặp `for i in range(n):` lồng bên trong là `for j in range(n):` thực hiện phép cộng đơn giản có độ phức tạp thời gian là:',
      c: '$O(n^2)$',
      d: ['$O(n)$', '$O(\\log n)$', '$O(1)$'] as [string, string, string],
      ex: 'Vòng ngoài lặp $n$ lần, ứng với mỗi lần vòng trong lặp $n$ lần nên tổng số phép toán cỡ $n \\times n = n^2 \\Rightarrow O(n^2)$.',
    },
    {
      q: 'Phương pháp "Làm mịn dần" (Stepwise Refinement) trong thiết kế chương trình là cách tiếp cận:',
      c: 'Từ trên xuống (Top-down): chia bài toán lớn thành các bài toán con nhỏ hơn, chi tiết dần cho tới khi cài đặt được ngay',
      d: ['Viết toàn bộ hàng nghìn dòng lệnh vào chung một hàm duy nhất không chia nhỏ', 'Xóa hết chú thích để chương trình chạy nhanh hơn', 'Không bao giờ kiểm thử từng hàm con'],
      ex: 'Làm mịn dần phân rã bài toán tổng quát thành các bước/mô đun nhỏ dần từ khái quát đến cụ thể.',
    },
    {
      q: 'Trong Python, để nạp và sử dụng các hàm toán học chuẩn từ thư viện `math` (như `sqrt`, `gcd`), ta dùng câu lệnh:',
      c: 'import math',
      d: ['include <math.h>', 'using namespace math;', 'package math;'],
      ex: 'Python sử dụng từ khóa `import <tên_mô_đun>` (ví dụ `import math` hoặc `from math import sqrt`).',
    },
  ];
  for (let i = 0; i < 15; i++) {
    const { bloom, cogLabel } = bloomByIdx(i);
    const item = bigOBank[i % bigOBank.length];
    const { choices, correctIndex } = rotateChoices(item.c, item.d as [string, string, string], i + 1);
    out.push({
      id: `gdpt18-tin11-ch6-q${String(i + 1).padStart(2, '0')}`,
      subject: 'tin-hoc',
      grade: 11,
      chapterId: 6,
      topicTag: 'Độ phức tạp thuật toán Big-O và thiết kế chương trình mô đun',
      trapTag: 'Cộng thay vì nhân số lần lặp khi đánh giá hai vòng lặp lồng nhau',
      bloomLevel: bloom,
      title: `Câu ${i + 1} (${cogLabel}): Độ phức tạp Big-O & Thiết kế mô đun`,
      question: item.q,
      choices,
      correctIndex,
      explanation: item.ex,
    });
  }

  return out;
}

async function main() {
  console.log('🚀 Bắt đầu nạp Ngân hàng câu hỏi GDPT 2018 (Toán Số/Hình & Tin học Lớp 10, 11, 12) vào PostgreSQL...');

  const allQuestions: SeedQuestionInput[] = [
    ...buildMath10Questions(),
    ...buildMath11Questions(),
    ...buildMath12SupplementalQuestions(),
    ...buildInformaticsQuestions(),
  ];

  console.log(`📦 Tổng số câu hỏi chuẩn bị đồng bộ: ${allQuestions.length} câu hỏi.`);

  // Đảm bảo có QuestionBank cho từng (subject, grade)
  const bankCache = new Map<string, string>();
  async function getOrCreateBankId(subject: string, grade: number): Promise<string> {
    const key = `${subject}::${grade}`;
    if (bankCache.has(key)) return bankCache.get(key)!;
    const title = `Ngân hàng GDPT 2018 ${subject === 'toan-hoc' ? 'Toán Học' : 'Tin Học'} - Khối ${grade}`;
    let bank = await prisma.questionBank.findFirst({
      where: { title },
    });
    if (!bank) {
      bank = await prisma.questionBank.create({
        data: {
          title,
          is_premium: false,
        },
      });
    }
    bankCache.set(key, bank.id);
    return bank.id;
  }

  let upserted = 0;
  for (const q of allQuestions) {
    const bankId = await getOrCreateBankId(q.subject, q.grade);
    const correctLabel = ['A', 'B', 'C', 'D'][q.correctIndex];
    const cognitiveTag =
      q.bloomLevel === BloomLevel.NHAN_BIET
        ? 'Nhận biết'
        : q.bloomLevel === BloomLevel.THONG_HIEU
          ? 'Thông hiểu'
          : q.bloomLevel === BloomLevel.VAN_DUNG
            ? 'Vận dụng'
            : 'Vận dụng cao';

    await prisma.question.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        bank_id: bankId,
        subject: q.subject,
        grade: q.grade,
        chapter_id: q.chapterId,
        title: q.title,
        question: q.question,
        answer: correctLabel,
        explanation: q.explanation,
        topic_tag: q.topicTag,
        cognitive_tag: cognitiveTag,
        trap_tag: q.trapTag,
        bloom_level: q.bloomLevel,
        question_format: QuestionFormat.SINGLE_CHOICE,
        type: 'MULTIPLE_CHOICE',
        default_points: 0.25,
      },
      update: {
        bank_id: bankId,
        subject: q.subject,
        grade: q.grade,
        chapter_id: q.chapterId,
        title: q.title,
        question: q.question,
        answer: correctLabel,
        explanation: q.explanation,
        topic_tag: q.topicTag,
        cognitive_tag: cognitiveTag,
        trap_tag: q.trapTag,
        bloom_level: q.bloomLevel,
        question_format: QuestionFormat.SINGLE_CHOICE,
        type: 'MULTIPLE_CHOICE',
      },
    });

    await prisma.answer.deleteMany({ where: { question_id: q.id } });
    await prisma.answer.createMany({
      data: q.choices.map((content, idx) => ({
        question_id: q.id,
        sub_label: ['A', 'B', 'C', 'D'][idx],
        content,
        is_answer: idx === q.correctIndex,
      })),
    });

    upserted++;
  }

  console.log(`✅ Đã đồng bộ thành công ${upserted} câu hỏi GDPT 2018 vào PostgreSQL!`);
}

main()
  .catch((err) => {
    console.error('❌ Seed lỗi:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

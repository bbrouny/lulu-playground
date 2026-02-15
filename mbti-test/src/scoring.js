/**
 * MBTI scoring (설계 문서 기준) - 점수 계산 로직만 포함.
 *
 * 입력:
 * - questions: questions_v1.json의 questions[]
 * - answers: [{ id: questionId, choiceId: "A"|"B" }]
 *
 * 출력(최소):
 * - type: "ENFP" 같은 4글자
 * - axes: { EI:{E,I}, SN:{S,N}, TF:{T,F}, JP:{J,P} }  // 퍼센트
 * - raw:  { EI:{E,I}, ... }                            // 원점수
 * - ties: ["EI", ...]                                  // 동률(50/50) 축
 */

const AXIS_DIRECTIONS = {
  EI: ["E", "I"],
  SN: ["S", "N"],
  TF: ["T", "F"],
  JP: ["J", "P"]
};

function clampInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : 0;
}

function safeWeight(w) {
  const x = Number(w);
  return Number.isFinite(x) && x > 0 ? x : 1;
}

function safePoints(p) {
  const x = Number(p);
  // questions_v1.json에서 points가 없을 수도 있으니 기본값 1
  return Number.isFinite(x) && x !== 0 ? Math.trunc(x) : 1;
}

function pct(a, b) {
  const total = a + b;
  if (total <= 0) return [50, 50];
  const aPct = Math.round((a / total) * 100);
  return [aPct, 100 - aPct];
}

/**
 * 점수 계산 메인 함수
 * @param {{questions: any[], answers: {id: string, choiceId: "A"|"B"}[]}} input
 */
export function scoreTest(input) {
  const questions = Array.isArray(input?.questions) ? input.questions : [];
  const answers = Array.isArray(input?.answers) ? input.answers : [];

  /** @type {{[axis: string]: {[dir: string]: number}}} */
  const raw = {
    EI: { E: 0, I: 0 },
    SN: { S: 0, N: 0 },
    TF: { T: 0, F: 0 },
    JP: { J: 0, P: 0 }
  };

  const qById = new Map();
  for (const q of questions) {
    if (q?.id) qById.set(String(q.id), q);
  }

  for (const a of answers) {
    const q = qById.get(String(a?.id ?? ""));
    if (!q) continue;

    const axis = String(q.axis ?? "");
    if (!AXIS_DIRECTIONS[axis]) continue;

    const choiceId = String(a?.choiceId ?? "");
    const choice = Array.isArray(q.choices)
      ? q.choices.find((c) => String(c?.id ?? "") === choiceId)
      : null;
    if (!choice) continue;

    const score = choice.score ?? {};
    // choice.value (E/I/S/N/T/F/J/P)를 우선 사용하고, 없으면 score.direction으로 폴백
    const dir = String(choice.value ?? score.direction ?? "");
    const points = safePoints(score.points);
    const weight = safeWeight(q.weight);

    if (!raw[axis] || typeof raw[axis][dir] !== "number") continue;
    raw[axis][dir] += points * weight;
  }

  /** @type {{[axis: string]: {[dir: string]: number}}} */
  const axes = {};
  /** @type {string[]} */
  const ties = [];

  const axisOrder = /** @type {("EI"|"SN"|"TF"|"JP")[]} */ (["EI", "SN", "TF", "JP"]);
  let type = "";

  for (const axis of axisOrder) {
    const [d1, d2] = AXIS_DIRECTIONS[axis];
    const p1 = Number(raw[axis][d1] ?? 0);
    const p2 = Number(raw[axis][d2] ?? 0);

    const [d1Pct, d2Pct] = pct(p1, p2);
    axes[axis] = { [d1]: d1Pct, [d2]: d2Pct };

    // 최종 글자 결정: 설계 문서 기준 ">= 이면 왼쪽(E/S/T/J) 우선"
    type += d1Pct >= d2Pct ? d1 : d2;

    // 동률(50/50) 표기
    if (d1Pct === 50 && d2Pct === 50) ties.push(axis);
  }

  return {
    version: "1.0",
    type,
    axes,
    raw,
    ties
  };
}


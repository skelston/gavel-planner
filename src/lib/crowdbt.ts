const GAMMA = 0.1;
const KAPPA = 0.0001;
export const MU_PRIOR = 0;
export const SIGMA_SQ_PRIOR = 1;
export const ALPHA_PRIOR = 10;
export const BETA_PRIOR = 1;
export const EPSILON = 0.25;

function lgamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) {
    a += c[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betaln(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b);
}

function psi(x: number): number {
  let result = 0;
  while (x < 6) {
    result -= 1 / x;
    x += 1;
  }
  result += Math.log(x) - 1 / (2 * x);
  const x2 = 1 / (x * x);
  result -= x2 * (1 / 12 - x2 * (1 / 120 - x2 / 252));
  return result;
}

function divergenceGaussian(mu1: number, s1: number, mu2: number, s2: number) {
  const ratio = s1 / s2;
  return (mu1 - mu2) ** 2 / (2 * s2) + (ratio - 1 - Math.log(ratio)) / 2;
}

function divergenceBeta(a1: number, b1: number, a2: number, b2: number) {
  return (
    betaln(a2, b2) -
    betaln(a1, b1) +
    (a1 - a2) * psi(a1) +
    (b1 - b2) * psi(b1) +
    (a2 - a1 + b2 - b1) * psi(a1 + b1)
  );
}

function updatedAnnotator(
  alpha: number, beta: number,
  muW: number, sW: number, muL: number, sL: number,
): [number, number, number] {
  const eW = Math.exp(muW);
  const eL = Math.exp(muL);
  const c1 = eW / (eW + eL) + 0.5 * (sW + sL) * (eW * eL * (eL - eW)) / (eW + eL) ** 3;
  const c2 = 1 - c1;
  const c = (c1 * alpha + c2 * beta) / (alpha + beta);
  const expt = (c1 * (alpha + 1) * alpha + c2 * alpha * beta) / (c * (alpha + beta + 1) * (alpha + beta));
  const exptSq = (c1 * (alpha + 2) * (alpha + 1) * alpha + c2 * (alpha + 1) * alpha * beta) / (c * (alpha + beta + 2) * (alpha + beta + 1) * (alpha + beta));
  const variance = exptSq - expt ** 2;
  return [((expt - exptSq) * expt) / variance, ((expt - exptSq) * (1 - expt)) / variance, c];
}

function updatedMus(
  alpha: number, beta: number,
  muW: number, sW: number, muL: number, sL: number,
): [number, number] {
  const eW = Math.exp(muW);
  const eL = Math.exp(muL);
  const mult = (alpha * eW) / (alpha * eW + beta * eL) - eW / (eW + eL);
  return [muW + sW * mult, muL - sL * mult];
}

function updatedSigmaSqs(
  alpha: number, beta: number,
  muW: number, sW: number, muL: number, sL: number,
): [number, number] {
  const eW = Math.exp(muW);
  const eL = Math.exp(muL);
  const mult = (alpha * eW * beta * eL) / (alpha * eW + beta * eL) ** 2 - (eW * eL) / (eW + eL) ** 2;
  return [sW * Math.max(1 + sW * mult, KAPPA), sL * Math.max(1 + sL * mult, KAPPA)];
}

export function crowdBtUpdate(
  alpha: number, beta: number,
  muW: number, sW: number, muL: number, sL: number,
): [number, number, number, number, number, number] {
  const [uA, uB] = updatedAnnotator(alpha, beta, muW, sW, muL, sL);
  const [uMuW, uMuL] = updatedMus(alpha, beta, muW, sW, muL, sL);
  const [uSW, uSL] = updatedSigmaSqs(alpha, beta, muW, sW, muL, sL);
  return [uA, uB, uMuW, uSW, uMuL, uSL];
}

export function expectedInfoGain(
  alpha: number, beta: number,
  muA: number, sA: number, muB: number, sB: number,
): number {
  const [a1, b1, c] = updatedAnnotator(alpha, beta, muA, sA, muB, sB);
  const [muA1, muB1] = updatedMus(alpha, beta, muA, sA, muB, sB);
  const [sA1, sB1] = updatedSigmaSqs(alpha, beta, muA, sA, muB, sB);
  const [a2, b2] = updatedAnnotator(alpha, beta, muB, sB, muA, sA);
  const [muB2, muA2] = updatedMus(alpha, beta, muB, sB, muA, sA);
  const [sB2, sA2] = updatedSigmaSqs(alpha, beta, muB, sB, muA, sA);
  return (
    c * (divergenceGaussian(muA1, sA1, muA, sA) + divergenceGaussian(muB1, sB1, muB, sB) + GAMMA * divergenceBeta(a1, b1, alpha, beta)) +
    (1 - c) * (divergenceGaussian(muA2, sA2, muA, sA) + divergenceGaussian(muB2, sB2, muB, sB) + GAMMA * divergenceBeta(a2, b2, alpha, beta))
  );
}

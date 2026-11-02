import { makeOptions, run, prewarm, summary } from './common.js';

export const options = makeOptions(10, '30s');
export function setup() { prewarm(); }
export default function () { run(); }
export function handleSummary(data) { return summary(data); }
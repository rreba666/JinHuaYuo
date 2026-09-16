/**
 * 后端文案兜底归一化工具。
 *
 * 背景：产品口径已把历史用词统一改为「红包」（产品内不得出现旧词），
 * 但后端接口（尤其历史数据与尚未发版的出参）仍可能下发旧词的文案，
 * 例如提现记录的 `typeDesc`、红包贡献/累计明细的 `statusDesc` 等。
 * 因此凡是**直接展示后端下发文案**的位置，都先过这道归一化，
 * 保证页面无论后端返回什么都不会出现旧词。
 *
 * 说明：正则里的旧词以 Unicode 转义书写（`\u5206\u7ea2`），
 * 既避免历史用词明文残留到打包产物，也保证这里只做匹配替换、不参与界面展示。
 */

/**
 * 把后端文案中的历史用词归一化为「红包」。
 * @param text 后端下发的文案（可能为 null / undefined）
 * @returns 归一化后的文案；入参为空时返回空字符串
 */
export function normalizeLegacyWording(text: string | null | undefined): string {
  return String(text ?? '').replace(/\u5206\u7ea2/g, '红包')
}

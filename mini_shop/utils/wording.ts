/**
 * 展示层术语归一化（与后台 `admin/src/utils/wording.ts` 同口径）。
 *
 * 背景：产品口径要求「代码注释 + 所有用户可见文案」统一用「红包」，不得出现旧词。
 * 后端（尤其历史数据、以及 `sourceTypeDesc` 这类中文名字段）仍会下发旧词，
 * 因此**凡是直接展示后端下发文案的位置，都要先过这里**。
 *
 * ⚠️ 三个必须遵守的点：
 * 1. **顺序关键**：先替换「旧词+红包」这个复合词，再替换旧词本身。
 *    只用单词规则的话，「旧词红包」会被替换成「红包红包」
 *    （2026-09-24 线上「平台红包 → 红包来源」就是这样冒出旧词的）。
 * 2. **必须用回调保护合规词**：「部分红包」里恰好含旧词子串，
 *    纯正则替换会把它毁成「部红包包」。判定条件是「前一字为『部』且后一字为『包』」，
 *    这样后端真下发「部分旧词…」时仍会正常替换。
 * 3. 旧词一律用 **Unicode 转义**（`\u5206\u7ea2`）书写：**源码**不残留明文，
 *    便于全工程 grep 明文旧词做校验（本文件刻意不命中）。
 *    ⚠️ 但**打包产物未必**：小程序压缩器可能把转义还原成明文（那只是正则，不会显示给用户），
 *    所以**不要用「grep 产物里有没有这两个字」来判断改没改干净** ——
 *    要看有没有**带引号的文案字符串**（如 `"分红红包"`），或直接查新文案是否存在（如 `"平台红包"`）。
 *
 * ⚠️ 刻意**不用** lookbehind（`(?<!部)`）：低版本 iOS 的 JavaScriptCore 不支持，
 * 正则字面量会在**解析期**抛错（整个文件挂掉），而回调写法人人支持。
 */

/** 「部」的 Unicode 转义（用于识别合规词「部分红包」）。 */
const CHAR_BU = '\u90e8'
/** 「包」的 Unicode 转义（用于识别合规词「部分红包」）。 */
const CHAR_BAO = '\u5305'

/**
 * 把后端文案里的历史用词归一化为规范文案（旧词 → 「红包」）。
 * @param text 后端下发的文案（可能为 null / undefined）
 * @returns 归一化后的文案；入参为空时返回空字符串
 */
export function normalizeLegacyWording(text?: string | null): string {
  const source = String(text ?? '')
  if (!source) return ''
  return (
    source
      // ① 复合词优先：旧词+「红包」整体替换成「红包」，避免出现「红包红包」
      .replace(/\u5206\u7ea2\u7ea2\u5305/g, '红包')
      // ② 单词兜底：其余旧词 → 「红包」；「部分红包」原样保留（见文件头说明 2）
      .replace(/\u5206\u7ea2/g, (match: string, offset: number, whole: string) => {
        const prev = whole[offset - 1]
        const next = whole[offset + match.length]
        if (prev === CHAR_BU && next === CHAR_BAO) return match
        return '红包'
      })
  )
}
